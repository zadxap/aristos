import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isTauri } from '@/lib/tauri'
import {
  listSubjectPdfs,
  savePdfFiles,
  deletePdfFile,
  getPdfBlob,
  type PdfFileMeta,
} from '@/lib/pdf-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { kk } from '@/i18n'
import { FileText, Trash2, Upload, ExternalLink } from 'lucide-react'

interface UploadedPdfsProps {
  subjectId: string
  editMode: boolean
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ${kk.unitMb}`
  return `${Math.max(1, Math.round(bytes / 1024))} ${kk.unitKb}`
}

import { useConfirm } from '@/components/ui/confirm'

export function UploadedPdfs({ subjectId, editMode }: UploadedPdfsProps) {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [files, setFiles] = useState<PdfFileMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setFiles(await listSubjectPdfs(subjectId))
    setLoaded(true)
  }, [subjectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    setUploading(true)
    try {
      await savePdfFiles(subjectId, Array.from(list))
      await refresh()
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleOpen = async (meta: PdfFileMeta) => {
    // В Tauri (особенно Android WebView) blob: в новом окне не открывается —
    // встроенный pdf.js-просмотрщик; на вебе — прежняя логика.
    if (isTauri()) {
      navigate(`/pdf/${encodeURIComponent(meta.id)}`)
      return
    }
    const blob = await getPdfBlob(meta.id)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (!win) {
      // Popup заблокирован — открываем синтетическим <a> в том же user gesture.
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    }
    // Вкладка просмотрщика может дочитывать blob URL уже после загрузки,
    // поэтому отзываем URL с задержкой (минутная утечка безвредна).
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const handleDelete = async (meta: PdfFileMeta) => {
    const ok = await confirm({ title: kk.delete, description: kk.pdfDeleteConfirm.replace('{name}', meta.filename), destructive: true })
    if (!ok) return
    await deletePdfFile(meta.id)
    await refresh()
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{kk.pdfUploaded}</h3>
        <div className="flex items-center gap-2">
          {uploading && (
            <span className="text-xs font-medium text-muted-foreground">{kk.pdfUploading}</span>
          )}
          {editMode && !uploading && (
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => inputRef.current?.click()}>
              <Upload className="size-3.5" />
              <span>{kk.pdfChoose}</span>
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{kk.pdfUploadHint}</p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      {loaded && files.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
          <FileText className="mx-auto mb-2 size-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">{kk.pdfEmpty}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="grid gap-2.5">
          {files.map((meta) => (
            <Card
              key={meta.id}
              className="min-w-0 hover:border-primary/50 transition-all shadow-xs"
            >
              <CardContent className="flex min-w-0 flex-col items-stretch gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="break-words text-xs font-semibold text-foreground sm:text-sm sm:line-clamp-2">
                      {meta.title}
                    </h4>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {meta.filename} · {formatSize(meta.size)}
                    </p>
                  </div>
                </div>

                <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleOpen(meta)}
                    aria-label={`${kk.pdfOpen}: ${meta.title}`}
                    className="h-9 min-w-0 gap-1.5 px-3 text-xs"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>{kk.pdfOpen}</span>
                  </Button>
                  {editMode && (
                    <button
                      onClick={() => void handleDelete(meta)}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`${kk.pdfDelete}: ${meta.title}`}
                      title={kk.pdfDelete}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
