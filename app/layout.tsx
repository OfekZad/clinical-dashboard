import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { LocaleProvider } from "@/components/locale-provider"
import { DataCacheProvider } from "@/lib/cache/cache-context"
import "./globals.css"

const metadataByLocale = {
  he: {
    title: "לוח בקרה קליני לעיניים יבשות",
    description: "מערכת ניטור חולים בזמן אמת עם הערכת תסמינים",
  },
  en: {
    title: "Dry Eye Clinical Dashboard",
    description: "Real-time patient monitoring with symptom assessment",
  },
}

// 🔥 OPTIMIZATION: generateMetadata reads cookies for locale-specific titles,
// but this does NOT make the layout itself dynamic. The layout can still be
// served from Vercel's edge cache.
export async function generateMetadata(): Promise<Metadata> {
  const { defaultLocale } = await import("@/lib/i18n")
  const { getLocale } = await import("@/lib/locale")
  const locale = await getLocale()
  const { title, description } = metadataByLocale[locale] ?? metadataByLocale[defaultLocale]
  return {
    title,
    description,
    generator: "v0.app",
    icons: {
      icon: [
        {
          url: "/icon-light-32x32.png",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/icon-dark-32x32.png",
          media: "(prefers-color-scheme: dark)",
        },
        {
          url: "/icon.svg",
          type: "image/svg+xml",
        },
      ],
      apple: "/apple-icon.png",
    },
  }
}

// 🔥 OPTIMIZATION: RootLayout is now SYNCHRONOUS — no async, no cookies() call.
// This allows Vercel to cache the page shell (the <html>, <body>, CSS/JS
// bundles) at the CDN edge. The locale-dependent <html lang/dir> attributes
// and server-rendered translations are handled by a client component that
// reads the cookie after hydration.
//
// Before: layout called getLocale() → cookies() → FULL page was dynamic SSR
// After:  layout is static shell, only page content is dynamic SSR
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" dir="ltr" className="light bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="light">
          <LocaleProvider>
            <DataCacheProvider>{children}</DataCacheProvider>
          </LocaleProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
