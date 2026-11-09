/** Нативный синк Canvas/Платонус (только desktop-Tauri) — замена браузерного
 *  расширения. Механика: hidden/видимое webview-окно `harvest` (sync.rs) грузит
 *  внешний сайт; сюда инжектятся самодостаточные скрипты (src/lib/injected/*),
 *  которые делают same-origin fetch / DOM-harvest и отдают результат командой
 *  sync_payload → событие 'sync-payload' → здесь валидация и применение через
 *  useDB().syncCanvas/syncPlatonus (коллбэком из UI). Прогресс — машина-ключи
 *  для i18n, текст собирает SideMenu. */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import canvasCollectorSrc from './injected/canvas-collector.js?raw'
import platonusPageSrc from './injected/platonus-page.js?raw'
import { CANVAS_ORIGIN } from '@/lib/canvas'
import { PLATONUS_ORIGIN } from '@/lib/platonus'
import { isCanvasSyncPayload } from '@/lib/canvas'
import { isPlatonusSyncPayload } from '@/lib/platonus'
import { getSetting, saveSetting } from '@/lib/db'
import type { CanvasSyncPayload, PlatonusSyncPayload, PlatonusYearRecord } from '@/types'

export interface PlatonusPeriod {
  year: number
  term: number
}

type SyncMessage = { type: string; [key: string]: unknown }

export type SyncStage =
  | 'canvas-courses'
  | 'canvas-assignments'
  | 'canvas-login'
  | 'canvas-apply'
  | 'platonus-open'
  | 'platonus-login'
  | 'platonus-period'
  | 'platonus-marks'
  | 'platonus-apply'

// ---- канал сообщений из harvest-окна ----

let listenerStarted = false
const queue: SyncMessage[] = []
type Waiter = {
  match: (m: SyncMessage) => boolean
  resolve: (m: SyncMessage) => void
  reject: (e: Error) => void
  timer: number
}
const waiters: Waiter[] = []
let onProgress: ((m: SyncMessage) => void) | null = null

function startListener(): void {
  if (listenerStarted) return
  listenerStarted = true
  void listen<string>('sync-payload', (event) => {
    let msg: SyncMessage
    try {
      msg = JSON.parse(event.payload) as SyncMessage
    } catch {
      return
    }
    if (String(msg.type) === 'progress') {
      if (onProgress) onProgress(msg)
      return // прогресс мимолётен — не копим
    }
    const wi = waiters.findIndex((w) => w.match(msg))
    if (wi >= 0) {
      const [w] = waiters.splice(wi, 1)
      window.clearTimeout(w.timer)
      w.resolve(msg)
      return
    }
    queue.push(msg)
  })
}

