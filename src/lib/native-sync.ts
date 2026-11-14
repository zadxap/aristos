/** Нативный синк Canvas/Платонус (только desktop-Tauri) — замена браузерного
 *  расширения.
 *  Canvas: БЕЗ инжекта и IPC — сессия берётся из cookie-jar webview
 *  (canvas_session_state / canvas_sync_native на Rust, reqwest с Cookie +
 *  X-CSRF-Token). Нет/истекла сессия → видимому окну логина, куки персистентны.
 *  Платонус: скрытое окно + инжект-драйвер (page-side DOM harvest), результат
 *  — через канал заголовка окна (ARISTOS_D|idx|total|chunk) с подтверждением
 *  чтения: eval-ом хост ставит window.__ARISTOS_ACK. Работает независимо от
 *  remote-IPC. Применение — существующие useDB().syncCanvas/syncPlatonus. */

import { invoke } from '@tauri-apps/api/core'
import { CANVAS_ORIGIN } from '@/lib/canvas'
import { isCanvasSyncPayload } from '@/lib/canvas'
import { PLATONUS_ORIGIN } from '@/lib/platonus'
import { isPlatonusSyncPayload } from '@/lib/platonus'
import { getSetting, saveSetting } from '@/lib/db'
import platonusPageSrc from './injected/platonus-page.js?raw'
import type {
  CanvasSyncPayload,
  PlatonusSyncPayload,
  PlatonusYearRecord,
} from '@/types'

export interface PlatonusPeriod {
  year: number
  term: number
}

type SyncMessage = { type: string; [key: string]: unknown }

export type SyncStage =
  | 'canvas-courses'
  | 'canvas-login'
  | 'canvas-apply'
  | 'platonus-login'
  | 'platonus-period'
  | 'platonus-marks'
  | 'platonus-apply'

let busy = false

export function isNativeSyncBusy(): boolean {
  return busy
}

