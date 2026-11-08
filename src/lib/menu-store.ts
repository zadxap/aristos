/**
 * Глобальное состояние бургер-панели — ВНЕ React-дерева.
 * Смена языка перемонтирует поддерево (key={lang} в LangProvider), и любой
 * локальный useState в AppLayout сбрасывается — поэтому меню закрывалось при
 * переключении языка. useSyncExternalStore переживает ремонт.
 */
let menuOpen = false
const listeners = new Set<() => void>()

export const sideMenuStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get(): boolean {
    return menuOpen
  },
  set(value: boolean): void {
    if (menuOpen === value) return
    menuOpen = value
    listeners.forEach((listener) => listener())
  },
}
