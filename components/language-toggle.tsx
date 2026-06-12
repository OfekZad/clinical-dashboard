"use client"

import { LanguagesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/components/locale-provider"

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale()

  return (
    <Button variant="outline" size="sm" onClick={() => setLocale(locale === "he" ? "en" : "he")} aria-label={t.common.toggleLanguage}>
      <LanguagesIcon data-icon="inline-start" />
      <span className="font-medium">{t.common.switchLanguageLabel}</span>
    </Button>
  )
}