async function withBusy<T>(fn: () => Promise<T>): Promise<T> {
  if (busy) throw new Error('sync-already-running')
  busy = true
  try {
    return await fn()
  } finally {
    busy = false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface HarvestDiag {
  url: string
  title: string
}

function isNeedLogin(err: unknown): boolean {
  return String((err as Error)?.message || err).includes('need-login')
}

// ---- Canvas (нативно: куки webview + reqwest на Rust) ----

export interface CanvasSyncFx {
  onStage: (stage: SyncStage) => void
  /** применить провалидированный payload (SideMenu передаёт useDB().syncCanvas) */
  apply: (payload: CanvasSyncPayload) => Promise<void>
}

/** Окно логина + поллинг сессии по кукам (появился _csrf_token + API отвечает). */
async function ensureCanvasSession(): Promise<boolean> {
  await invoke('sync_open', {
    url: CANVAS_ORIGIN + '/login/canvas',
    visible: true,
  })
  // авто-диагностика: лог окна синка уходит на воркер при каждом открытии
  // логина (только URL/события окна, без кук) — разработчик читает сам
  void invoke('sync_upload_diag').catch(() => {})
  const deadline = Date.now() + 6 * 60_000
  while (Date.now() < deadline) {
    await sleep(1500)
    const st = await invoke<{ hasSession: boolean }>('canvas_session_state').catch(
      () => null
    )
    if (st?.hasSession) {
      await invoke('sync_close')
      return true
    }
  }
  await invoke('sync_close')
  return false
}

export interface CanvasSyncResult {
  courses: number
  assignments: number
  /** «мягкий» сбой баллов курсов (ретраи исчерпаны) — причина для UI */
  scoresDiag: string
}

export async function runCanvasSync(fx: CanvasSyncFx): Promise<CanvasSyncResult> {
  return withBusy(async () => {
    fx.onStage('canvas-courses')
    // превентивная проверка сессии: если мертва — сразу окно логина,
    // а не «спиннер до 401»
    const st = await invoke<{ hasSession: boolean | null }>(
      'canvas_session_state'
    ).catch(() => null)
    if (st && st.hasSession === false) {
      fx.onStage('canvas-login')
      const ok = await ensureCanvasSession()
      if (!ok) throw new Error('login-timeout')
      fx.onStage('canvas-courses')
    }

    let wrapped: {
      data: CanvasSyncPayload
      scoresMissing: boolean
      scoresDiag: string
    }
    try {
      wrapped = await invoke('canvas_sync_native')
    } catch (err) {
      void invoke('sync_upload_diag').catch(() => {})
      if (!isNeedLogin(err)) throw err
      // сессия умерла прямо во время синка — окно логина и повтор
      fx.onStage('canvas-login')
      const ok = await ensureCanvasSession()
      if (!ok) throw new Error('login-timeout', { cause: err })
      fx.onStage('canvas-courses')
      wrapped = await invoke('canvas_sync_native')
    }

    const payload = wrapped.data
    payload.syncedAt = new Date().toISOString()
    if (!isCanvasSyncPayload(payload)) throw new Error('canvas-invalid-payload')
    fx.onStage('canvas-apply')
    await fx.apply(payload)
    return {
      courses: payload.courses.length,
      assignments: payload.assignments.length,
      scoresDiag: wrapped.scoresMissing ? wrapped.scoresDiag : '',
    }
  })
}

// ---- Платонус (инжект-драйвер + title-канал) ----

export interface PlatonusSyncFx {
  onStage: (stage: SyncStage) => void
  /** прогресс по карточкам внутри периода */
  onMarks: (year: number, term: number, idx: number, total: number) => void
  onPeriod: (idx: number, total: number, year: number, term: number) => void
  apply: (payload: PlatonusSyncPayload) => Promise<void>
}

/** Читает title harvest-окна и собирает сообщение из чанков
 *  ARISTOS_D|idx|total|chunk. Подтверждает чтение через eval
 *  (window.__ARISTOS_ACK), чтобы драйвер переходил к следующему чанку. */
async function waitPlatonusMessage(
  match: (m: SyncMessage) => boolean,
  timeoutMs: number,
  onProgress: ((m: SyncMessage) => void) | null = null
): Promise<SyncMessage> {
  const deadline = Date.now() + timeoutMs
  let lastTitle = ''
  let parts = new Map<number, string>()
  let total: number
  while (Date.now() < deadline) {
    await sleep(350)
    const diag = await invoke<HarvestDiag>('sync_diag').catch(() => null)
    if (!diag || !diag.url) continue
    const t = diag.title
    if (t === lastTitle) continue
    lastTitle = t
    if (t.startsWith('ARISTOS_E|')) throw new Error(t)
    if (!t.startsWith('ARISTOS_D|')) continue
    const rest = t.slice('ARISTOS_D|'.length)
    const sep1 = rest.indexOf('|')
    if (sep1 < 0) continue
    const idx = parseInt(rest.slice(0, sep1), 10)
    const rest2 = rest.slice(sep1 + 1)
    const sep2 = rest2.indexOf('|')
    if (sep2 < 0) continue
    const chunkTotal = parseInt(rest2.slice(0, sep2), 10)
    const chunk = rest2.slice(sep2 + 1)
    if (!Number.isFinite(idx) || !Number.isFinite(chunkTotal)) continue
    parts.set(idx, chunk)
    total = chunkTotal
    // подтверждаем чтение — драйвер переходит к следующему чанку
    void invoke('sync_eval', { js: `window.__ARISTOS_ACK=${idx + 1}` }).catch(
      () => {}
    )
    if (total > 0 && parts.size === total) {
      const full = [...parts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, c]) => c)
        .join('')
      parts = new Map()
      lastTitle = ''
      let msg: SyncMessage
      try {
        msg = JSON.parse(full) as SyncMessage
      } catch {
        continue
      }
      if (match(msg)) return msg
      if (String(msg.type) === 'progress' && onProgress) onProgress(msg)
    }
  }
  throw new Error('sync-timeout')
}

