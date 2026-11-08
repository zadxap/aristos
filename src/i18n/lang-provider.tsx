/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { getLang, setLang as setModuleLang, LANG_STORAGE_KEY, type Lang } from "@/i18n"
import { getSetting } from "@/lib/db"

type LangProviderProps = {
  children: React.ReactNode
  defaultLang?: Lang
}

type LangProviderState = {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LangProviderContext = React.createContext<LangProviderState | undefined>(
  undefined
)

function isLang(value: string | null): value is Lang {
  return value === "kk" || value === "ru"
}

/**
 * React-контекст языка. По образцу ThemeProvider: хранит текущий язык в
 * состоянии — при переключении дерево перерисовывается, и Proxy `kk` на
 * каждом обращении отдаёт строки нового языка. Выбор сохраняется через
 * setLang() из '@/i18n' (localStorage + fire-and-forget IndexedDB).
 */
export function LangProvider({
  children,
  defaultLang = "kk",
}: LangProviderProps) {
  const [lang, setLangState] = React.useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY)
      if (isLang(stored)) return stored
    } catch {
      // ignore
    }
    return getLang()
  })

  const setLang = React.useCallback((nextLang: Lang) => {
    setModuleLang(nextLang)
    setLangState(nextLang)
  }, [])

  // Первый визит (localStorage пуст): поднять выбор из settings 'lang' в IndexedDB.
  React.useEffect(() => {
    try {
      if (localStorage.getItem(LANG_STORAGE_KEY)) return undefined
    } catch {
      return undefined
    }

    let cancelled = false
    getSetting<string | null>("lang", null)
      .then((stored) => {
        if (cancelled) return
        if (isLang(stored)) setLang(stored)
      })
      .catch(() => {
        // IndexedDB недоступна — остаёмся на дефолте
      })
    return () => {
      cancelled = true
    }
  }, [setLang])

  // <html lang="ru|kk"> — доступность и корректная типографика браузера.
  React.useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Синхронизация между вкладками (как storage-листенер в ThemeProvider).
  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      if (event.key !== LANG_STORAGE_KEY) return

      if (isLang(event.newValue)) {
        setModuleLang(event.newValue)
        setLangState(event.newValue)
        return
      }

      setLangState(defaultLang)
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultLang])

  const value = React.useMemo(
    () => ({
      lang,
      setLang,
    }),
    [lang, setLang]
  )

  // Важно: смена языка должна перерисовать ВЕСЬ интерфейс. React-контекст
  // сам по себе перерисовывает только консьюмеров (useLang), а словарь
  // используется напрямую (`kk.xxx`) без подписки — поэтому поддерево
  // монтируется заново через key={lang}. Все компоненты читают строки при
  // рендере через Proxy `kk`, так что после ремонта весь UI уже на новом
  // языке. Локальное UI-состояние (открытые модалки, вкладки дня) при
  // переключении языка сбрасывается — это ожидаемое поведение.
  return (
    <LangProviderContext.Provider value={value}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </LangProviderContext.Provider>
  )
}

export const useLang = () => {
  const context = React.useContext(LangProviderContext)

  if (context === undefined) {
    throw new Error("useLang must be used within a LangProvider")
  }

  return context
}
