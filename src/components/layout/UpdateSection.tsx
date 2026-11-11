import { useEffect, useState } from 'react'
import { kk } from '@/i18n'
import { isTauri } from '@/lib/tauri'
import {
  checkAppUpdate,
  currentAppVersion,
  installAndroidUpdate,
  installDesktopUpdate,
  type AppUpdateInfo,
} from '@/lib/app-update'
import { Button } from '@/components/ui/button'
import { Download, Loader2, RefreshCw } from 'lucide-react'

/** Секция обновлений в SideMenu: версия + баннер при новой версии.
 *  Android — скачивание APK через браузер; desktop — тихая установка
 *  через tauri-plugin-updater (подпись проверяется автоматически). */
export function UpdateSection() {
  const [version, setVersion] = useState<string | null>(null)
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    void (async () => {
      const v = await currentAppVersion()
      if (!cancelled && v) setVersion(v)
      const found = await checkAppUpdate()
      if (!cancelled && found) setUpdate(found)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!isTauri()) return null

  const handleInstall = async () => {
    if (!update) return
    setBusy(true)
    try {
      if (update.apkUrl) {
        setStatus(kk.updateDownloading)
        const result = await installAndroidUpdate(update.apkUrl)
        setStatus(
          result === "need-permission"
            ? kk.updatePermHint
            : result === "fallback-browser"
              ? kk.updateBrowserHint
              : kk.updateDownloadHint
        )
      } else {
        setStatus(kk.updateInstalling)
        await installDesktopUpdate() // перезапускает приложение
      }
    } catch {
      setStatus(kk.updateFail)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {kk.updateSection}
      </label>
      <p className="text-[11px] text-muted-foreground">
        {kk.updateVersion}: {version ?? '—'}
      </p>
      {update && (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-2.5">
          <p className="text-[11px] font-medium text-foreground">
            {kk.updateAvailable.replace('{v}', update.version)}
          </p>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void handleInstall()}
            className="h-8 w-full justify-start gap-2 text-xs"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {update.apkUrl ? kk.updateDownloadApk : kk.updateInstallBtn}
          </Button>
        </div>
      )}
      {!update && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void checkAppUpdate().then((found) => {
              setUpdate(found)
              if (!found) setStatus(kk.updateUpToDate)
              setBusy(false)
            })
          }}
          className="h-8 w-full justify-start gap-2 text-xs"
        >
          <RefreshCw className="size-3.5 text-primary" />
          {kk.updateCheckBtn}
        </Button>
      )}
      {(busy || status) && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground" role="status">
          {busy && <Loader2 className="mt-0.5 size-3 shrink-0 animate-spin" />}
          <span className="min-w-0 break-words">{status ?? ''}</span>
        </p>
      )}
    </div>
  )
}
