import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { kk } from "@/i18n"
import { useAristosDB } from "@/context/DBContext"
import {
  generateSyncCode,
  DEFAULT_CLOUD_ENDPOINT,
  getCloudConfig,
  isCloudConfigured,
  pullFromCloud,
  pushToCloud,
  type CloudConfig,
} from "@/lib/cloud"
import { saveSetting } from "@/lib/db"
import { backupSummary, restoreBackup } from "@/lib/backup"
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  KeyRound,
  Loader2,
} from "lucide-react"
import { useConfirm } from "@/components/ui/confirm"

interface CloudSyncModalProps {
  isOpen: boolean
  onClose: () => void
}

type Busy = "push" | "pull" | null
type StatusMsg = { text: string; isError?: boolean } | null

/** i18n-independent setting keys for the editable CloudConfig fields. */
const SETTING_KEYS = {
  endpoint: "cloudEndpoint",
  code: "cloudCode",
  passphrase: "cloudPassphrase",
  autoPush: "cloudAutoPush",
  autoPull: "cloudAutoPull",
} as const

const INPUT_CLASS =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"

function formatTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—"
}

/** Cloud sync setup: endpoint/code/passphrase, auto-sync toggles, manual push/pull. */
export function CloudSyncModal({ isOpen, onClose }: CloudSyncModalProps) {
  const { reloadData } = useAristosDB()
  const confirm = useConfirm()
  const [config, setConfig] = useState<CloudConfig>({
    endpoint: DEFAULT_CLOUD_ENDPOINT,
    code: "",
    passphrase: "",
    autoPush: false,
    autoPull: false,
    lastPush: null,
    lastPull: null,
  })
  const [busy, setBusy] = useState<Busy>(null)
  const [status, setStatus] = useState<StatusMsg>(null)

  useEffect(() => {
    if (!isOpen) return
    void getCloudConfig().then((loaded) => {
      setConfig(loaded)
      setStatus(null)
    })
  }, [isOpen])

  const update = async <K extends keyof typeof SETTING_KEYS>(
    field: K,
    value: CloudConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [field]: value }))
    await saveSetting(SETTING_KEYS[field], value)
  }

  const handlePush = async (force = false) => {
    if (!isCloudConfigured(config)) {
      setStatus({ text: kk.cloudNotConfigured, isError: true })
      return
    }
    setBusy("push")
    setStatus(null)
    const result = await pushToCloud(
      config.endpoint,
      config.code,
      config.passphrase,
      force
    )
    setBusy(null)
    if (result.status === "ok") {
      setConfig((prev) => ({ ...prev, lastPush: result.updatedAt }))
      // Показать, ЧТО именно ушло в облако — неполный пуш сразу виден
      setStatus({
        text: `${kk.cloudDone} ${kk.cloudSyncSummary(result.counts)}`,
      })
    } else if (result.status === "conflict") {
      const ok = await confirm({
        title: kk.cloudPush,
        description: kk.cloudOverwriteConfirm,
        destructive: true,
        confirmLabel: kk.cloudPush,
      })
      if (ok) {
        await handlePush(true)
        return
      }
      setStatus({ text: kk.cloudPushCancelled })
    } else {
      setStatus({ text: `${kk.cloudError}: ${result.message}`, isError: true })
    }
  }

  const handlePull = async () => {
    if (!isCloudConfigured(config)) {
      setStatus({ text: kk.cloudNotConfigured, isError: true })
      return
    }
    // Restore заменяет ВСЕ локальные данные — подтверждаем ДО загрузки
    const ok = await confirm({
      title: kk.cloudPull,
      description: kk.cloudPullConfirm,
      destructive: true,
      confirmLabel: kk.cloudPull,
    })
    if (!ok) {
      setStatus({ text: kk.cancel })
      return
    }
    setBusy("pull")
    setStatus(null)
    const result = await pullFromCloud(
      config.endpoint,
      config.code,
      config.passphrase
    )
    setBusy(null)
    if (result.status === "empty") {
      setStatus({ text: kk.cloudNoData })
      return
    }
    if (result.status === "bad-passphrase") {
      setStatus({ text: kk.cloudWrongPassphrase, isError: true })
      return
    }
    if (result.status === "error") {
      setStatus({ text: `${kk.cloudError}: ${result.message}`, isError: true })
      return
    }
    try {
      await restoreBackup(result.backup)
      const pulledAt = result.updatedAt ?? result.backup.exportedAt
      await saveSetting("cloudLastPull", pulledAt)
      setConfig((prev) => ({ ...prev, lastPull: pulledAt }))
      reloadData()
      // Что именно приехало из бекапа
      setStatus({
        text: `${kk.cloudDone} ${kk.cloudSyncSummary(backupSummary(result.backup))}`,
      })
    } catch (err) {
      setStatus({
        text: `${kk.cloudError}: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      })
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={kk.cloudSync}
      description={kk.cloudSyncDesc}
    >
      <div className="space-y-3">
        <label className="block space-y-1 text-xs font-medium">
          {kk.cloudEndpoint}
          <input
            value={config.endpoint}
            onChange={(event) => void update("endpoint", event.target.value)}
            placeholder="https://aristos-sync.username.workers.dev"
            spellCheck={false}
            autoComplete="off"
            className={INPUT_CLASS}
          />
          <span className="block text-[11px] font-normal text-muted-foreground">
            {kk.cloudEndpointHint}
          </span>
        </label>

        <label className="block space-y-1 text-xs font-medium">
          {kk.cloudCode}
          <span className="flex flex-col gap-2 sm:flex-row">
            <input
              value={config.code}
              onChange={(event) =>
                void update("code", event.target.value.toUpperCase())
              }
              placeholder="ARISTOS-XXXX-XXXX-XXXX"
              spellCheck={false}
              autoComplete="off"
              className={`${INPUT_CLASS} min-w-0 flex-1 font-mono tracking-wide`}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void update("code", generateSyncCode())}
              title={kk.cloudGenerate}
              className="shrink-0 justify-center gap-1.5 text-xs whitespace-nowrap"
            >
              <KeyRound className="size-3.5" /> {kk.cloudGenerate}
            </Button>
          </span>
          <span className="block text-[11px] font-normal text-muted-foreground">
            {kk.cloudCodeHint}
          </span>
        </label>

        <label className="block space-y-1 text-xs font-medium">
          {kk.cloudPassphrase}
          <input
            type="password"
            value={config.passphrase}
            onChange={(event) => void update("passphrase", event.target.value)}
            autoComplete="new-password"
            className={INPUT_CLASS}
          />
          <span className="block text-[11px] font-normal text-muted-foreground">
            {kk.cloudPassphraseHint}
          </span>
        </label>

        <div className="space-y-1.5 rounded-xl border border-border/70 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={config.autoPush}
              onChange={(event) =>
                void update("autoPush", event.target.checked)
              }
              className="size-4 cursor-pointer accent-primary"
            />
            {kk.cloudAuto}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={config.autoPull}
              onChange={(event) =>
                void update("autoPull", event.target.checked)
              }
              className="size-4 cursor-pointer accent-primary"
            />
            {kk.cloudAutoPull}
          </label>
        </div>

        {/* Как это работает — краткий гид: настройки делаются один раз */}
        <details className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
            <Cloud className="size-3.5 shrink-0" />
            {kk.cloudGuideTitle}
          </summary>
          <ol className="mt-2 space-y-1.5">
            {kk.cloudGuide.map((step, i) => (
              <li
                key={i}
                className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground"
              >
                <span className="mt-0.5 shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </details>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy !== null}
            onClick={() => void handlePush()}
            className="flex-1 gap-1.5"
          >
            {busy === "push" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CloudUpload className="size-3.5" />
            )}
            {kk.cloudPush}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void handlePull()}
            className="flex-1 gap-1.5"
          >
            {busy === "pull" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CloudDownload className="size-3.5" />
            )}
            {kk.cloudPull}
          </Button>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Cloud className="size-3 shrink-0" />
          <span>
            {kk.cloudLastPush}: {formatTime(config.lastPush)} ·{" "}
            {kk.cloudLastPull}: {formatTime(config.lastPull)}
          </span>
        </div>

        {status && (
          <div
            className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
              status.isError
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            <span>{status.text}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            {kk.close}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
