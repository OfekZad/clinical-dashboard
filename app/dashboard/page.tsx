import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { PatientWithLatestAssessment } from "@/lib/types"
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ActivityIcon,
  UsersIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  BarChart3Icon,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { getStrings, localeTag, type Locale } from "@/lib/i18n"
import { getLocale } from "@/lib/locale"
import { getSeedDashboardPatients, SEED_PENDING_SURVEYS_COUNT } from "@/lib/seed-data"
import { ShareSurveyButton } from "@/components/share-survey-button"
import { DashboardTableClient } from "@/components/dashboard-table-client"
import { JoyIndicator } from "@/components/joy-indicator"

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

  // 🔥 FIX: Reduced from 1 + 2N queries down to just 3 queries total
  // by fetching all patients, assessments, and surveys in bulk, then
  // grouping them in-memory instead of looping per-patient.

  const { data: patients, error } = await supabase.from("patients").select("*").order("name", { ascending: true })

  if (error) {
    console.error("Error fetching patients:", error)
    return getSeedDashboardPatients()
  }

  if (!patients || patients.length === 0) return []

  const patientIds = patients.map((p) => p.id)

  // Fetch ALL assessments for ALL patients in one query
  const { data: allAssessments } = await supabase
    .from("assessments")
    .select("*")
    .in("patient_id", patientIds)
    .order("assessment_date", { ascending: false })

  // Fetch ALL scored surveys for ALL patients in one query
  const { data: allSurveys } = await supabase
    .from("patient_surveys")
    .select("*")
    .in("patient_id", patientIds)
    .eq("status", "scored")
    .order("survey_date", { ascending: false })

  // Group assessments by patient_id (in-memory, no more DB round-trips)
  const assessmentsByPatient: Record<string, typeof allAssessments> = {}
  for (const a of allAssessments || []) {
    if (!assessmentsByPatient[a.patient_id]) assessmentsByPatient[a.patient_id] = []
    assessmentsByPatient[a.patient_id].push(a)
  }

  // Group surveys by patient_id (in-memory)
  const surveysByPatient: Record<string, typeof allSurveys> = {}
  for (const s of allSurveys || []) {
    if (!surveysByPatient[s.patient_id]) surveysByPatient[s.patient_id] = []
    surveysByPatient[s.patient_id].push(s)
  }

  // Combine everything in one pass — no per-patient DB queries
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
        reviewed: true, // Surveys are auto-scored
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
            has_dry_eye_syndrome: latest.type === "assessment" ? (latest.data as { has_dry_eye_syndrome?: boolean }).has_dry_eye_syndrome ?? false : false,
            has_blepharitis: latest.type === "assessment" ? (latest.data as { has_blepharitis?: boolean }).has_blepharitis ?? false : false,
            has_mgd: latest.type === "assessment" ? (latest.data as { has_mgd?: boolean }).has_mgd ?? false : false,
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

  const totalPatients = patients.length
  const needsReview = patients.filter((p) => p.latest_assessment && !p.latest_assessment.reviewed).length
  const severeCases = patients.filter((p) => p.latest_assessment?.severity_level === "Severe").length
  const improving = patients.filter(
    (p) =>
      p.latest_assessment &&
      p.previous_assessment &&
      p.latest_assessment.total_score < p.previous_assessment.total_score,
  ).length

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-sans text-4xl font-bold tracking-tight text-balance">
                {t.dashboard.title}
            </h1>
            <p className="text-muted-foreground text-pretty">{t.dashboard.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* ROI Analytics — hidden */}
            {/* <Link href="/analytics">
              <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">
                <BarChart3Icon className="size-4" />
                {t.dashboard.roiAnalytics}
              </button>
            </Link> */}
            {/* Survey Link — hidden */}
            {/* <ShareSurveyButton /> */}
            {/* Language Toggle — hidden, English is default */}
            {/* <LanguageToggle /> */}
            <JoyIndicator />
            <ThemeToggle />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 justify-center">
          <Card className="border-border bg-card transition-all hover:border-primary/50 py-2">
            <CardContent className="flex items-start justify-between px-4 py-1.5">
              <div className="space-y-0">
                <p className="text-xs font-medium text-muted-foreground">{t.dashboard.totalPatients}</p>
                <p className="font-mono text-2xl font-bold tracking-tight">{totalPatients}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-1.5">
                <UsersIcon className="size-4 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card transition-all hover:border-warning/50 py-2">
            <CardContent className="flex items-start justify-between px-4 py-1.5">
              <div className="space-y-0">
                <p className="text-xs font-medium text-muted-foreground">{t.dashboard.needsReview}</p>
                <p className="font-mono text-2xl font-bold tracking-tight text-warning">{needsReview}</p>
              </div>
              <div className="rounded-lg bg-warning/10 p-1.5">
                <AlertCircleIcon className="size-4 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card transition-all hover:border-destructive/50 py-2">
            <CardContent className="flex items-start justify-between px-4 py-1.5">
              <div className="space-y-0">
                <p className="text-xs font-medium text-muted-foreground">{t.dashboard.severeCases}</p>
                <p className="font-mono text-2xl font-bold tracking-tight text-destructive">{severeCases}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-1.5">
                <ActivityIcon className="size-4 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card transition-all hover:border-success/50 py-2">
            <CardContent className="flex items-start justify-between px-4 py-1.5">
              <div className="space-y-0">
                <p className="text-xs font-medium text-muted-foreground">{t.dashboard.improving}</p>
                <p className="font-mono text-2xl font-bold tracking-tight text-success">{improving}</p>
              </div>
              <div className="rounded-lg bg-success/10 p-1.5">
                <CheckCircleIcon className="size-4 text-success" />
              </div>
            </CardContent>
          </Card>

          {/* Surveys Received — hidden */}
          {/* <Link href="/surveys">
            <Card className="h-full border-border bg-card transition-all hover:border-info/50 cursor-pointer">
              <CardContent className="flex items-start justify-between p-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{t.dashboard.pendingSurveys}</p>
                  <p className="font-mono text-3xl font-bold tracking-tight text-info">{pendingSurveys}</p>
                </div>
                <div className="rounded-lg bg-info/10 p-3">
                  <ClipboardListIcon className="size-5 text-info" />
                </div>
              </CardContent>
            </Card>
          </Link> */}
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl">{t.dashboard.patientOverview}</CardTitle>
            <CardDescription>{t.dashboard.quickTriageView}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-semibold text-foreground">{t.dashboard.patient}</TableHead>
                    <TableHead className="font-semibold text-foreground">{t.dashboard.osdiScore}</TableHead>
                    <TableHead className="font-semibold text-foreground">{t.dashboard.severity}</TableHead>
                    <TableHead className="font-semibold text-foreground">{t.dashboard.trend}</TableHead>
                    <TableHead className="font-semibold text-foreground">{t.dashboard.symptoms}</TableHead>
                    <TableHead className="font-semibold text-foreground">Conditions</TableHead>
                    <TableHead className="font-semibold text-foreground">{t.dashboard.lastVisit}</TableHead>
                    <TableHead className="font-semibold text-foreground">{t.dashboard.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <DashboardTableClient patients={patients} locale={locale} t={{ noPatients: t.dashboard.noPatients }} />
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
