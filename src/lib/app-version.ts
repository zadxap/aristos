/** Версия приложения из tauri.conf.json (vite define, см. vite.config.ts) —
 *  единый источник для футера и раздела обновлений. */
export const APP_VERSION: string = __APP_VERSION__

/** Подставляет реальную версию в i18n-строку с плейсхолдером {v}
 *  (тот же паттерн, что и у updateAvailable). */
export function withVersion(label: string): string {
  return label.replace("{v}", APP_VERSION)
}
