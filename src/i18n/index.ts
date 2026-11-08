/**
 * i18n runtime: язык «в модуле» + Proxy-экспорт `kk`.
 *
 * Все существующие `import { kk } from '@/i18n'` получают НЕ статичный
 * казахский объект, а Proxy: каждое обращение `kk.xxx` отдаёт строку
 * ТЕКУЩЕГО языка. Поэтому словарь можно использовать как раньше —
 * `kk.subjects`, `kk.daysFull.mon`, `kk.courseNumber(3)` — но при
 * переключении языка (LangProvider → setLang → ре-рендер дерева) все
 * строки автоматически становятся русскими без правок в компонентах.
 *
 * Хранение выбора: localStorage `aristos-lang` (синхронно, доступно до
 * первого рендера) + зеркалирование в settings 'lang' в IndexedDB
 * (fire-and-forget), чтобы выбор переживал очистку localStorage.
 */
import { kkBase, type Dict } from './kk'
import { ru } from './ru'
import { saveSetting } from '@/lib/db'

export type { Dict } from './kk'
export { kkBase }
export type Lang = 'kk' | 'ru'

export const LANG_STORAGE_KEY = 'aristos-lang'
export const LANG_SETTING_KEY = 'lang'

const dictionaries: Record<Lang, Dict> = { kk: kkBase, ru }

function isLang(value: string | null): value is Lang {
  return value === 'kk' || value === 'ru'
}

// Начальный язык читается синхронно — до первого рендера React.
let currentLang: Lang = (() => {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (isLang(stored)) return stored
  } catch {
    // localStorage недоступен (приватный режим) — остаёмся на дефолте
  }
  return 'kk'
})()

export function getLang(): Lang {
  return currentLang
}

/** Сменить язык: модульная переменная + localStorage + IndexedDB-зеркало (fire-and-forget). */
export function setLang(lang: Lang): void {
  if (!isLang(lang)) return
  currentLang = lang
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    // ignore
  }
  void saveSetting(LANG_SETTING_KEY, lang).catch(() => {
    // IndexedDB может быть недоступна — localStorage уже сохранил выбор
  })
}

/**
 * Proxy поверх казахской базы: `kk.prop` → `dictionaries[getLang()].prop`.
 * Существующие `kk.xxx`-использования работают без правок и всегда
 * отдают строки текущего языка.
 */
export const kk = new Proxy(kkBase, {
  get: (_target, prop) => {
    if (typeof prop === 'symbol') return Reflect.get(kkBase, prop)
    const dict = dictionaries[getLang()] as unknown as Record<string, unknown>
    const value = dict[prop]
    return value !== undefined ? value : Reflect.get(kkBase, prop)
  },
}) as Dict

/** Список доступных языков (для переключателя). */
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'kk', label: 'KK' },
  { id: 'ru', label: 'RU' },
]
