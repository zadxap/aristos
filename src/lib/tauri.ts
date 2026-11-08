/** Детект Tauri-рантайма (нативная обёртка). На вебе/PWA всегда false.
 *  Признак — глобал, который инжектит tauri-инжектор в WebView. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

/** Tauri на мобильных (Android/iOS). Отличаем по user-agent WebView:
 *  на мобильных работает планирование нативных напоминаний и виджеты,
 *  на десктопе планирование игнорируется плагином (уведомление ушло бы
 *  сразу), поэтому там остаётся в-app агент (NotificationAgent). */
export function isTauriMobile(): boolean {
  if (!isTauri()) return false
  return /Android|iPhone|iPad/i.test(navigator.userAgent)
}
