"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { useLocale } from "@/components/locale-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useLocale()

  return (
    <Button variant="outline" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")} className="transition-colors">
      <SunIcon data-icon="inline-start" className="rotate-0 scale-100 dark:-rotate-90 dark:scale-0" />
      <MoonIcon data-icon="inline-start" className="absolute rotate-90 scale-0 dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{t.common.toggleTheme}</span>
    </Button>
  )
}
