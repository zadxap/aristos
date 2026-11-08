import { getDB } from "./db"
import type {
  AcadCalendar,
  CanvasAssignment,
  CanvasCourse,
  PlatonusYearRecord,
  Schedule,
  Subject,
} from "@/types"
import {
  loadGpaRows,
  loadGpaScale,
  saveGpaRows,
  saveGpaScale,
} from "@/components/gpa/gpa-storage"
import type { GpaRow, GpaScaleTier } from "@/components/gpa/gpa-scale"

export interface AristosBackup {
  format: "aristos-backup"
  /** v1: subjects/schedules/calendars/settings. v2 adds the sync-derived stores.
   *  v3 adds the GPA calculator state (localStorage, вне IndexedDB). */
  version: 3
  exportedAt: string
  subjects: Subject[]
  schedules: Schedule[]
  calendars: AcadCalendar[]
  platonusYears?: PlatonusYearRecord[]
  canvasCourses?: CanvasCourse[]
  canvasAssignments?: CanvasAssignment[]
  gpaRows?: GpaRow[]
  gpaScale?: GpaScaleTier[]
  settings: { key: string; value: unknown }[]
}

export async function createBackup(): Promise<AristosBackup> {
  const db = await getDB()
  const settingKeys = await db.getAllKeys("settings")
  const settingValues = await db.getAll("settings")

  return {
    format: "aristos-backup",
    version: 3,
    exportedAt: new Date().toISOString(),
    subjects: await db.getAll("subjects"),
    schedules: await db.getAll("schedules"),
    calendars: await db.getAll("calendars"),
    platonusYears: await db.getAll("platonusYears"),
    canvasCourses: await db.getAll("canvasCourses"),
    canvasAssignments: await db.getAll("canvasAssignments"),
    gpaRows: loadGpaRows() ?? undefined,
    gpaScale: loadGpaScale() ?? undefined,
    settings: settingKeys.map((key, index) => ({
      key: String(key),
      value: settingValues[index],
    })),
  }
}

export interface BackupSummary {
  subjects: number
  schedules: number
  calendars: number
  canvasCourses: number
  canvasAssignments: number
  platonus: number
  activeCourse: number
}

/** Что лежит в бекапе — для показа юзеру при push/pull. */
export function backupSummary(backup: AristosBackup): BackupSummary {
  return {
    subjects: backup.subjects.length,
    schedules: backup.schedules.length,
    calendars: backup.calendars.length,
    canvasCourses: backup.canvasCourses?.length ?? 0,
    canvasAssignments: backup.canvasAssignments?.length ?? 0,
    platonus: backup.platonusYears?.length ?? 0,
    activeCourse:
      (backup.settings.find((s) => s.key === "activeCourse")?.value as
        number | undefined) ?? 0,
  }
}

/**
 * Restore a backup as one transaction, replacing the current local data.
 * v2 sections replace their stores only when present in the file — v1 backups
 * predate them, so their absence must not wipe locally synced data.
 */
export async function restoreBackup(backup: AristosBackup): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(
    [
      "subjects",
      "schedules",
      "calendars",
      "settings",
      "canvasCourses",
      "canvasAssignments",
      "platonusYears",
    ],
    "readwrite"
  )

  const ops: Promise<unknown>[] = [
    tx.objectStore("subjects").clear(),
    tx.objectStore("schedules").clear(),
    tx.objectStore("calendars").clear(),
    tx.objectStore("settings").clear(),
  ]
  if (backup.platonusYears) ops.push(tx.objectStore("platonusYears").clear())
  if (backup.canvasCourses) ops.push(tx.objectStore("canvasCourses").clear())
  if (backup.canvasAssignments)
    ops.push(tx.objectStore("canvasAssignments").clear())

  ops.push(
    ...backup.subjects.map((item) => tx.objectStore("subjects").put(item)),
    ...backup.schedules.map((item) =>
      tx.objectStore("schedules").put(item, `${item.course}-${item.semester}`)
    ),
    ...backup.calendars.map((item) =>
      tx.objectStore("calendars").put(item, item.course)
    ),
    ...backup.settings.map((item) =>
      tx.objectStore("settings").put(item.value, item.key)
    )
  )
  if (backup.platonusYears)
    ops.push(
      ...backup.platonusYears.map((item) =>
        tx.objectStore("platonusYears").put(item)
      )
    )
  if (backup.canvasCourses)
    ops.push(
      ...backup.canvasCourses.map((item) =>
        tx.objectStore("canvasCourses").put(item)
      )
    )
  if (backup.canvasAssignments) {
    ops.push(
      ...backup.canvasAssignments.map((item) =>
        tx.objectStore("canvasAssignments").put(item)
      )
    )
  }

  await Promise.all(ops)
  await tx.done

  // GPA живёт в localStorage, вне IndexedDB — восстанавливаем только если
  // секция есть в файле: старые бекапы (v1/v2) не должны стирать локальный GPA.
  if (Array.isArray(backup.gpaRows) && backup.gpaRows.length > 0) {
    saveGpaRows(backup.gpaRows)
  }
  if (Array.isArray(backup.gpaScale) && backup.gpaScale.length > 0) {
    saveGpaScale(backup.gpaScale)
  }
}
