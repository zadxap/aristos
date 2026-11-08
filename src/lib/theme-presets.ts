/** Стили интерфейса (пресеты) поверх светлой/тёмной темы.
 *  Каждый стиль — полный «концепт»: цвета, радиусы, шрифт, фон-паттерн
 *  и структурный класс на <html> (тени/свечение/стекло). Инлайновые
 *  CSS-переменные на :root перекрывают значения из .light/.dark.
 *  Выбор живёт в localStorage. Идеи концептов — из редизайнов в presets/. */

import type { ResolvedTheme } from "@/components/theme-provider"

export interface ThemePreset {
  id: string
  /** ключ i18n-словаря с названием стиля (только строковые ключи имён) */
  nameKey:
    | "presetAristos"
    | "presetMonolith"
    | "presetCobalt"
    | "presetDeck"
    | "presetOcean"
    | "presetForest"
    | "presetSunset"
    | "presetGlass"
  /** инлайновые переменные, перекрывающие .light / .dark */
  light: Record<string, string>
  dark: Record<string, string>
  /** структурный класс на <html> (тени/паттерны/стекло из index.css) */
  htmlClass?: string
  /** шрифт пакета — подгружается динамически при выборе стиля */
  fontImport?: () => Promise<unknown>
  /** цвет чипа-превью в пикере */
  swatch: { light: string; dark: string }
}

export const THEME_PRESET_KEY = "aristos-theme-preset"

