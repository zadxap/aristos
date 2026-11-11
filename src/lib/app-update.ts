/** Канал обновлений приложения.
 *  Android: воркер отдаёт {version, apkUrl} — сравниваем, скачиваем APK в
 *  кеш приложения (Rust) и открываем системный установщик напрямую
 *  (UpdaterPlugin → FileProvider); подпись стабильная — ставится поверх.
 *  Desktop: официальный tauri-plugin-updater — проверка по latest.json на
 *  воркере, подпись minisign; downloadAndInstall + relaunch. */

import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { openUrl } from '@tauri-apps/plugin-opener'
import { isTauri, isTauriMobile } from '@/lib/tauri'
import { DEFAULT_CLOUD_ENDPOINT } from '@/lib/cloud'

export interface AppUpdateInfo {
  /** новая версия */
  version: string
  /** только на мобильном: прямая ссылка на APK в воркере */
  apkUrl?: string
}

function isNewer(next: string, current: string): boolean {
  const pa = next.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = current.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d > 0
  }
  return false
}

/** Проверить обновление; null = актуальная версия / канал недоступен. */
export async function checkAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!isTauri()) return null
  let current: string
  try {
    current = await getVersion()
  } catch {
    return null
  }
  if (isTauriMobile()) {
    try {
      const res = await fetch(`${DEFAULT_CLOUD_ENDPOINT}/api/app/latest`)
      if (!res.ok) return null
      const data = (await res.json()) as {
        found?: boolean
        version?: string
        apkUrl?: string | null
      }
      if (
        data?.found &&
        typeof data.version === 'string' &&
        typeof data.apkUrl === 'string' &&
        isNewer(data.version, current)
      ) {
        return { version: data.version, apkUrl: data.apkUrl }
      }
    } catch {
      return null
    }
    return null
  }
  // desktop: официальный updater (endpoint и pubkey — в tauri.conf.json)
  try {
    const update = await check()
    if (update && isNewer(update.version, current)) {
      return { version: update.version }
    }
  } catch {
    return null // канал ещё пуст (404) или офлайн
  }
  return null
}

/** Desktop: скачать (с проверкой подписи), установить и перезапустить. */
export async function installDesktopUpdate(): Promise<void> {
  const update = await check()
  if (!update) return
  await update.downloadAndInstall()
  await relaunch()
}

/** Mobile: скачать APK в кеш приложения (download_update, reqwest в Rust) и
 *  вызвать системный установщик напрямую (install_apk → UpdaterPlugin →
 *  FileProvider content:// URI). Фоллбек на браузер — если прямой путь
 *  не сработал (нестандартные оболочки, нет установщика). */
export async function installAndroidUpdate(
  apkUrl: string
): Promise<"install-started" | "need-permission" | "fallback-browser"> {
  try {
    const path = await invoke<string>("download_update", { url: apkUrl })
    const res = await invoke<{ status?: string } | null>("install_apk", { path })
    if (res?.status === "need-permission") return "need-permission"
    return "install-started"
  } catch {
    await openUrl(apkUrl)
    return "fallback-browser"
  }
}

export async function currentAppVersion(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    return await getVersion()
  } catch {
    return null
  }
}
