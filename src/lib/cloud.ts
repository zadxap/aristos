import {
  backupSummary,
  createBackup,
  type AristosBackup,
  type BackupSummary,
} from "@/lib/backup"
import { getSetting, saveSetting } from "@/lib/db"

// Облачная синхронизация: «аккаунт» — случайный код (ARISTOS-XXXX-XXXX-XXXX),
// E2E-шифрование AES-GCM с ключом из passphrase (PBKDF2). Воркер хранит только
// шифробайты. Доступ к БД — только через getSetting/saveSetting и createBackup.

export interface CloudConfig {
  endpoint: string
  code: string
  passphrase: string
  autoPush: boolean
  autoPull: boolean
  lastPush: string | null
  lastPull: string | null
}

export type PushResult =
  | { status: "ok"; updatedAt: string; counts: BackupSummary }
  | { status: "conflict"; serverUpdatedAt: string }
  | { status: "error"; message: string }

export type PullResult =
  | { status: "ok"; backup: AristosBackup; updatedAt: string | null }
  | { status: "empty" }
  | { status: "bad-passphrase" }
  | { status: "error"; message: string }

// ---- код синхронизации ----

// 32 символа без похожих (0/O/1/I): 32 = 2^5, поэтому byte % 32 даёт
// равномерное распределение без отбраковки.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateSyncCode(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const chars = Array.from(
    bytes,
    (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]
  )
  return `ARISTOS-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`
}

// ---- шифрование ----

/** AES-GCM 256, ключ из passphrase: PBKDF2 SHA-256, 250000 итераций, salt = `aristos:${code}`. */
async function deriveKey(code: string, passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(`aristos:${code}`),
      iterations: 250_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

/** JSON → AES-GCM; формат: [12-байтный IV][шифротекст]. */
async function encryptJSON(
  value: unknown,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  )
  const packed = new Uint8Array(iv.length + ciphertext.length)
  packed.set(iv, 0)
  packed.set(ciphertext, iv.length)
  return packed.buffer
}

// ---- base64 (чанками: apply со спредом на 25 МБ падает по стеку) ----

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const CHUNK = 0x8000
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK))
  }
  return btoa(binary)
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

// ---- лёгкая структурная валидация бекапа ----

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** После расшифровки проверяем форму (полная валидация — при восстановлении/импорте). */
function isBackupLike(value: unknown): value is AristosBackup {
  if (!isRecord(value)) return false
  if (
    value.format !== "aristos-backup" ||
    (value.version !== 1 && value.version !== 2 && value.version !== 3)
  )
    return false
  if (typeof value.exportedAt !== "string") return false
  return (
    Array.isArray(value.subjects) &&
    Array.isArray(value.schedules) &&
    Array.isArray(value.calendars) &&
    Array.isArray(value.settings)
  )
}

// ---- настройки ----

/**
 * Дефолтный синк-воркер, деплоится один раз владельцем приложения.
 * Юзерам знать его не нужно — в настройках можно переопределить своим.
 */
export const DEFAULT_CLOUD_ENDPOINT =
  "https://aristos-sync.aristoss.workers.dev"

export async function getCloudConfig(): Promise<CloudConfig> {
  const [endpoint, code, passphrase, autoPush, autoPull, lastPush, lastPull] =
    await Promise.all([
      getSetting<string>("cloudEndpoint", DEFAULT_CLOUD_ENDPOINT),
      getSetting<string>("cloudCode", ""),
      getSetting<string>("cloudPassphrase", ""),
      getSetting<boolean>("cloudAutoPush", false),
      getSetting<boolean>("cloudAutoPull", false),
      getSetting<string | null>("cloudLastPush", null),
      getSetting<string | null>("cloudLastPull", null),
    ])
  return { endpoint, code, passphrase, autoPush, autoPull, lastPush, lastPull }
}

export function isCloudConfigured(config: CloudConfig): boolean {
  return (
    config.endpoint.trim() !== "" &&
    config.code.trim() !== "" &&
    config.passphrase !== ""
  )
}

function syncUrl(endpoint: string, code: string): string {
  return `${endpoint.trim().replace(/\/+$/, "")}/api/sync/${encodeURIComponent(code.trim())}`
}

// ---- push / pull ----

/**
 * Полный бекап → шифрование → PUT. Перед записью сверяется с серверной
 * updatedAt: если там новее, чем наш cloudLastPush (или наш cloudLastPush
 * пуст, а на сервере уже есть данные) — {status:'conflict'}, PUT делает
 * только вызывающий код после подтверждения (force = true).
 */
export async function pushToCloud(
  endpoint: string,
  code: string,
  passphrase: string,
  force = false
): Promise<PushResult> {
  const url = syncUrl(endpoint, code)
  try {
    const key = await deriveKey(code, passphrase)
    const backup = await createBackup()
    const payload = bufferToBase64(await encryptJSON(backup, key))
    const lastPush = await getSetting<string | null>("cloudLastPush", null)

    let serverUpdatedAt: string | null = null
    const current = await fetch(url, {
      headers: { Accept: "application/json" },
    })
    if (current.ok) {
      const body = (await current.json()) as {
        found?: unknown
        updatedAt?: unknown
      }
      if (body.found === true && typeof body.updatedAt === "string")
        serverUpdatedAt = body.updatedAt
    } else if (current.status !== 404) {
      return { status: "error", message: `GET /api/sync → ${current.status}` }
    }
    if (
      !force &&
      serverUpdatedAt !== null &&
      (!lastPush || serverUpdatedAt > lastPush)
    ) {
      return { status: "conflict", serverUpdatedAt }
    }

    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payload }),
    })
    if (!response.ok)
      return { status: "error", message: `PUT /api/sync → ${response.status}` }
    const body = (await response.json()) as {
      ok?: unknown
      updatedAt?: unknown
    }
    if (body.ok !== true || typeof body.updatedAt !== "string") {
      return { status: "error", message: "Неожиданный ответ сервера" }
    }
    await saveSetting("cloudLastPush", body.updatedAt)
    return {
      status: "ok",
      updatedAt: body.updatedAt,
      counts: backupSummary(backup),
    }
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * GET → расшифровка → лёгкая валидация. 404/нет данных → 'empty';
 * ошибка расшифровки или структуры → 'bad-passphrase' (другой ключ даёт
 * мусор, который не проходит ни GCM-проверку, ни валидацию бекапа).
 * Восстановлением (restoreBackup + reloadData) занимается вызывающий код.
 */
export async function pullFromCloud(
  endpoint: string,
  code: string,
  passphrase: string
): Promise<PullResult> {
  const url = syncUrl(endpoint, code)
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    })
    if (response.status === 404) return { status: "empty" }
    if (!response.ok)
      return { status: "error", message: `GET /api/sync → ${response.status}` }
    const body = (await response.json()) as {
      found?: unknown
      updatedAt?: unknown
      data?: unknown
    }
    if (
      body.found !== true ||
      typeof body.data !== "string" ||
      body.data.length === 0
    ) {
      return { status: "empty" }
    }
    const updatedAt = typeof body.updatedAt === "string" ? body.updatedAt : null

    let parsed: unknown
    try {
      const key = await deriveKey(code, passphrase)
      const packed = base64ToBuffer(body.data)
      const iv = new Uint8Array(packed, 0, 12)
      const ciphertext = new Uint8Array(packed, 12)
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext
      )
      parsed = JSON.parse(new TextDecoder().decode(plaintext))
    } catch {
      return { status: "bad-passphrase" }
    }
    if (!isBackupLike(parsed)) return { status: "bad-passphrase" }
    return { status: "ok", backup: parsed, updatedAt }
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
