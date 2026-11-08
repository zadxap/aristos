import React, { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { kk } from "@/i18n"
import { useAristosDB } from "@/context/DBContext"
import { saveSubject, saveSchedule, saveCalendar } from "@/lib/db"
import {
  isCanvasAssignment,
  isCanvasCourse,
  isCanvasSyncPayload,
} from "@/lib/canvas"
import { isPlatonusRecord } from "@/lib/platonus"
import type { AristosBackup } from "@/lib/backup"
import { restoreBackup } from "@/lib/backup"
import type {
  Subject,
  Schedule,
  AcadCalendar,
  ScheduleEntry,
  DayOfWeek,
} from "@/types"
import { UploadCloud, CheckCircle2, AlertCircle } from "lucide-react"

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
}

const DAYS = new Set<DayOfWeek>([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSubject(value: unknown): value is Subject {
  if (!isRecord(value)) return false
  return (
    typeof value.subject_id === "string" &&
    typeof value.subject_name === "string" &&
    typeof value.course === "number" &&
    typeof value.semester === "number" &&
    Array.isArray(value.topics) &&
    (value.pdfs === undefined ||
      (Array.isArray(value.pdfs) &&
        value.pdfs.every(
          (pdf) =>
            isRecord(pdf) &&
            typeof pdf.title === "string" &&
            typeof pdf.filename === "string" &&
            typeof pdf.url === "string"
        )))
  )
}

function isScheduleEntry(value: unknown): value is ScheduleEntry {
  if (!isRecord(value)) return false
  return (
    typeof value.day === "string" &&
    DAYS.has(value.day as DayOfWeek) &&
    typeof value.start === "string" &&
    typeof value.end === "string" &&
    typeof value.subject_name === "string" &&
    typeof value.subject_id === "string"
  )
}

function isSchedule(value: unknown): value is Schedule {
  if (!isRecord(value)) return false
  return (
    typeof value.course === "number" &&
    typeof value.semester === "number" &&
    Array.isArray(value.schedule) &&
    value.schedule.every(isScheduleEntry)
  )
}

function isCalendar(value: unknown): value is AcadCalendar {
  if (!isRecord(value)) return false
  return (
    typeof value.course === "number" &&
    typeof value.academic_year === "string" &&
    Array.isArray(value.semesters)
  )
}

function isBackup(value: unknown): value is AristosBackup {
  if (!isRecord(value)) return false
  if (
    value.format !== "aristos-backup" ||
    (value.version !== 1 && value.version !== 2 && value.version !== 3)
  )
    return false
  if (!Array.isArray(value.subjects) || !value.subjects.every(isSubject))
    return false
  if (!Array.isArray(value.schedules) || !value.schedules.every(isSchedule))
    return false
  if (!Array.isArray(value.calendars) || !value.calendars.every(isCalendar))
    return false
  if (
    !Array.isArray(value.settings) ||
    !value.settings.every(
      (setting) =>
        isRecord(setting) &&
        typeof setting.key === "string" &&
        "value" in setting
    )
  )
    return false
  // v2 sync sections are optional (absent in v1 backups); validated when present
  if (
    value.platonusYears !== undefined &&
    (!Array.isArray(value.platonusYears) ||
      !value.platonusYears.every(isPlatonusRecord))
  )
    return false
  if (
    value.canvasCourses !== undefined &&
    (!Array.isArray(value.canvasCourses) ||
      !value.canvasCourses.every(isCanvasCourse))
  )
    return false
  if (
    value.canvasAssignments !== undefined &&
    (!Array.isArray(value.canvasAssignments) ||
      !value.canvasAssignments.every(isCanvasAssignment))
  )
    return false
  return true
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { reloadData, syncCanvas } = useAristosDB()
  const [statusMsg, setStatusMsg] = useState<{
    text: string
    isError?: boolean
  } | null>(null)
  const [importing, setImporting] = useState(false)

  const importFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return

    setImporting(true)
    setStatusMsg(null)

    try {
      const parsedFiles: { name: string; data: unknown }[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.name.toLowerCase().endsWith(".json")) continue
        parsedFiles.push({
          name: file.name,
          data: JSON.parse(await file.text()) as unknown,
        })
      }

      if (!parsedFiles.length) throw new Error(kk.importNoFiles)

      let subjectCount = 0
      let scheduleCount = 0
      let calendarCount = 0
      let settingCount = 0
      let canvasCount: { courses: number; assignments: number } | null = null
      let platonusCount: number | null = null
      const backup =
        parsedFiles.length === 1 && isBackup(parsedFiles[0].data)
          ? parsedFiles[0].data
          : null

      if (backup) {
        await restoreBackup(backup)
        subjectCount = backup.subjects.length
        scheduleCount = backup.schedules.length
        calendarCount = backup.calendars.length
        settingCount = backup.settings.length
        platonusCount = backup.platonusYears?.length ?? null
        canvasCount = backup.canvasCourses
          ? {
              courses: backup.canvasCourses.length,
              assignments: backup.canvasAssignments?.length ?? 0,
            }
          : null
      } else {
        const items = parsedFiles.map(({ name, data }) => {
          if (isSubject(data)) return { kind: "subject" as const, data }
          if (isSchedule(data)) return { kind: "schedule" as const, data }
          if (isCalendar(data)) return { kind: "calendar" as const, data }
          if (isCanvasSyncPayload(data))
            return { kind: "canvas" as const, data }
          throw new Error(kk.importBadStructure(name))
        })

        for (const item of items) {
          if (item.kind === "subject") {
            await saveSubject(item.data)
            subjectCount++
          }
          if (item.kind === "schedule") {
            await saveSchedule(item.data)
            scheduleCount++
          }
          if (item.kind === "calendar") {
            await saveCalendar(item.data)
            calendarCount++
          }
          if (item.kind === "canvas") {
            await syncCanvas(item.data)
            canvasCount = {
              courses: item.data.courses.length,
              assignments: item.data.assignments.length,
            }
          }
        }
      }

      reloadData()
      const canvasText = canvasCount
        ? kk.importCanvasPart(canvasCount.courses, canvasCount.assignments)
        : ""
      const platonusText =
        platonusCount !== null ? kk.importPlatonusPart(platonusCount) : ""
      setStatusMsg({
        text: `${kk.importDone(subjectCount, scheduleCount, calendarCount, settingCount)}${canvasText}${platonusText} ${kk.importDoneSuffix}`,
      })
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : kk.importReadFail
      setStatusMsg({
        text: kk.importErrorPrefix(message),
        isError: true,
      })
    } finally {
      setImporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void importFiles(Array.from(e.target.files ?? []))
    // Allow choosing the same file again after fixing it.
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!importing) void importFiles(e.dataTransfer.files)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={kk.importData}
      description={kk.importDescription}
    >
      <div className="space-y-4">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-muted/20 p-6 text-center transition-colors hover:bg-muted/40"
        >
          <UploadCloud className="mb-2 size-10 text-primary" />
          <p className="mb-1 text-sm font-medium">{kk.importDropHint}</p>
          <p className="mb-4 text-xs text-muted-foreground">
            {kk.importDropKinds}
          </p>
          <label className="cursor-pointer">
            <span className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90">
              {importing ? kk.importingLabel : kk.importButton}
              <input
                type="file"
                multiple
                accept=".json"
                className="hidden"
                disabled={importing}
                onChange={handleFileChange}
              />
            </span>
          </label>
        </div>

        {statusMsg && (
          <div
            className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
              statusMsg.isError
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {statusMsg.isError ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {kk.close}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
