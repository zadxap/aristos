import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { kk } from '@/i18n'
import { useAristosDB } from '@/context/DBContext'
import { CANVAS_SYNC_ORIGINS, isCanvasSyncMessage, isCanvasSyncPayload, type CanvasSyncResultMessage } from '@/lib/canvas'
import { PLATONUS_STORAGE_KEY, isPlatonusSyncMessage, isPlatonusSyncPayload } from '@/lib/platonus'

/**
 * Headless listener that accepts "aristos-canvas-sync" payloads two ways:
 * 1. postMessages from the userscript running on canvas.yu.edu.kz (same-origin
 *    requests there) or from this app's own origin (dev/tests);
 * 2. a localStorage handoff written by the browser extension — checked on
 *    mount, on focus/visibility changes, and on a short interval.
 * Shows a brief toast for either path.
 */
const STORAGE_KEY = 'aristosCanvasSync'

/** Квитанция для расширения: «формат X с syncedAt Y успешно применён». */
function writeReceipt(payload: { format: string; syncedAt: string }) {
  try {
    localStorage.setItem(
      'aristosSyncReceipt',
      JSON.stringify({ format: payload.format, syncedAt: payload.syncedAt, at: Date.now() }),
    )
  } catch {
    /* квитанция некритична */
  }
}

export function CanvasSyncListener() {
  const { syncCanvas, syncPlatonus } = useAristosDB()
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)
  const hideTimer = useRef<number | null>(null)

  function scheduleHide() {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setToast(null), 6000)
  }

  // localStorage handoff from the extensions (Canvas and Platonus)
  useEffect(() => {
    async function consume() {
      // Canvas payload
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        localStorage.removeItem(STORAGE_KEY) // consume first so failures can't loop
        try {
          const payload = JSON.parse(raw)
          if (isCanvasSyncPayload(payload)) {
            await syncCanvas(payload)
            writeReceipt(payload)
            setToast({ ok: true, text: kk.syncCanvasOk(payload.courses.length, payload.assignments.length) })
            scheduleHide()
          } else if (isPlatonusSyncPayload(payload)) {
            // Пейлоад Платонуса в канвас-ключе (старый баг расширения) — применяем по назначению
            await syncPlatonus(payload)
            writeReceipt(payload)
            setToast({ ok: true, text: kk.syncPlatonusOk(payload.records.length) })
            scheduleHide()
          }
        } catch (err) {
          console.error('[Aristos] localStorage sync failed:', err)
          setToast({ ok: false, text: kk.syncCanvasFail })
          scheduleHide()
        }
      }
      // Platonus payload
      const platRaw = localStorage.getItem(PLATONUS_STORAGE_KEY)
      if (platRaw) {
        localStorage.removeItem(PLATONUS_STORAGE_KEY)
        try {
          const payload = JSON.parse(platRaw)
          if (isPlatonusSyncPayload(payload)) {
            await syncPlatonus(payload)
            writeReceipt(payload)
            setToast({ ok: true, text: kk.syncPlatonusOk(payload.records.length) })
            scheduleHide()
          } else if (isCanvasSyncPayload(payload)) {
            await syncCanvas(payload)
            writeReceipt(payload)
            setToast({ ok: true, text: kk.syncCanvasOk(payload.courses.length, payload.assignments.length) })
            scheduleHide()
          }
        } catch (err) {
          console.error('[Aristos] Platonus localStorage sync failed:', err)
          setToast({ ok: false, text: kk.syncPlatonusFail })
          scheduleHide()
        }
      }
    }
    void consume()
    const interval = window.setInterval(() => void consume(), 8000)
    const onVisible = () => { if (document.visibilityState === 'visible') void consume() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [syncCanvas, syncPlatonus])

  useEffect(() => {
    function reply(source: MessageEventSource | null, result: CanvasSyncResultMessage) {
      source?.postMessage(result, { targetOrigin: '*' })
    }

    async function handleMessage(event: MessageEvent) {
      if (!CANVAS_SYNC_ORIGINS.includes(event.origin)) {
        console.warn('[Aristos] sync message from unexpected origin ignored:', event.origin)
        return
      }
      // Platonus payload from the extension
      if (isPlatonusSyncMessage(event.data)) {
        try {
          await syncPlatonus(event.data.payload)
          writeReceipt(event.data.payload)
          setToast({ ok: true, text: kk.syncPlatonusOk(event.data.payload.records.length) })
          reply(event.source, { type: 'aristos-canvas-sync-result', ok: true })
        } catch (err) {
          const message = err instanceof Error ? err.message : kk.unknownError
          setToast({ ok: false, text: kk.syncPlatonusFailReason(message) })
          reply(event.source, { type: 'aristos-canvas-sync-result', ok: false, error: message })
        }
        scheduleHide()
        return
      }
      if (!isCanvasSyncMessage(event.data)) {
        console.warn('[Aristos] sync message payload failed validation')
        return
      }

      // The extension also writes this key as a fallback delivery path — the
      // postMessage data is identical, so drop the queued copy.
      localStorage.removeItem(STORAGE_KEY)

      try {
        const { courses, assignments } = event.data.payload
        await syncCanvas(event.data.payload)
        writeReceipt(event.data.payload)
        setToast({ ok: true, text: kk.syncCanvasOk(courses.length, assignments.length) })
        reply(event.source, { type: 'aristos-canvas-sync-result', ok: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : kk.unknownError
        setToast({ ok: false, text: kk.syncCanvasFailReason(message) })
        reply(event.source, { type: 'aristos-canvas-sync-result', ok: false, error: message })
      }
      scheduleHide()
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [syncCanvas, syncPlatonus])

  if (!toast) return null

  return (
    <div className="fixed bottom-20 lg:bottom-6 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5 shadow-lg max-w-md bg-card text-sm animate-in fade-in slide-in-from-bottom-2 ${
          toast.ok ? 'border-emerald-500/30' : 'border-destructive/40'
        }`}
        role="status"
      >
        {toast.ok ? (
          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
        ) : (
          <AlertCircle className="size-4 shrink-0 text-destructive" />
        )}
        <span className="text-foreground">{toast.text}</span>
        <button
          onClick={() => setToast(null)}
          className="ml-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={kk.close}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