function driverScript(params: Record<string, unknown>): string {
  // Параметры подставляются ПЕРЕД телом драйвера — он читает
  // window.__ARISTOS_PARAMS__ на момент исполнения.
  return 'window.__ARISTOS_PARAMS__ = ' + JSON.stringify(params) + ';\n' + platonusPageSrc
}

export interface PlatonusDiscoverResult {
  studentID: number
  periods: PlatonusPeriod[]
  previewCount: number
}

const PLATONUS_TYPES = [
  'platonus-discovered',
  'platonus-period',
  'need-login',
  'error',
]

async function discoverPlatonusOnce(): Promise<PlatonusDiscoverResult> {
  await invoke('sync_open', {
    url: PLATONUS_ORIGIN + '/student_register',
    visible: false,
  })
  await invoke('sync_eval', { js: driverScript({ mode: 'discover' }) })
  const msg = await waitPlatonusMessage(
    (m) => PLATONUS_TYPES.includes(String(m.type)),
    120_000
  )
  const type = String(msg.type)
  if (type === 'need-login') throw new Error('need-login')
  if (type === 'error') throw new Error(String(msg.message || 'platonus-error'))
  const studentID = Number(msg.studentID)
  const periods = (msg.periods as PlatonusPeriod[]) || []
  if (!Number.isFinite(studentID) || periods.length === 0) {
    throw new Error('platonus-no-periods')
  }
  await saveSetting('platonusStudentID', studentID)
  return { studentID, periods, previewCount: Number(msg.previewCount) || 0 }
}

export async function discoverPlatonus(): Promise<PlatonusDiscoverResult> {
  return withBusy(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await discoverPlatonusOnce()
        await invoke('sync_close')
        return res
      } catch (err) {
        if (!isNeedLogin(err)) throw err
        const ok = await ensurePlatonusLogin()
        if (!ok) throw new Error('login-timeout', { cause: err })
      }
    }
    throw new Error('platonus-no-periods')
  })
}

/** Видимое окно логина Платонуса (SSO через id.yu.edu.kz) + поллинг URL. */
async function ensurePlatonusLogin(): Promise<boolean> {
  await invoke('sync_open', { url: PLATONUS_ORIGIN + '/', visible: true })
  void invoke('sync_upload_diag').catch(() => {})
  const deadline = Date.now() + 6 * 60_000
  let stableSeen = false
  while (Date.now() < deadline) {
    await sleep(1500)
    const url = String(await invoke<string>('sync_url').catch(() => ''))
    const u = url.toLowerCase()
    const done =
      u.includes('platonus.yu.edu.kz') &&
      !u.includes('id.yu.edu.kz') &&
      !u.includes('login') &&
      !u.includes('oauth')
    if (done) {
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

/** Импорт выбранных периодов (оценки по дням собираются кликом по карточкам). */
export async function runPlatonusSync(
  periods: PlatonusPeriod[],
  fx: PlatonusSyncFx
): Promise<number> {
  return withBusy(async () => {
    let studentID = await getSetting<number | null>('platonusStudentID', null)
    if (!Number.isFinite(studentID as number)) {
      const discovered = await discoverPlatonus()
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
      const msg = await waitPlatonusMessage(
        (m) => PLATONUS_TYPES.includes(String(m.type)),
        20 * 60_000,
        (m) => {
          if (String(m.stage) === 'platonus-marks') {
            fx.onMarks(Number(m.year), Number(m.term), Number(m.idx), Number(m.total))
          }
        }
      )
      const type = String(msg.type)
      if (type === 'need-login') {
        const ok = await ensurePlatonusLogin()
        if (!ok) throw new Error('login-timeout')
        i-- // переигрываем этот же период после входа
        continue
      }
      if (type === 'error') throw new Error(String(msg.message || 'platonus-error'))
      records.push(msg.record as PlatonusYearRecord)
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