function waitMessage(
  match: (m: SyncMessage) => boolean,
  timeoutMs: number
): Promise<SyncMessage> {
  startListener()
  return new Promise((resolve, reject) => {
    const qi = queue.findIndex(match)
    if (qi >= 0) {
      const [m] = queue.splice(qi, 1)
      resolve(m)
      return
    }
    const waiter: Waiter = {
      match,
      resolve,
      reject,
      timer: 0,
    }
    waiter.timer = window.setTimeout(() => {
      const wi = waiters.indexOf(waiter)
      if (wi >= 0) waiters.splice(wi, 1)
      reject(new Error('sync-timeout'))
    }, timeoutMs)
    waiters.push(waiter)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function driverScript(params: Record<string, unknown>): string {
  // Параметры подставляются ПЕРЕД телом драйвера — он читает
  // window.__ARISTOS_PARAMS__ на момент исполнения.
  return 'window.__ARISTOS_PARAMS__ = ' + JSON.stringify(params) + ';\n' + platonusPageSrc
}

let busy = false

export function isNativeSyncBusy(): boolean {
  return busy
}

async function withBusy<T>(fn: () => Promise<T>): Promise<T> {
  if (busy) throw new Error('sync-already-running')
  busy = true
  queue.length = 0
  try {
    return await fn()
  } finally {
    busy = false
    onProgress = null
  }
}

// ---- Canvas ----

export interface CanvasSyncFx {
  onStage: (stage: SyncStage) => void
  /** применить провалидированный payload (SideMenu передаёт useDB().syncCanvas) */
  apply: (payload: CanvasSyncPayload) => Promise<void>
}

const CANVAS_MESSAGE_TYPES = ['canvas', 'need-login', 'error']

async function runCanvasCollect(timeoutMs: number): Promise<CanvasSyncPayload> {
  await invoke('sync_open', { url: CANVAS_ORIGIN + '/', visible: false })
  await invoke('sync_eval', { js: canvasCollectorSrc })
  const msg = await waitMessage((m) => CANVAS_MESSAGE_TYPES.includes(String(m.type)), timeoutMs)
  return parseCanvasMessage(msg)
}

function parseCanvasMessage(msg: SyncMessage): CanvasSyncPayload {
  const type = String(msg.type)
  if (type === 'need-login') throw new Error('need-login')
  if (type === 'error') throw new Error(String(msg.message || 'canvas-sync-error'))
  const payload = JSON.parse(String(msg.json)) as CanvasSyncPayload
  if (!isCanvasSyncPayload(payload)) throw new Error('canvas-invalid-payload')
  return payload
}

export async function runCanvasSync(fx: CanvasSyncFx): Promise<{ courses: number; assignments: number }> {
  return withBusy(async () => {
    onProgress = (m) => {
      const stage = String(m.stage)
      if (stage === 'canvas-courses') fx.onStage('canvas-courses')
      if (stage === 'canvas-assignments') fx.onStage('canvas-assignments')
    }
    fx.onStage('canvas-courses')
    let payload: CanvasSyncPayload
    try {
      payload = await runCanvasCollect(120_000)
    } catch (err) {
      if (String((err as Error).message) !== 'need-login') throw err
      // окно логина: ждём выхода со страницы /login, потом ретрай
      fx.onStage('canvas-login')
      const ok = await ensureLogin(
        CANVAS_ORIGIN + '/login/canvas',
        (url) => !url.includes('/login')
      )
      if (!ok) throw new Error('login-timeout', { cause: err })
      fx.onStage('canvas-courses')
      payload = await runCanvasCollect(120_000)
    }
    fx.onStage('canvas-apply')
    await fx.apply(payload)
    await invoke('sync_close')
    return { courses: payload.courses.length, assignments: payload.assignments.length }
  })
}

// ---- Платонус ----

export interface PlatonusSyncFx {
  onStage: (stage: SyncStage) => void
  /** прогресс по карточкам внутри периода */
  onMarks: (year: number, term: number, idx: number, total: number) => void
  onPeriod: (idx: number, total: number, year: number, term: number) => void
  apply: (payload: PlatonusSyncPayload) => Promise<void>
}

const PLATONUS_MESSAGE_TYPES = [
  'platonus-discovered',
  'platonus-period',
  'need-login',
  'error',
]

/** Найти доступные периоды (studentID + годы/семестры). */
export async function discoverPlatonus(): Promise<{
  studentID: number
  periods: PlatonusPeriod[]
  previewCount: number
}> {
  return withBusy(async () => {
    fxBindProgress(null)
    for (let attempt = 0; attempt < 2; attempt++) {
      await invoke('sync_open', { url: PLATONUS_ORIGIN + '/student_register', visible: false })
      await invoke('sync_eval', { js: driverScript({ mode: 'discover' }) })
      const msg = await waitMessage(
        (m) => PLATONUS_MESSAGE_TYPES.includes(String(m.type)),
        90_000
      )
      const type = String(msg.type)
      if (type === 'need-login') {
        const ok = await ensurePlatonusLogin()
        if (!ok) throw new Error('login-timeout')
        continue
      }
      if (type === 'error') throw new Error(String(msg.message || 'platonus-error'))
      const studentID = Number(msg.studentID)
      const periods = (msg.periods as PlatonusPeriod[]) || []
      if (!Number.isFinite(studentID) || periods.length === 0) {
        throw new Error('platonus-no-periods')
      }
      await saveSetting('platonusStudentID', studentID)
      await invoke('sync_close')
      return {
        studentID,
        periods,
        previewCount: Number(msg.previewCount) || 0,
      }
    }
    throw new Error('platonus-no-periods')
  })
}

function fxBindProgress(fx: PlatonusSyncFx | null): void {
  onProgress = fx
    ? (m) => {
        const stage = String(m.stage)
        if (stage === 'platonus-marks') {
          fx.onMarks(Number(m.year), Number(m.term), Number(m.idx), Number(m.total))
        }
      }
    : null
}

/** Импорт выбранных периодов (оценки по дням собираются кликом по карточкам). */
export async function runPlatonusSync(
  periods: PlatonusPeriod[],
  fx: PlatonusSyncFx
): Promise<number> {
  return withBusy(async () => {
    fxBindProgress(fx)
    let studentID = await getSetting<number | null>('platonusStudentID', null)
    if (!Number.isFinite(studentID as number)) {
      // студентID неизвестен — тихо прогоняем discover
      const discovered = await discoverPlatonusUnsafe()
      studentID = discovered.studentID
    }

    const records: PlatonusYearRecord[] = []
    for (let i = 0; i < periods.length; i++) {
      const { year, term } = periods[i]
      fx.onPeriod(i + 1, periods.length, year, term)
      fx.onStage('platonus-period')
      await invoke('sync_open', {
        url:
          PLATONUS_ORIGIN +
          '/student_register?studentID=' +
          String(studentID) +
          '&year=' +
          String(year) +
          '&term=' +
          String(term),
        visible: false,
      })
      await invoke('sync_eval', { js: driverScript({ mode: 'harvest', year, term }) })
      const msg = await waitMessage(
        (m) => PLATONUS_MESSAGE_TYPES.includes(String(m.type)),
        15 * 60_000
      )
      const type = String(msg.type)
      if (type === 'need-login') {
        const ok = await ensurePlatonusLogin()
        if (!ok) throw new Error('login-timeout')
        i-- // переигрываем этот же период после входа
        continue
      }
      if (type === 'error') throw new Error(String(msg.message || 'platonus-error'))
      const record = msg.record as PlatonusYearRecord
      records.push(record)
    }

    if (records.length === 0) throw new Error('platonus-empty')
    const payload: PlatonusSyncPayload = {
      format: 'aristos-platonus-sync',
      version: 1,
      syncedAt: new Date().toISOString(),
      records,
    }
    if (!isPlatonusSyncPayload(payload)) throw new Error('platonus-invalid-payload')
    fx.onStage('platonus-apply')
    await fx.apply(payload)
    await invoke('sync_close')
    return records.length
  })
}

/** discover без собственного busy-гейта (вызывается изнутри runPlatonusSync). */
async function discoverPlatonusUnsafe(): Promise<{
  studentID: number
  periods: PlatonusPeriod[]
}> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await invoke('sync_open', { url: PLATONUS_ORIGIN + '/student_register', visible: false })
    await invoke('sync_eval', { js: driverScript({ mode: 'discover' }) })
    const msg = await waitMessage(
      (m) => PLATONUS_MESSAGE_TYPES.includes(String(m.type)),
      90_000
    )
    const type = String(msg.type)
    if (type === 'need-login') {
      const ok = await ensurePlatonusLogin()
      if (!ok) throw new Error('login-timeout')
      continue
    }
    if (type === 'error') throw new Error(String(msg.message || 'platonus-error'))
    const studentID = Number(msg.studentID)
    if (!Number.isFinite(studentID)) throw new Error('platonus-no-periods')
    await saveSetting('platonusStudentID', studentID)
    return { studentID, periods: (msg.periods as PlatonusPeriod[]) || [] }
  }
  throw new Error('platonus-no-periods')
}

// ---- логин ----

/** Видимое окно логина + поллинг URL до ухода со страницы входа. */
async function ensureLogin(
  loginUrl: string,
  isDone: (url: string) => boolean
): Promise<boolean> {
  await invoke('sync_open', { url: loginUrl, visible: true })
  const deadline = Date.now() + 6 * 60_000
  let stableSeen = false
  while (Date.now() < deadline) {
    await sleep(1500)
    const url = String(await invoke<string>('sync_url'))
    if (isDone(url)) {
      // SSO-редиректы мигают промежуточными адресами — ждём два стабильных опроса
      if (stableSeen) {
        await invoke('sync_close')
        return true
      }
      stableSeen = true
      continue
    }
    stableSeen = false
  }
  await invoke('sync_close')
  return false
}

async function ensurePlatonusLogin(): Promise<boolean> {
  // SSO: platonus уводит на id.yu.edu.kz; вход завершён, когда вернулись на
  // platonus.yu.edu.kz вне страницы входа
  return ensureLogin(PLATONUS_ORIGIN + '/', (url) => {
    const u = url.toLowerCase()
    return (
      u.includes('platonus.yu.edu.kz') &&
      !u.includes('id.yu.edu.kz') &&
      !u.includes('login') &&
      !u.includes('oauth')
    )
  })
}
