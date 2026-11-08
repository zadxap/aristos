import type { PlatonusSyncPayload, PlatonusYearRecord } from '@/types'
import { clearPlatonusData, getAllPlatonusYears, savePlatonusYear } from './db'

export const PLATONUS_ORIGIN = 'https://platonus.yu.edu.kz'
export const PLATONUS_STORAGE_KEY = 'aristosPlatonusSync'

export interface PlatonusSyncMessage {
  type: 'aristos-platonus-sync'
  payload: PlatonusSyncPayload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlatonusSubject(value: unknown): boolean {
  if (!isRecord(value)) return false
  return typeof value.name === 'string' && typeof value.code === 'string' &&
    Array.isArray(value.marks) && value.marks.every((m) => isRecord(m) &&
      typeof m.code === 'string' && typeof m.date === 'string' && typeof m.mark === 'number')
}

export function isPlatonusRecord(value: unknown): value is PlatonusYearRecord {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && typeof value.year === 'number' &&
    typeof value.term === 'number' && typeof value.syncedAt === 'string' &&
    Array.isArray(value.subjects) && value.subjects.every(isPlatonusSubject)
}

export function isPlatonusSyncPayload(value: unknown): value is PlatonusSyncPayload {
  if (!isRecord(value)) return false
  return value.format === 'aristos-platonus-sync' && value.version === 1 &&
    typeof value.syncedAt === 'string' && Array.isArray(value.records) &&
    value.records.every(isPlatonusRecord)
}

export function isPlatonusSyncMessage(value: unknown): value is PlatonusSyncMessage {
  return isRecord(value) && value.type === 'aristos-platonus-sync' && isPlatonusSyncPayload(value.payload)
}

/** Upsert incoming records by year-term id (re-sync replaces the record wholesale). */
export async function applyPlatonusSync(payload: PlatonusSyncPayload): Promise<number> {
  for (const record of payload.records) {
    await savePlatonusYear(record)
  }
  return payload.records.length
}

export async function loadPlatonusYears(): Promise<PlatonusYearRecord[]> {
  return getAllPlatonusYears()
}

export { clearPlatonusData }
