import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { LocaleProvider } from "@/components/locale-provider"
import { getLocale } from "@/lib/locale"
import { localeDirection } from "@/lib/i18n"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const { title, description } = metadataByLocale[locale]
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return (
    <html lang={locale} dir={localeDirection[locale]} className="light bg-background" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider defaultTheme="light">
          <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
