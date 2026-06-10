import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { PatientWithLatestAssessment } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  MonitorIcon,
  MoonIcon,
  WindIcon,
  DropletIcon,
  ActivityIcon,
  UsersIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  BarChart3Icon,
} from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { getStrings, getSeverityLabel, localeTag, type Locale } from "@/lib/i18n"
import { getLocale } from "@/lib/locale"
import { getSeedDashboardPatients, SEED_PENDING_SURVEYS_COUNT } from "@/lib/seed-data"
import { ShareSurveyButton } from "@/components/share-survey-button"

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

  const patientsWithAssessments = await Promise.all(
    patients.map(async (patient) => {
      const { data: assessments } = await supabase
        .from("assessments")
        .select("*")
        .eq("patient_id", patient.id)
        .order("assessment_date", { ascending: false })

      const { data: surveys } = await supabase
        .from("patient_surveys")
        .select("*")
        .eq("patient_id", patient.id)
        .eq("status", "scored")
        .order("survey_date", { ascending: false })

      const allScores = [
        ...(assessments || []).map((a) => ({
          date: new Date(a.assessment_date),
          score: a.total_score,
          severity: a.severity_level,
          reviewed: a.reviewed,
          type: "assessment" as const,
          data: a,
        })),
        ...(surveys || []).map((s) => ({
          date: new Date(s.survey_date),
          score: s.total_score,
          severity: s.severity_level,
          reviewed: true, // Surveys are auto-scored
          type: "survey" as const,
          data: s,
        })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime())

      const latest = allScores[0]
      const previous = allScores[1]

      return {
        ...patient,
        latest_assessment: latest
          ? {
              total_score: latest.score,
              severity_level: latest.severity,
              reviewed: latest.reviewed,
              assessment_date: latest.date.toISOString(),
              has_screen_intolerance: latest.type === "assessment" ? latest.data.has_screen_intolerance : false,
              has_night_driving_issues: latest.type === "assessment" ? latest.data.has_night_driving_issues : false,
              has_wind_sensitivity: latest.type === "assessment" ? latest.data.has_wind_sensitivity : false,
              has_low_humidity_issues: latest.type === "assessment" ? latest.data.has_low_humidity_issues : false,
            }
          : null,
        previous_assessment: previous
          ? {
              total_score: previous.score,
            }
          : null,
      }
    }),
  )

  return patientsWithAssessments
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "Normal":
      return "bg-success/10 text-success border-success/20"
    case "Mild":
      return "bg-info/10 text-info border-info/20"
    case "Moderate":
      return "bg-warning/10 text-warning border-warning/20"
    case "Severe":
      return "bg-destructive/10 text-destructive border-destructive/20"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

function getTrendIndicator(latest: number, previous?: number) {
  if (!previous) return <MinusIcon className="size-4 text-muted-foreground" />

  if (latest < previous) {
    return (
      <div className="flex items-center gap-1 text-success">
        <TrendingDownIcon className="size-4" />
        <span className="text-xs font-medium">-{previous - latest}</span>
      </div>
    )
  } else if (latest > previous) {
    return (
      <div className="flex items-center gap-1 text-destructive">
        <TrendingUpIcon className="size-4" />
        <span className="text-xs font-medium">+{latest - previous}</span>
      </div>
    )
  }
  return <MinusIcon className="size-4 text-muted-foreground" />
}

function formatDate(date: string, locale: Locale) {
  return new Date(date).toLocaleDateString(localeTag[locale], {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
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
            <h1 className="font-sans text-4xl font-bold tracking-tight text-balance">{t.dashboard.title}</h1>
            <p className="text-muted-foreground text-pretty">{t.dashboard.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/analytics">
              <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">
                <BarChart3Icon className="size-4" />
                {t.dashboard.roiAnalytics || "ניתוח ROI"}
              </button>
            </Link>
            <ShareSurveyButton />
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="border-border bg-card transition-all hover:border-primary/50">
            <CardContent className="flex items-start justify-between p-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t.dashboard.totalPatients}</p>
                <p className="font-mono text-3xl font-bold tracking-tight">{totalPatients}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <UsersIcon className="size-5 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card transition-all hover:border-warning/50">
            <CardContent className="flex items-start justify-between p-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t.dashboard.needsReview}</p>
                <p className="font-mono text-3xl font-bold tracking-tight text-warning">{needsReview}</p>
              </div>
              <div className="rounded-lg bg-warning/10 p-3">
                <AlertCircleIcon className="size-5 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card transition-all hover:border-destructive/50">
            <CardContent className="flex items-start justify-between p-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t.dashboard.severeCases}</p>
                <p className="font-mono text-3xl font-bold tracking-tight text-destructive">{severeCases}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-3">
                <ActivityIcon className="size-5 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card transition-all hover:border-success/50">
            <CardContent className="flex items-start justify-between p-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t.dashboard.improving}</p>
                <p className="font-mono text-3xl font-bold tracking-tight text-success">{improving}</p>
              </div>
              <div className="rounded-lg bg-success/10 p-3">
                <CheckCircleIcon className="size-5 text-success" />
              </div>
            </CardContent>
          </Card>

          <Link href="/surveys">
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
          </Link>
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
                    <TableHead className="font-semibold text-foreground">{t.dashboard.lastVisit}</TableHead>
                    <TableHead className="font-semibold text-foreground">{t.dashboard.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                        {t.dashboard.noPatients}
                      </TableCell>
                    </TableRow>
                  ) : (
                    patients.map((patient) => {
                      const assessment = patient.latest_assessment
                      const previousScore = patient.previous_assessment?.total_score

                      return (
                        <TableRow
                          key={patient.id}
                          className="group cursor-pointer border-border transition-colors hover:bg-accent/50"
                        >
                          <TableCell>
                            <Link href={`/patient/${patient.id}`} className="block">
                              <div className="space-y-0.5">
                                <div className="font-medium transition-colors group-hover:text-primary">
                                  {patient.name}
                                </div>
                                {patient.date_of_birth && (
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(patient.date_of_birth).toLocaleDateString(localeTag[locale])}
                                  </div>
                                )}
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            {assessment ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-2xl font-bold">{assessment.total_score}</span>
                                <span className="text-xs text-muted-foreground">/ 100</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {assessment ? (
                              <Badge variant="outline" className={getSeverityColor(assessment.severity_level)}>
                                {getSeverityLabel(assessment.severity_level, locale)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {assessment && getTrendIndicator(assessment.total_score, previousScore)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {assessment?.has_screen_intolerance && (
                                <div className="rounded-md bg-warning/10 p-1.5">
                                  <MonitorIcon className="size-4 text-warning" />
                                </div>
                              )}
                              {assessment?.has_night_driving_issues && (
                                <div className="rounded-md bg-info/10 p-1.5">
                                  <MoonIcon className="size-4 text-info" />
                                </div>
                              )}
                              {assessment?.has_wind_sensitivity && (
                                <div className="rounded-md bg-primary/10 p-1.5">
                                  <WindIcon className="size-4 text-primary" />
                                </div>
                              )}
                              {assessment?.has_low_humidity_issues && (
                                <div className="rounded-md bg-chart-2/10 p-1.5">
                                  <DropletIcon className="size-4 text-chart-2" />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {assessment ? formatDate(assessment.assessment_date, locale) : "—"}
                          </TableCell>
                          <TableCell>
                            {assessment ? (
                              assessment.reviewed ? (
                                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                                  <CheckCircleIcon className="mr-1 size-3" />
                                  {t.dashboard.reviewed}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                                  <AlertCircleIcon className="mr-1 size-3" />
                                  {t.dashboard.needsReviewBadge}
                                </Badge>
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
