/** Раскладка главной страницы: какие блоки и в каком порядке стоят
 *  в основной колонке и в боковой. Пользовательская раскладка живёт
 *  в localStorage; битые/старые файлы мягко нормализуются. */

export type HomeBlockId =
  | "status"
  | "week"
  | "schedule"
  | "tomorrow"
  | "deadlines"
  | "advice"
  | "radar"
  | "gpa"
  | "notes"

export interface HomeLayout {
  main: HomeBlockId[]
  aside: HomeBlockId[]
}

const ALL_IDS: HomeBlockId[] = [
  "status",
  "week",
  "schedule",
  "tomorrow",
  "deadlines",
  "advice",
  "radar",
  "gpa",
  "notes",
]

/** Все возможные блоки главной — для подсчёта скрытых в редакторе. */
export const ALL_HOME_BLOCKS = ALL_IDS

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  main: ["status", "week", "schedule", "tomorrow"],
  aside: ["deadlines", "advice", "radar", "gpa", "notes"],
}

const STORAGE_KEY = "aristos-home-layout-v1"

/** Приводим произвольные данные к валидной раскладке: только известные id,
 *  без дублей, пропущенные блоки дописываются на свои места по умолчанию. */
export function normalizeHomeLayout(raw: unknown): HomeLayout {
  const seen = new Set<HomeBlockId>()
  const pick = (value: unknown): HomeBlockId[] => {
    if (!Array.isArray(value)) return []
    const out: HomeBlockId[] = []
    for (const item of value) {
      if (
        ALL_IDS.includes(item as HomeBlockId) &&
        !seen.has(item as HomeBlockId)
      ) {
        seen.add(item as HomeBlockId)
        out.push(item as HomeBlockId)
      }
    }
    return out
  }
  const record =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {}
  const main = pick(record.main)
  const aside = pick(record.aside)
  // пропущенные — в дефолтные колонки в исходном порядке
  for (const id of DEFAULT_HOME_LAYOUT.main) if (!seen.has(id)) main.push(id)
  for (const id of DEFAULT_HOME_LAYOUT.aside) if (!seen.has(id)) aside.push(id)
  return { main, aside }
}

export function loadHomeLayout(): HomeLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_HOME_LAYOUT
    return normalizeHomeLayout(JSON.parse(raw))
  } catch {
    return DEFAULT_HOME_LAYOUT
  }
}

export function saveHomeLayout(layout: HomeLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    /* хранилище недоступно — не критично */
  }
}

export function resetHomeLayout(): HomeLayout {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* пусто */
  }
  return DEFAULT_HOME_LAYOUT
}

/** Перестановки для редактора: сдвиг внутри колонки, перенос между колонками. */
export function moveWithin(
  list: HomeBlockId[],
  id: HomeBlockId,
  delta: -1 | 1
): HomeBlockId[] {
  const index = list.indexOf(id)
  const target = index + delta
  if (index === -1 || target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function moveToOtherColumn(
  layout: HomeLayout,
  id: HomeBlockId
): HomeLayout {
  if (layout.main.includes(id)) {
    return {
      main: layout.main.filter((b) => b !== id),
      aside: [...layout.aside, id],
    }
  }
  return {
    main: [...layout.main, id],
    aside: layout.aside.filter((b) => b !== id),
  }
}
