import { useState } from 'react'
import { useAristosDB } from '@/context/DBContext'
import { kk } from '@/i18n'
import {
  discoverPlatonus,
  runCanvasSync,
  runPlatonusSync,
  type PlatonusPeriod,
  type SyncStage,
} from '@/lib/native-sync'
import { Button } from '@/components/ui/button'
import { Download, FolderSearch, Loader2, RefreshCw } from 'lucide-react'

/** Машина-ключ этапа → локализованный текст. */
function stageText(stage: SyncStage): string {
  switch (stage) {
    case 'canvas-courses':
      return kk.syncStageCanvasCourses
    case 'canvas-assignments':
      return kk.syncStageCanvasAssignments
    case 'canvas-login':
      return kk.syncStageLogin
    case 'platonus-login':
      return kk.syncStageLogin
    case 'platonus-open':
      return kk.syncStageCanvasCourses // unused fallback
    case 'canvas-apply':
    case 'platonus-apply':
      return kk.syncStageApply
    default:
      return ''
  }
}

/** Машина-ключ ошибки native-sync → локализованный текст. */
function errorText(err: unknown): string {
  const m = String((err as Error)?.message || err)
  switch (m) {
    case 'login-timeout':
      return kk.syncLoginTimeout
    case 'sync-already-running':
      return kk.syncAlreadyRunning
    case 'sync-timeout':
      return kk.syncTimeout
    case 'platonus-no-periods':
      return kk.syncPlatonusNoPeriods
    case 'platonus-empty':
      return kk.syncPlatonusEmpty
    case 'canvas-invalid-payload':
    case 'platonus-invalid-payload':
      return kk.syncCanvasFailReason('payload')
    default:
      return kk.syncCanvasFailReason(m)
  }
}

function formatLastSync(iso: string | null): string {
  if (!iso) return kk.canvasNeverSynced
  const time = new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${kk.canvasLastSync}: ${time}`
}

/** Секция нативного синка Canvas/Платонус в SideMenu (только desktop-Tauri).
 *  Замена браузерного расширения: живая сессия живёт в webview приложения. */
export function NativeSyncSection() {
  const { syncCanvas, syncPlatonus, canvasLastSync } = useAristosDB()
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<string | null>(null)
  const [periods, setPeriods] = useState<PlatonusPeriod[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const handleCanvas = async () => {
    setBusy(true)
    setStage(stageText('canvas-courses'))
    try {
      const res = await runCanvasSync({
        onStage: (s) => setStage(stageText(s)),
        apply: (payload) => syncCanvas(payload),
      })
      setStage(kk.syncCanvasOk(res.courses, res.assignments))
    } catch (err) {
      setStage(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const handleDiscover = async () => {
    setBusy(true)
    setStage(null)
    try {
      const res = await discoverPlatonus()
      setPeriods(res.periods)
      setSelected(new Set(res.periods.map((p) => `${p.year}-${p.term}`)))
      setStage(kk.syncPeriodsFound(res.periods.length))
    } catch (err) {
      setStage(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async () => {
    if (!periods) return
    const chosen = periods.filter((p) => selected.has(`${p.year}-${p.term}`))
    if (chosen.length === 0) return
    setBusy(true)
    try {
      const n = await runPlatonusSync(chosen, {
        onStage: (s) => {
          if (s === 'platonus-apply') setStage(stageText(s))
        },
        onMarks: (y, t, i, total) => setStage(kk.syncStagePlatonusMarks(y, t, i, total)),
        onPeriod: (i, total, y, t) => setStage(kk.syncStagePlatonusPeriod(i, total, y, t)),
        apply: (payload) => syncPlatonus(payload),
      })
      setStage(kk.syncPlatonusOk(n))
    } catch (err) {
      setStage(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const togglePeriod = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {kk.syncSection}
      </label>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {kk.syncNativeHint}
      </p>

      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void handleCanvas()}
        className="h-9 w-full justify-start gap-2 text-xs"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin text-primary" /> : <RefreshCw className="size-3.5 text-primary" />}
        {kk.syncCanvasBtn}
      </Button>
      <p className="text-[11px] text-muted-foreground">{formatLastSync(canvasLastSync)}</p>

      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void handleDiscover()}
        className="h-9 w-full justify-start gap-2 text-xs"
      >
        <FolderSearch className="size-3.5 text-primary" />
        {kk.syncPlatonusDiscover}
      </Button>

      {periods && periods.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-2.5">
          <p className="text-[11px] text-muted-foreground">{kk.syncPeriodsFound(periods.length)}</p>
          <div className="flex flex-wrap gap-1">
            {periods.map((p) => {
              const key = `${p.year}-${p.term}`
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2 py-1 text-[11px] font-medium text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => togglePeriod(key)}
                    className="size-3 cursor-pointer accent-primary"
                  />
                  {p.year}/{p.term}
                </label>
              )
            })}
          </div>
          <Button
            size="sm"
            disabled={busy || selected.size === 0}
            onClick={() => void handleImport()}
            className="h-8 w-full justify-start gap-2 text-xs"
          >
            <Download className="size-3.5 text-primary" />
            {kk.syncPlatonusImport}
          </Button>
        </div>
      )}

      {(busy || stage) && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground" role="status">
          {busy && <Loader2 className="mt-0.5 size-3 shrink-0 animate-spin" />}
          <span className="min-w-0 break-words">{stage ?? ''}</span>
        </p>
      )}
    </div>
  )
}
