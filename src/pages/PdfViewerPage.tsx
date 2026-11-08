import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getPdfBlob } from '@/lib/pdf-store'
import { kk } from '@/i18n'
import { ArrowLeft, ChevronLeft, ChevronRight, FileWarning } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Воркер как vite-ассет: работает и на вебе, и под tauri-протоколом.
GlobalWorkerOptions.workerSrc = workerUrl

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready'
      task: PDFDocumentLoadingTask
      doc: PDFDocumentProxy
      title: string
      total: number
    }

/** Встроенный просмотрщик оффлайн-PDF (стор `pdfFiles`).
 *  Нужен в первую очередь для Tauri: Android WebView не умеет рендерить
 *  PDF и window.open(blob:) там не работает. */
export function PdfViewerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [page, setPage] = useState(1)
  const [lastId, setLastId] = useState(id)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderToken = useRef(0)

  // Смена PDF: сбрасываем состояние во время рендера (каноничный паттерн
  // React вместо setState в эффекте).
  if (lastId !== id) {
    setLastId(id)
    setPhase({ kind: 'loading' })
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    const pdfId = decodeURIComponent(id ?? '')
    void (async () => {
      try {
        const blob = await getPdfBlob(pdfId)
        if (!blob) {
          if (!cancelled) setPhase({ kind: 'error' })
          return
        }
        const data = await blob.arrayBuffer()
        const task = getDocument({ data: new Uint8Array(data) })
        const doc = await task.promise
        if (cancelled) {
          void task.destroy()
          return
        }
        const title = pdfId.includes(':') ? pdfId.slice(pdfId.indexOf(':') + 1) : pdfId
        setPhase({ kind: 'ready', task, doc, title, total: doc.numPages })
      } catch {
        if (!cancelled) setPhase({ kind: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  // Освобождаем документ при размонтировании (и при замене на новый).
  useEffect(() => {
    return () => {
      if (phase.kind === 'ready') void phase.task.destroy()
    }
  }, [phase])

  // Рендер текущей страницы на canvas (по ширине контейнера, с DPR).
  useEffect(() => {
    if (phase.kind !== 'ready' || !canvasRef.current) return
    const token = ++renderToken.current
    const canvas = canvasRef.current
    void (async () => {
      const pdfPage = await phase.doc.getPage(page)
      if (token !== renderToken.current) return
      const holder = canvas.parentElement
      const targetWidth = Math.min(holder?.clientWidth ?? 480, 760)
      const base = pdfPage.getViewport({ scale: 1 })
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const scale = (targetWidth / base.width) * dpr
      const viewport = pdfPage.getViewport({ scale })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      canvas.style.width = `${targetWidth}px`
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise
    })()
  }, [phase, page])

  if (phase.kind === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning className="size-10 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">{kk.pdfLoadError}</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-xs">
          <ArrowLeft className="size-3.5" />
          {kk.back}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          aria-label={kk.back}
          className="size-9 shrink-0 p-0"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {phase.kind === 'ready' ? phase.title : kk.pdfLoading}
        </h2>
        {phase.kind === 'ready' ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="←"
              className="size-9 p-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
              {page} / {phase.total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= phase.total}
              onClick={() => setPage((p) => Math.min(phase.total, p + 1))}
              aria-label="→"
              className="size-9 p-0"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : (
          <span className="w-9 shrink-0" />
        )}
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-muted/30 p-3">
        <canvas className="max-w-full rounded-lg bg-white shadow-md" ref={canvasRef} />
      </div>
    </div>
  )
}