/** ключи, которые стили трогают — для полной очистки при смене */
const MANAGED_VARS = [
  "--primary",
  "--primary-foreground",
  "--ring",
  "--background",
  "--card",
  "--muted",
  "--muted-foreground",
  "--secondary",
  "--accent",
  "--border",
  "--radius",
  "--app-font",
]

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "aristos",
    nameKey: "presetAristos",
    light: {},
    dark: {},
    swatch: { light: "oklch(0.55 0.22 255)", dark: "oklch(0.65 0.22 255)" },
  },
  {
    // CONCEPT 1 из редизайна: серый монолит, титановый акцент, Jakarta, растр
    id: "monolith",
    nameKey: "presetMonolith",
    htmlClass: "style-monolith",
    fontImport: () => import("@fontsource-variable/plus-jakarta-sans"),
    light: {
      "--primary": "#374151",
      "--primary-foreground": "#f9fafb",
      "--ring": "#6b7280",
      "--background": "#f4f5f6",
      "--card": "#ffffff",
      "--border": "rgba(0, 0, 0, 0.09)",
      "--muted": "#eceef0",
      "--muted-foreground": "#6b7280",
      "--secondary": "#eceef0",
      "--accent": "#e5e7eb",
      "--radius": "14px",
      "--app-font": "'Plus Jakarta Sans Variable', sans-serif",
    },
    dark: {
      "--primary": "#e2e8f0",
      "--primary-foreground": "#131518",
      "--ring": "#9ca3af",
      "--background": "#131518",
      "--card": "#1c1f24",
      "--border": "rgba(255, 255, 255, 0.08)",
      "--muted": "#22262d",
      "--muted-foreground": "#8b929e",
      "--secondary": "#22262d",
      "--accent": "#282d35",
      "--radius": "14px",
      "--app-font": "'Plus Jakarta Sans Variable', sans-serif",
    },
    swatch: { light: "#6b7280", dark: "#e2e8f0" },
  },
  {
    // CONCEPT 2: глубокий кобальт, свечение сверху, полупрозрачные карточки
    id: "cobalt",
    nameKey: "presetCobalt",
    htmlClass: "style-cobalt",
    fontImport: () => import("@fontsource-variable/plus-jakarta-sans"),
    light: {
      "--primary": "#1d4ed8",
      "--primary-foreground": "#eff6ff",
      "--ring": "#2563eb",
      "--background": "#f3f7ff",
      "--card": "#ffffff",
      "--border": "rgba(37, 99, 235, 0.14)",
      "--muted": "#e8effc",
      "--muted-foreground": "#51607a",
      "--secondary": "#e8effc",
      "--accent": "#dbe7fd",
      "--radius": "16px",
      "--app-font": "'Plus Jakarta Sans Variable', sans-serif",
    },
    dark: {
      "--primary": "#2563eb",
      "--primary-foreground": "#eff6ff",
      "--ring": "#60a5fa",
      "--background": "#060913",
      "--card": "rgba(14, 21, 38, 0.7)",
      "--border": "rgba(56, 128, 255, 0.22)",
      "--muted": "rgba(20, 31, 56, 0.8)",
      "--muted-foreground": "#8295b5",
      "--secondary": "rgba(20, 31, 56, 0.8)",
      "--accent": "rgba(37, 99, 235, 0.2)",
      "--radius": "16px",
      "--app-font": "'Plus Jakarta Sans Variable', sans-serif",
    },
    swatch: { light: "#1d4ed8", dark: "#3b82f6" },
  },
  {
    // CONCEPT 3: индустриальная дека — рубленые углы, янтарный LED, канавки
    id: "deck",
    nameKey: "presetDeck",
    htmlClass: "style-deck",
    fontImport: () => import("@fontsource-variable/space-grotesk"),
    light: {
      "--primary": "#b45309",
      "--primary-foreground": "#fffbeb",
      "--ring": "#d97706",
      "--background": "#f4f4f5",
      "--card": "#ffffff",
      "--border": "#d4d4d8",
      "--muted": "#e4e4e7",
      "--muted-foreground": "#52525b",
      "--secondary": "#e4e4e7",
      "--accent": "#fef3c7",
      "--radius": "6px",
      "--app-font": "'Space Grotesk Variable', sans-serif",
    },
    dark: {
      "--primary": "#ff9900",
      "--primary-foreground": "#131313",
      "--ring": "#ffb84d",
      "--background": "#0f1012",
      "--card": "#18191c",
      "--border": "#282a2e",
      "--muted": "#1f2024",
      "--muted-foreground": "#72747d",
      "--secondary": "#1f2024",
      "--accent": "rgba(255, 153, 0, 0.12)",
      "--radius": "6px",
      "--app-font": "'Space Grotesk Variable', sans-serif",
    },
    swatch: { light: "#b45309", dark: "#ff9900" },
  },
  {
    id: "ocean",
    nameKey: "presetOcean",
    light: {
      "--primary": "oklch(0.58 0.12 210)",
      "--ring": "oklch(0.58 0.12 210)",
      "--background": "oklch(0.98 0.008 215)",
      "--card": "oklch(0.995 0.004 215)",
      "--muted": "oklch(0.955 0.012 215)",
      "--secondary": "oklch(0.955 0.012 215)",
      "--accent": "oklch(0.94 0.03 210)",
    },
    dark: {
      "--primary": "oklch(0.72 0.12 210)",
      "--ring": "oklch(0.72 0.12 210)",
      "--background": "oklch(0.145 0.02 230)",
      "--card": "oklch(0.19 0.02 230)",
      "--muted": "oklch(0.24 0.02 230)",
      "--secondary": "oklch(0.25 0.02 230)",
      "--accent": "oklch(0.28 0.04 225)",
    },
    swatch: { light: "oklch(0.58 0.12 210)", dark: "oklch(0.72 0.12 210)" },
  },
  {
    id: "forest",
    nameKey: "presetForest",
    light: {
      "--primary": "oklch(0.56 0.13 155)",
      "--ring": "oklch(0.56 0.13 155)",
      "--background": "oklch(0.975 0.01 150)",
      "--card": "oklch(0.99 0.005 150)",
      "--muted": "oklch(0.95 0.015 150)",
      "--secondary": "oklch(0.95 0.015 150)",
      "--accent": "oklch(0.93 0.04 150)",
    },
    dark: {
      "--primary": "oklch(0.7 0.14 155)",
      "--ring": "oklch(0.7 0.14 155)",
      "--background": "oklch(0.145 0.015 165)",
      "--card": "oklch(0.19 0.015 165)",
      "--muted": "oklch(0.24 0.015 165)",
      "--secondary": "oklch(0.25 0.015 165)",
      "--accent": "oklch(0.28 0.035 160)",
    },
    swatch: { light: "oklch(0.56 0.13 155)", dark: "oklch(0.7 0.14 155)" },
  },
  {
    id: "sunset",
    nameKey: "presetSunset",
    light: {
      "--primary": "oklch(0.58 0.2 320)",
      "--ring": "oklch(0.58 0.2 320)",
      "--background": "oklch(0.98 0.008 320)",
      "--card": "oklch(0.995 0.004 320)",
      "--muted": "oklch(0.955 0.015 320)",
      "--secondary": "oklch(0.955 0.015 320)",
      "--accent": "oklch(0.94 0.035 315)",
    },
    dark: {
      "--primary": "oklch(0.68 0.2 320)",
      "--ring": "oklch(0.68 0.2 320)",
      "--background": "oklch(0.145 0.018 315)",
      "--card": "oklch(0.19 0.018 315)",
      "--muted": "oklch(0.24 0.018 315)",
      "--secondary": "oklch(0.25 0.018 315)",
      "--accent": "oklch(0.28 0.045 315)",
    },
    swatch: { light: "oklch(0.58 0.2 320)", dark: "oklch(0.68 0.2 320)" },
  },
  {
    id: "glass",
    nameKey: "presetGlass",
    htmlClass: "theme-glass",
    light: {
      "--primary": "oklch(0.55 0.2 255)",
      "--ring": "oklch(0.55 0.2 255)",
      "--card": "oklch(1 0 0 / 0.62)",
      "--muted": "oklch(0.96 0.008 255 / 0.7)",
      "--secondary": "oklch(0.96 0.008 255 / 0.7)",
    },
    dark: {
      "--primary": "oklch(0.68 0.2 255)",
      "--ring": "oklch(0.68 0.2 255)",
      "--card": "oklch(0.22 0.015 260 / 0.6)",
      "--muted": "oklch(0.28 0.015 260 / 0.55)",
      "--secondary": "oklch(0.28 0.015 260 / 0.55)",
    },
    swatch: {
      light: "oklch(0.75 0.06 255 / 0.9)",
      dark: "oklch(0.45 0.08 260 / 0.9)",
    },
  },
]

