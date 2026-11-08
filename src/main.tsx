import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { LangProvider } from "@/i18n/lang-provider.tsx"
import { applyUserCss, loadUserCss } from "@/lib/theme-presets"

// Пользовательский CSS (modder API v0) — до первого рендера, чтобы не мигало
applyUserCss(loadUserCss())

// Safety net: if boot fails, show the reason instead of a blank screen
const showBootError = (text: string) => {
  const root = document.getElementById("root")
  if (root && root.children.length === 0) {
    root.textContent = "BOOT ERROR: " + text.slice(0, 400)
  }
}

// Vite сигнализирует о сорвавшейся подгрузке чанка (lazy-роуты/компоненты).
// После нового деплоя открытая страница просит старые хэши — перезагрузка
// (одна, с защитой от цикла в index.html) забирает свежий код.
window.addEventListener("vite:preloadError", (event) => {
  const reload = (
    window as unknown as { __reloadOnStaleChunk?: (msg: string) => boolean }
  ).__reloadOnStaleChunk
  if (!reload || !reload("vite:preloadError")) {
    event.preventDefault()
  }
})

window.addEventListener(
  "error",
  (event) => {
    showBootError(
      (event.message || "resource/module error") +
        (event.filename
          ? ` @ ${event.filename.split("/").pop()}:${event.lineno}`
          : "")
    )
  },
  true
)
window.addEventListener("unhandledrejection", (event) => {
  showBootError(
    "rejection: " +
      String(
        (event.reason && (event.reason.stack || event.reason.message)) ||
          event.reason
      )
  )
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LangProvider>
  </StrictMode>
)
;(window as unknown as Record<string, unknown>).__BOOTED = true
