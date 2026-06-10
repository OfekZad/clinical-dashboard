import { createServerClient } from "@/lib/supabase/server"
import type { PatientSurveyWithResponses } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { hebrewStrings as t } from "@/lib/i18n"
import Link from "next/link"
import { ArrowRightIcon, ClipboardListIcon } from "lucide-react"

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

  const surveysWithResponses = await Promise.all(
    surveys.map(async (survey) => {
      const { data: responses } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", survey.id)
        .order("question_number", { ascending: true })

      return {
        ...survey,
        responses: responses || [],
      }
    }),
  )

  return surveysWithResponses
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
            <h1 className="font-sans text-3xl font-bold tracking-tight">סקרים</h1>
          </div>
          <ThemeToggle />
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardListIcon className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">סקרים מחושבים אוטומטית ומופיעים בפרופיל המטופל</p>
            <Link href="/dashboard" className="mt-4 text-sm text-primary hover:underline">
              חזור ללוח הבקרה
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
