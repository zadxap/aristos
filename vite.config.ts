import path from "path"
import { readFileSync } from "node:fs"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

// Версия — единый источник правды: tauri.conf.json. Вшивается в бандл
// (define ниже), чтобы футер/интерфейс показывали её же и на вебе, и в
// Tauri, без дублирования в package.json и i18n-строках.
const APP_VERSION = (
  JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, "./src-tauri/tauri.conf.json"), "utf-8"),
  ) as { version: string }
).version

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Авто-инжект registerSW.js УБРАН: в Tauri (tauri.localhost) SW
      // переживает обновления приложения и подсовывает старый бандл
      // (HTTP-кэш протокола не даёт браузеру увидеть новый sw.js) —
      // после апдейта приложение молча работало на коде прошлой версии.
      // Регистрация теперь только на вебе — вручную в main.tsx.
      injectRegister: null,
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icons/*.png"],
      manifest: {
        name: "Aristos — Студенттік дашборд",
        short_name: "Aristos",
        description: "Университет силлабустары мен сабақ кестесінің оффлайн дашборды",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
        display: "standalone",
        lang: "kk",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
