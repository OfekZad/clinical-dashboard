"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { defaultLocale, getStrings, localeDirection, type Locale, type Strings } from "@/lib/i18n"

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Strings
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

const LOCALE_COOKIE = "locale"
const ONE_YEAR = 60 * 60 * 24 * 365

interface LocaleProviderProps {
  children: ReactNode
  // Provided by the server layout (read from the cookie) to keep SSR and the
  // client in sync and avoid hydration mismatches.
  initialLocale?: Locale
}

// Helper to read the locale cookie in the browser
function getCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(^| )${LOCALE_COOKIE}=([^;]+)`))
  return match ? (match[2] as Locale) : null
}

export function LocaleProvider({ children, initialLocale = defaultLocale }: LocaleProviderProps) {
  const router = useRouter()
  // 🔥 OPTIMIZATION: On mount, read the locale cookie to set the correct
  // <html lang/dir> attributes. This avoids needing cookies() in the server
  // layout, allowing the layout shell to be cached by Vercel's edge CDN.
  const [locale, setLocaleState] = useState<Locale>(() => {
    // On the client, prefer the cookie value over the server-provided initialLocale
    if (typeof window !== "undefined") {
      return getCookieLocale() ?? initialLocale
    }
    return initialLocale
  })

  // Sync <html> attributes on mount AND whenever the locale changes
  // (e.g. from LanguageToggle click or initial page load).
  const [hasSyncedHtml, setHasSyncedHtml] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    root.lang = locale
    root.dir = localeDirection[locale]
    if (!hasSyncedHtml) setHasSyncedHtml(true)
  }, [locale, hasSyncedHtml])

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    try {
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${ONE_YEAR};SameSite=Lax`
    } catch {
      // ignore cookie errors
    }
    // Update <html> attributes immediately for snappy direction/lang changes
    const root = document.documentElement
    root.lang = next
    root.dir = localeDirection[next]
    // Re-render server components so server-rendered text picks up the new locale
    router.refresh()
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: getStrings(locale) }}>{children}</LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider")
  }
  return context
}
