import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { PatientWithLatestAssessment } from "@/lib/types"
import { ThemeToggle } from "@/components/theme-toggle"
import { getStrings } from "@/lib/i18n"
import { getLocale } from "@/lib/locale"
import { getSeedDashboardPatients, SEED_PENDING_SURVEYS_COUNT } from "@/lib/seed-data"
import { JoyIndicator } from "@/components/joy-indicator"
import { CachedDashboardClient } from "@/components/cached-dashboard-client"
import { RefillRequestsPanel } from "@/components/refill-requests-panel"

async function getPendingSurveysCount(): Promise<number> {
  if (!isSupabaseConfigured()) return SEED_PENDING_SURVEYS_COUNT
  try {
    const supabase = await createServerClient()
    const { count, error } = await supabase
      .from("patient_surveys")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
    if (error) return SEED_PENDING_SURVEYS_COUNT
    return count || 0
  } catch (error) {
    console.error("Error fetching pending surveys count:", error)
    return SEED_PENDING_SURVEYS_COUNT
  }
}

async function getPatientDashboardData(): Promise<PatientWithLatestAssessment[]> {
  if (!isSupabaseConfigured()) return getSeedDashboardPatients()

  let supabase
  try {
    supabase = await createServerClient()
  } catch (error) {
    console.error("Error creating Supabase client:", error)
    return getSeedDashboardPatients()
  }

  const { data: patients, error } = await supabase.from("patients").select("*").order("name", { ascending: true })

  if (error) {
    console.error("Error fetching patients:", error)
    return getSeedDashboardPatients()
  }

  if (!patients || patients.length === 0) return []

  const patientIds = patients.map((p) => p.id)

  const { data: allAssessments } = await supabase
    .from("assessments")
    .select("*")
    .in("patient_id", patientIds)
    .order("assessment_date", { ascending: false })

  const { data: allSurveys } = await supabase
    .from("patient_surveys")
    .select("*")
    .in("patient_id", patientIds)
    .eq("status", "scored")
    .order("survey_date", { ascending: false })

  // Group assessments by patient_id (in-memory)
  const assessmentsByPatient: Record<string, NonNullable<typeof allAssessments>> = {}
  for (const a of allAssessments || []) {
    if (!assessmentsByPatient[a.patient_id]) assessmentsByPatient[a.patient_id] = []
    assessmentsByPatient[a.patient_id]!.push(a)
  }

  // Group surveys by patient_id (in-memory)
  const surveysByPatient: Record<string, NonNullable<typeof allSurveys>> = {}
  for (const s of allSurveys || []) {
    if (!surveysByPatient[s.patient_id]) surveysByPatient[s.patient_id] = []
    surveysByPatient[s.patient_id]!.push(s)
  }

  // Combine everything in one pass
  const patientsWithAssessments = patients.map((patient) => {
    const assessments = assessmentsByPatient[patient.id] || []
    const surveys = surveysByPatient[patient.id] || []

    const allScores = [
      ...assessments.map((a) => ({
        date: new Date(a.assessment_date),
        score: a.total_score,
        severity: a.severity_level,
        reviewed: a.reviewed,
        type: "assessment" as const,
        data: a as Record<string, unknown>,
      })),
      ...surveys.map((s) => ({
        date: new Date(s.survey_date),
        score: s.total_score,
        severity: s.severity_level,
        reviewed: true,
        type: "survey" as const,
        data: s as Record<string, unknown>,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    const latest = allScores[0]
    const previous = allScores[1]

    return {
      ...patient,
      latest_assessment: latest
        ? {
            id: latest.type === "assessment" ? (latest.data as { id: string }).id : "",
            total_score: latest.score,
            severity_level: latest.severity,
            reviewed: latest.reviewed,
            assessment_date: latest.date.toISOString(),
            has_screen_intolerance: latest.type === "assessment" ? (latest.data as { has_screen_intolerance?: boolean }).has_screen_intolerance ?? false : false,
            has_night_driving_issues: latest.type === "assessment" ? (latest.data as { has_night_driving_issues?: boolean }).has_night_driving_issues ?? false : false,
            has_wind_sensitivity: latest.type === "assessment" ? (latest.data as { has_wind_sensitivity?: boolean }).has_wind_sensitivity ?? false : false,
            has_low_humidity_issues: latest.type === "assessment" ? (latest.data as { has_low_humidity_issues?: boolean }).has_low_humidity_issues ?? false : false,
          }
        : null,
      previous_assessment: previous
        ? {
            total_score: previous.score,
          }
        : null,
    }
  })

  return patientsWithAssessments
}

export default async function DashboardPage() {
  const locale = await getLocale()
  const t = getStrings(locale)
  const [patients, pendingSurveys] = await Promise.all([getPatientDashboardData(), getPendingSurveysCount()])

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-sans text-4xl font-bold tracking-tight text-balance">
                Hello Dr. Miller
            </h1>
            <p className="text-muted-foreground text-pretty">{t.dashboard.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <JoyIndicator />
            <ThemeToggle />
          </div>
        </div>

        {/*
         * CachedDashboardClient uses server-provided data for initial render
         * then seamlessly switches to the client-side cache after hydration.
         */}
        <CachedDashboardClient
          serverPatients={patients}
          serverPendingSurveys={pendingSurveys}
          locale={locale}
        />

        <RefillRequestsPanel />
      </div>
    </div>
  )
}
