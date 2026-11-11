import { useEffect, useState } from "react"
import { kk, LANGS } from "@/i18n"
import { cn } from "@/lib/utils"
import { isTauri, isTauriMobile } from "@/lib/tauri"
import {
  THEME_PRESETS,
  applyThemePreset,
  currentScheme,
  loadThemePreset,
  loadUserCss,
  saveThemePreset,
  saveUserCss,
} from "@/lib/theme-presets"
import {
  loadNotifSettings,
  notificationPermission,
  requestNotificationPermission,
  saveNotifSettings,
  type NotifSettings,
} from "@/lib/notifications"
import { refreshNativeReminders } from "@/lib/reminders"
import { isPermissionGranted } from "@tauri-apps/plugin-notification"
import { Bell, ChevronDown } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { useLang } from "@/i18n/lang-provider"
import { useAristosDB } from "@/context/DBContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { SideDrawer } from "@/components/ui/side-drawer"
import { useConfirm } from "@/components/ui/confirm"
import { ImportModal } from "./ImportModal"
import { DataManageModal } from "./DataManageModal"
import { NativeSyncSection } from "./NativeSyncSection"
import { UpdateSection } from "./UpdateSection"
import { clearAllData } from "@/lib/db"
import { createBackup } from "@/lib/backup"
import {
  Sun,
  Moon,
  Laptop,
  Eye,
  Edit3,
  Upload,
  Download,
  ExternalLink,
  RotateCcw,
  Trash2,
} from "lucide-react"

