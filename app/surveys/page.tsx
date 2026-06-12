import { createServerClient } from "@/lib/supabase/server"
import type { PatientSurveyWithResponses } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { getStrings } from "@/lib/i18n"
import { getLocale } from "@/lib/locale"
import Link from "next/link"
import { ArrowRightIcon, ClipboardListIcon } from "lucide-react"

// 🔥 FIX: Removed N+1 pattern (was 1 + N queries). This function was
// actually dead code — never called from the page below — but keeping it
// clean in case it's used in the future. Now uses bulk fetch: 2 queries total.
async function getPendingSurveys(): Promise<PatientSurveyWithResponses[]> {
  const supabase = await createServerClient()

  const { data: surveys, error } = await supabase
    .from("patient_surveys")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching surveys:", error)
    return []
  }

  if (!surveys || surveys.length === 0) return []

  // Fetch ALL responses for ALL surveys in one query instead of one-per-survey
  const surveyIds = surveys.map((s) => s.id)
  const { data: allResponses } = await supabase
    .from("survey_responses")
    .select("*")
    .in("survey_id", surveyIds)
    .order("question_number", { ascending: true })

  // Group responses by survey_id in-memory
  const responsesBySurveyId: Record<string, typeof allResponses> = {}
  for (const r of allResponses || []) {
    if (!responsesBySurveyId[r.survey_id]) responsesBySurveyId[r.survey_id] = []
    responsesBySurveyId[r.survey_id].push(r)
  }

  return surveys.map((survey) => ({
    ...survey,
    responses: responsesBySurveyId[survey.id] || [],
  }))
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function SurveysPage() {
  const locale = await getLocale()
  const t = getStrings(locale)

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-[1200px] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRightIcon className="size-4" />
              {t.patient.backToDashboard}
            </Link>
            <h1 className="font-sans text-3xl font-bold tracking-tight">{t.survey.surveysPageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Toggle — hidden, English is default */}
            {/* <LanguageToggle /> */}
            <ThemeToggle />
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardListIcon className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">{t.survey.autoScoredInfo}</p>
            <Link href="/dashboard" className="mt-4 text-sm text-primary hover:underline">
              {t.patient.backToDashboard}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
