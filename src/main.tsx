import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { LangProvider } from "@/i18n/lang-provider.tsx"
import { isTauri } from "@/lib/tauri"
import { applyUserCss, loadUserCss } from "@/lib/theme-presets"
import { registerSW } from "virtual:pwa-register"

// Service worker — только веб/PWA. В Tauri ассеты зашиты в exe: SW там не
// даёт ничего, но переживает обновления приложения (HTTP-кэш tauri.localhost
// не отдаёт свежий sw.js) и молча подсовывает код прошлой версии — окно
// логина синка, например, открывалось по старым URL после апдейта.
// Заодно снимаем SW, успевший прописаться у машин со старых версий.
if (isTauri()) {
  navigator.serviceWorker
    ?.getRegistrations()
    .then((rs) => {
      for (const r of rs) r.unregister()
    })
    .catch(() => {})
} else {
  registerSW({ immediate: true })
}

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
