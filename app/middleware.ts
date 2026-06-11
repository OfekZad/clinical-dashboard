// 🔥 OPTIMIZATION: Middleware handles locale cookie default so that
// the layout itself doesn't need to call cookies() (keeping it static
// and edge-cacheable).

import { NextResponse, type NextRequest } from "next/server"

const LOCALE_COOKIE = "locale"
const SUPPORTED_LOCALES = ["he", "en"]
const DEFAULT_LOCALE = "he"
const ONE_YEAR = 60 * 60 * 24 * 365

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // If the locale cookie isn't set yet, default to Hebrew
  const existing = request.cookies.get(LOCALE_COOKIE)?.value
  if (!existing || !SUPPORTED_LOCALES.includes(existing)) {
    response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
    })
  }

  return response
}

// Only run on page requests (not static files, API routes, etc.)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
