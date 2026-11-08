import { useEffect, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { kk } from "@/i18n"
import {
  getAllSchedules,
  getAllSubjects,
  getAllCalendars,
  deleteSchedule,
  deleteSubject,
  deleteCalendar,
  clearPlatonusData,
  saveSchedule,
  saveSubject,
  saveCalendar,
} from "@/lib/db"
import type { Schedule, Subject, AcadCalendar } from "@/types"
import { CloudSyncModal } from "@/components/layout/CloudSyncModal"
import { useConfirm } from "@/components/ui/confirm"
import {
  Trash2,
  Pencil,
  Download,
  CalendarDays,
  BookOpen,
  Database,
  Cloud,
} from "lucide-react"

interface DataManageModalProps {
  isOpen: boolean
  onClose: () => void
  onDataChanged: () => void
}

type Tab = "schedules" | "subjects" | "calendars"

/** Edit one stored item as raw JSON (full power: fix ids, names, anything). */
function JsonEditModal({
  title,
  json,
  onSave,
  onClose,
}: {
  title: string
  json: unknown
  onSave: (parsed: unknown) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState(() => JSON.stringify(json, null, 2))
  const [error, setError] = useState<string | null>(null)

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      description={kk.dataJsonEditDesc}
      className="max-w-2xl"
    >
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setError(null)
        }}
        spellCheck={false}
        className="h-[45vh] w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed focus:ring-2 focus:ring-primary/40 focus:outline-none"
      />
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-2 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const blob = new Blob([text], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = title.replace(/[^\w.-]+/g, "_") + ".json"
            link.click()
            setTimeout(() => URL.revokeObjectURL(url), 2000)
          }}
          className="gap-1.5 text-xs"
        >
          <Download className="size-3.5" /> {kk.dataDownload}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {kk.cancel}
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              try {
                const parsed = JSON.parse(text)
                await onSave(parsed)
                onClose()
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
              }
            }}
          >
            {kk.save}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Manage everything that was imported: view, edit JSON, download and delete schedules, subjects, calendars. */
