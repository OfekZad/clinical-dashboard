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
}

// Helper to read the locale cookie in the browser
function getCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(^| )${LOCALE_COOKIE}=([^;]+)`))
  if (!match) return null
  const val = match[2] as Locale
  return val === "he" || val === "en" ? val : null
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const router = useRouter()
  // 🔥 OPTIMIZATION: Always start with the default locale during SSR + hydration
  // so the server-rendered HTML matches the client's first render perfectly.
  // After mount, the useEffect below reads the actual cookie and corrects
  // the locale if needed — no hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  // After hydration, read the cookie and sync <html> attributes.
  // Using an empty dependency array means this runs once after mount —
  // well after hydration is complete, so no hydration mismatch.
  useEffect(() => {
    const cookieLocale = getCookieLocale()
    const effectiveLocale = cookieLocale ?? defaultLocale

    // Sync <html> lang/dir attributes
    const root = document.documentElement
    root.lang = effectiveLocale
    root.dir = localeDirection[effectiveLocale]

    // If the cookie says a different locale than what we rendered on the server,
    // update state post-hydration (safe — hydration is already done)
    if (effectiveLocale !== defaultLocale) {
      setLocaleState(effectiveLocale)
    }
  }, [])

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
