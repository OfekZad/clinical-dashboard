import { cookies } from "next/headers"
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n"

export const LOCALE_COOKIE = "locale"

// Read the active locale from the cookie (server components / route handlers)
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : defaultLocale
}