export function DataManageModal({
  isOpen,
  onClose,
  onDataChanged,
}: DataManageModalProps) {
  const [tab, setTab] = useState<Tab>("schedules")
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [calendars, setCalendars] = useState<AcadCalendar[]>([])
  const confirm = useConfirm()
  const [editing, setEditing] = useState<{
    title: string
    json: unknown
    save: (parsed: unknown) => Promise<void>
  } | null>(null)
  const [cloudOpen, setCloudOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    void (async () => {
      setSchedules(await getAllSchedules())
      setSubjects(await getAllSubjects())
      setCalendars(await getAllCalendars())
    })()
  }, [isOpen])

  const removeSchedule = async (schedule: Schedule) => {
    const ok = await confirm({
      title: kk.delete,
      description: kk.deleteScheduleConfirm(
        kk.courseNumber(schedule.course),
        kk.semesterNumber(schedule.semester)
      ),
      destructive: true,
    })
    if (!ok) return
    await deleteSchedule(schedule.course, schedule.semester)
    setSchedules((current) => current.filter((s) => s !== schedule))
    onDataChanged()
  }

  const removeSubject = async (subject: Subject) => {
    const ok = await confirm({
      title: kk.delete,
      description: kk.deleteNamedConfirm(subject.subject_name),
      destructive: true,
    })
    if (!ok) return
    await deleteSubject(subject.subject_id)
    setSubjects((current) => current.filter((s) => s !== subject))
    onDataChanged()
  }

  const removeCalendar = async (calendar: AcadCalendar) => {
    const ok = await confirm({
      title: kk.delete,
      description: kk.deleteCalendarConfirm(
        calendar.academic_year,
        kk.courseNumber(calendar.course)
      ),
      destructive: true,
    })
    if (!ok) return
    await deleteCalendar(calendar.course)
    setCalendars((current) => current.filter((c) => c !== calendar))
    onDataChanged()
  }

  const refresh = async () => {
    setSchedules(await getAllSchedules())
    setSubjects(await getAllSubjects())
    setCalendars(await getAllCalendars())
    onDataChanged()
  }

  const clearPlatonus = async () => {
    const ok = await confirm({
      title: kk.dataManage,
      description: kk.clearPlatonusConfirm,
      destructive: true,
    })
    if (!ok) return
    await clearPlatonusData()
    onDataChanged()
    onClose()
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "schedules", label: kk.calendar, count: schedules.length },
    { id: "subjects", label: kk.subjects, count: subjects.length },
    { id: "calendars", label: kk.academicYear, count: calendars.length },
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={kk.dataManage}
      description={kk.dataManageDesc}
      className="max-w-2xl"
    >
      <div className="mb-3 flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
        {tab === "schedules" &&
          schedules.map((schedule) => (
            <div
              key={`${schedule.course}-${schedule.semester}`}
              className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2"
            >
              <CalendarDays className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {kk.courseNumber(schedule.course)},{" "}
                {kk.semesterNumber(schedule.semester)}
              </span>
              <Badge
                variant="outline"
                className="shrink-0 px-1.5 py-0 text-[10px]"
              >
                {kk.lessonsCount(schedule.schedule.length)}
              </Badge>
              <button
                onClick={() =>
                  setEditing({
                    title: `schedule-${schedule.course}-${schedule.semester}`,
                    json: schedule,
                    save: async (parsed) => {
                      await saveSchedule(parsed as Schedule)
                      refresh()
                    },
                  })
                }
                className="-m-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-primary"
                title={kk.dataJsonEdit}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => void removeSchedule(schedule)}
                className="-m-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title={kk.delete}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}

        {tab === "subjects" &&
          subjects.map((subject) => (
            <div
              key={subject.subject_id}
              className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2"
            >
              <BookOpen className="size-4 shrink-0 text-primary" />
              <span
                className="min-w-0 flex-1 truncate text-xs font-medium"
                title={subject.subject_name}
              >
                {subject.subject_name}
              </span>
              <Badge
                variant="outline"
                className="shrink-0 px-1.5 py-0 text-[10px]"
              >
                {kk.courseShortN(subject.course)}{" "}
                {kk.semShortN(subject.semester)}
              </Badge>
              <button
                onClick={() =>
                  setEditing({
                    title: subject.subject_id,
                    json: subject,
                    save: async (parsed) => {
                      await saveSubject(parsed as Subject)
                      refresh()
                    },
                  })
                }
                className="-m-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-primary"
                title={kk.dataJsonEdit}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => void removeSubject(subject)}
                className="-m-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title={kk.delete}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}

        {tab === "calendars" &&
          calendars.map((calendar) => (
            <div
              key={calendar.course}
              className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2"
            >
              <Database className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {calendar.academic_year} · {kk.courseNumber(calendar.course)}
              </span>
              <button
                onClick={() =>
                  setEditing({
                    title: `acad_calendar-${calendar.course}`,
                    json: calendar,
                    save: async (parsed) => {
                      await saveCalendar(parsed as AcadCalendar)
                      refresh()
                    },
                  })
                }
                className="-m-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-primary"
                title={kk.dataJsonEdit}
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                onClick={() => void removeCalendar(calendar)}
                className="-m-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title={kk.delete}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}

        {((tab === "schedules" && schedules.length === 0) ||
          (tab === "subjects" && subjects.length === 0) ||
          (tab === "calendars" && calendars.length === 0)) && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {kk.emptyList}
          </p>
        )}
      </div>

      {/* Cloud sync: settings + manual push/pull in a nested modal */}
      <button
        onClick={() => setCloudOpen(true)}
        className="mt-4 flex w-full items-center gap-3 rounded-xl border border-border/70 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <Cloud className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium">{kk.cloudSync}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {kk.cloudSyncDesc}
          </span>
        </span>
      </button>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void clearPlatonus()}
          className="text-xs text-muted-foreground"
        >
          {kk.clearPlatonus}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          {kk.close}
        </Button>
      </div>
      {editing && (
        <JsonEditModal
          title={editing.title}
          json={editing.json}
          onSave={editing.save}
          onClose={() => setEditing(null)}
        />
      )}
      <CloudSyncModal isOpen={cloudOpen} onClose={() => setCloudOpen(false)} />
    </Modal>
  )
}