export function loadThemePreset(): string {
  try {
    return localStorage.getItem(THEME_PRESET_KEY) ?? "aristos"
  } catch {
    return "aristos"
  }
}

export function saveThemePreset(id: string): void {
  try {
    localStorage.setItem(THEME_PRESET_KEY, id)
  } catch {
    /* пусто */
  }
}

/** текущая схема по классу на <html> (ставится theme-provider'ом) */
export function currentScheme(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

/** Применить стиль: снять предыдущие инлайновые переменные и классы,
 *  выставить новые, подтянуть шрифт пакета. Вызывается при смене стиля
 *  и при смене темы (переменные задаются отдельно для light/dark). */
export function applyThemePreset(
  id: string,
  resolvedTheme: ResolvedTheme
): void {
  const root = document.documentElement
  const preset = THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]

  for (const key of MANAGED_VARS) root.style.removeProperty(key)
  for (const p of THEME_PRESETS)
    if (p.htmlClass) root.classList.remove(p.htmlClass)

  const vars = resolvedTheme === "dark" ? preset.dark : preset.light
  for (const [key, value] of Object.entries(vars))
    root.style.setProperty(key, value)
  if (preset.htmlClass) root.classList.add(preset.htmlClass)
  void preset.fontImport?.()
}

/* ---- Свой CSS (modder API v0): пользовательский слой поверх всего ---- */

const USER_CSS_KEY = "aristos-user-css"

export function loadUserCss(): string {
  try {
    return localStorage.getItem(USER_CSS_KEY) ?? ""
  } catch {
    return ""
  }
}

export function saveUserCss(css: string): void {
  try {
    localStorage.setItem(USER_CSS_KEY, css)
  } catch {
    /* пусто */
  }
  applyUserCss(css)
}

/** Применить пользовательский CSS: единый <style> в head, пересоздаётся. */
export function applyUserCss(css: string): void {
  document.getElementById("aristos-user-css")?.remove()
  if (css.trim()) {
    const style = document.createElement("style")
    style.id = "aristos-user-css"
    style.textContent = css
    document.head.appendChild(style)
  }
}