interface SideMenuProps {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

/** «Мәзір» — настройки (курс/семестр, тема, язык, данные).
 *  На десктопе — обычное модальное окно, на телефоне — шторка слева,
 *  которая ведётся за пальцем (свайп от края — открыть, влево — закрыть). */
export function SideMenu({ isOpen, onOpen, onClose }: SideMenuProps) {
  const { theme, setTheme } = useTheme()
  // стиль интерфейса — применяется мгновенно, переживает перезагрузку
  const [presetId, setPresetId] = useState(loadThemePreset)
  const selectPreset = (id: string) => {
    setPresetId(id)
    saveThemePreset(id)
    applyThemePreset(id, currentScheme())
  }
  // свой CSS (моддерам): применяется на каждый ввод
  const [userCss, setUserCss] = useState(loadUserCss)

  // уведомления: настройки на устройстве + статус разрешения
  const [notifSettings, setNotifSettings] = useState(loadNotifSettings)
  const [notifPerm, setNotifPerm] = useState(notificationPermission)
  const updateNotif = (next: NotifSettings) => {
    setNotifSettings(next)
    saveNotifSettings(next)
    // мобильный Tauri: перепланировать нативные напоминания под новые настройки
    if (isTauriMobile()) {
      void refreshNativeReminders({
        schedule,
        calendar,
        activeSemester,
        canvasAssignments,
      })
    }
  }
  const requestPermission = async () => {
    setNotifPerm(await requestNotificationPermission())
  }
  // Tauri: синхронный статус неизвестен — уточняем асинхронно через плагин
  useEffect(() => {
    if (!isTauri()) return
    void isPermissionGranted().then((ok) =>
      setNotifPerm(ok ? "granted" : "default")
    )
  }, [])
  const { lang, setLang } = useLang()
  const confirm = useConfirm()
  const {
    activeCourse,
    availableCourses,
    setActiveCourse,
    activeSemester,
    availableSemesters,
    setActiveSemester,
    editMode,
    setEditMode,
    reloadData,
    subjects,
    canvasCourses,
    platonusYears,
    schedule,
    calendar,
    canvasAssignments,
  } = useAristosDB()

  const [importOpen, setImportOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExportData = async () => {
    setExporting(true)
    try {
      const backup = await createBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `aristos-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.style.position = "fixed"
      link.style.left = "-10000px"
      document.body.appendChild(link)
      link.click()
      window.setTimeout(() => {
        URL.revokeObjectURL(url)
        link.remove()
      }, 1000)
    } catch (error) {
      console.error("Backup export failed:", error)
      await confirm({ title: kk.exportFailed, info: true })
    } finally {
      setExporting(false)
    }
  }

  const handleResetData = async () => {
    const ok = await confirm({
      title: kk.resetData,
      description: kk.resetConfirm,
      destructive: true,
    })
    if (!ok) return
    setResetting(true)
    await clearAllData()
    reloadData()
    setResetting(false)
    onClose()
  }

  const menuBody = (
    <div className="space-y-6">
      {/* Course & Semester Context */}
      <div className="space-y-3">
        <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {kk.selectCourse} & {kk.selectSemester}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground">
              {kk.course}
            </span>
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
              {availableCourses.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveCourse(c)}
                  className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
                    activeCourse === c
                      ? "bg-card font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground">
              {kk.semester}
            </span>
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
              {availableSemesters.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSemester(s)}
                  className={`flex-1 rounded-md py-1 text-xs font-medium transition-all ${
                    activeSemester === s
                      ? "bg-card font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {kk.mode}
          </label>
          {editMode && (
            <Badge variant="blue" className="px-1.5 py-0 text-[10px]">
              {kk.modeEdit}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={!editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode(false)}
            className="h-9 justify-start gap-2 text-xs"
          >
            <Eye className="size-3.5" />
            {kk.modeView}
          </Button>
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode(true)}
            className="h-9 justify-start gap-2 text-xs"
          >
            <Edit3 className="size-3.5" />
            {kk.modeEdit}
          </Button>
        </div>
      </div>

      {/* Theme Switcher */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {kk.theme}
        </label>
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
          <button
            onClick={() => setTheme("light")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              theme === "light"
                ? "bg-card font-semibold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sun className="size-3.5" />
            {kk.themeLight}
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              theme === "dark"
                ? "bg-card font-semibold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Moon className="size-3.5" />
            {kk.themeDark}
          </button>
          <button
            onClick={() => setTheme("system")}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              theme === "system"
                ? "bg-card font-semibold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Laptop className="size-3.5" />
            {kk.themeSystem}
          </button>
        </div>
      </div>

      {/* Language Switcher */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {kk.language}
        </label>
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
          {LANGS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setLang(id)}
              className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
                lang === id
                  ? "bg-card font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Уведомления */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {kk.notifSection}
        </label>
        {notifPerm === "unsupported" ? (
          <p className="text-[11px] text-muted-foreground">
            {kk.notifUnsupported}
          </p>
        ) : notifPerm !== "granted" ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void requestPermission()}
              className="h-9 w-full justify-start gap-2 text-xs"
            >
              <Bell className="size-3.5 text-primary" />
              {kk.notifAllow}
            </Button>
            {notifPerm === "denied" && (
              <p className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                {kk.notifBlocked}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium">
              {kk.notifLessons}
              <input
                type="checkbox"
                checked={notifSettings.lessons}
                onChange={(e) =>
                  updateNotif({ ...notifSettings, lessons: e.target.checked })
                }
                className="size-4 cursor-pointer accent-primary"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium">
              {kk.notifDeadlines}
              <input
                type="checkbox"
                checked={notifSettings.deadlines}
                onChange={(e) =>
                  updateNotif({ ...notifSettings, deadlines: e.target.checked })
                }
                className="size-4 cursor-pointer accent-primary"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium">
              {kk.notifDigest}
              <input
                type="checkbox"
                checked={notifSettings.digest}
                onChange={(e) =>
                  updateNotif({ ...notifSettings, digest: e.target.checked })
                }
                className="size-4 cursor-pointer accent-primary"
              />
            </label>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">
                {kk.notifBefore}
              </span>
              <div className="grid grid-cols-4 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
                {[5, 10, 15, 30].map((m) => (
                  <button
                    key={m}
                    onClick={() =>
                      updateNotif({ ...notifSettings, minutesBefore: m })
                    }
                    className={`rounded-lg py-1.5 text-[11px] font-medium transition-all ${
                      notifSettings.minutesBefore === m
                        ? "bg-card font-semibold text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m} {kk.notifMinutesShort}
                  </button>
                ))}
              </div>
            </div>
            {isTauriMobile() && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {kk.notifNativeHint}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Нативный синк Canvas/Платонус — только desktop-Tauri (на вебе живёт
          расширение, на Android данные приходят через облако) */}
      {isTauri() && !isTauriMobile() && <NativeSyncSection />}

      {/* Канал обновлений: APK на мобильном, тихая установка на десктопе */}
      {isTauri() && <UpdateSection />}

      {/* Data Actions */}
      <div className="space-y-2 border-t border-border/60 pt-2">
        <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {kk.dataSection}
        </label>
        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="h-9 justify-start gap-2 text-xs"
          >
            <Upload className="size-3.5 text-primary" />
            {kk.importData}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManageOpen(true)}
            className="h-9 justify-start gap-2 text-xs"
          >
            <RotateCcw className="size-3.5 text-primary" />
            {kk.dataManage}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            disabled={exporting}
            className="h-9 justify-start gap-2 text-xs"
          >
            <Download className="size-3.5 text-primary" />
            {exporting ? kk.exportingLabel : kk.exportBackup}
          </Button>
          {/* Внешний инструмент для JSON-конфигов расписания */}
          <a
            href="https://curriculumbuilder.vercel.app"
            target="_blank"
            rel="noreferrer"
            title={kk.curriculumBuilderHint}
            className="inline-flex h-9 items-center justify-start gap-2 rounded-lg border border-border bg-background px-2.5 text-xs font-medium transition-all hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              {kk.curriculumBuilder}
            </span>
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetData}
            disabled={resetting}
            className="h-9 justify-start gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
            {resetting ? kk.deletingLabel : kk.resetData}
          </Button>
        </div>
      </div>

      {/* Стили и кастомизация — свёрнуто внизу: для энтузиастов, не мешает обычному пользователю */}
      <details className="group rounded-xl border border-border/60 bg-muted/30">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          {kk.advSection}
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 p-3 pt-1">
          <label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {kk.themePreset}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {THEME_PRESETS.map((preset) => {
              const selected = presetId === preset.id
              const scheme = currentScheme()
              return (
                <button
                  key={preset.id}
                  onClick={() => selectPreset(preset.id)}
                  title={kk[preset.nameKey]}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all",
                    selected
                      ? "border-primary/60 bg-primary/10 text-foreground shadow-xs"
                      : "border-border/70 bg-muted/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className="size-3.5 rounded-full border border-border/50"
                    style={{ background: preset.swatch[scheme] }}
                  />
                  {kk[preset.nameKey]}
                </button>
              )
            })}
          </div>

          {/* Custom CSS (modder API v0): пользовательский слой поверх всего */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {kk.userCssTitle}
            </label>

            {/* Шпаргалка хуков для пользовательского CSS */}
            <div className="rounded-xl border border-border/50 bg-background/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground/80">
                {kk.userCssHooksTitle}
              </p>
              <code className="block">[data-slot="card"] — карточки</code>
              <code className="block">[data-slot="button"] — кнопки</code>
              <code className="block">[data-slot="badge"] — бейджи</code>
              <code className="block">
                :root {"{ --primary: …; --radius: …; }"}
              </code>
              <code className="block">
                .dark {"{ … }"} — только тёмная тема
              </code>
            </div>

            <textarea
              value={userCss}
              rows={5}
              spellCheck={false}
              onChange={(e) => {
                setUserCss(e.target.value)
                saveUserCss(e.target.value)
              }}
              placeholder={kk.userCssPlaceholder}
              className="w-full resize-y rounded-lg border border-border/70 bg-background/60 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {kk.userCssHint}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setUserCss("")
                saveUserCss("")
              }}
              className="h-7 text-[11px] text-muted-foreground"
            >
              {kk.userCssReset}
            </Button>
          </div>
        </div>
      </details>

      {/* Footer info */}
      <div className="border-t border-border/50 pt-3 text-center">
        <p className="text-[11px] text-muted-foreground">
          {kk.menuFooterStats(
            subjects.length,
            canvasCourses.length,
            platonusYears.length
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {kk.offlinePwa}
        </p>
      </div>
    </div>
  )

  return (
    <>
      {/* Десктоп (lg+): обычная модалка по центру */}
      <div className="hidden lg:block">
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          title={kk.menu}
          description={kk.appSubtitle}
          className="max-w-md lg:max-w-xl"
        >
          {menuBody}
        </Modal>
      </div>

      {/* Мобайл: шторка слева, ведётся за пальцем */}
      <SideDrawer
        isOpen={isOpen}
        onOpen={onOpen}
        onClose={onClose}
        title={kk.menu}
        description={kk.appSubtitle}
      >
        {menuBody}
      </SideDrawer>

      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />

      <DataManageModal
        isOpen={manageOpen}
        onClose={() => setManageOpen(false)}
        onDataChanged={reloadData}
      />
    </>
  )
}
