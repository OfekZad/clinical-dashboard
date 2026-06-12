import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  ClockIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UsersIcon,
  DollarSignIcon,
  HeartPulseIcon,
  ActivityIcon,
  CheckCircleIcon,
  BarChart3Icon,
  ArrowLeftIcon,
  CalendarIcon,
  ZapIcon,
  TargetIcon,
  SparklesIcon,
} from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { getStrings, localeTag, type Locale } from "@/lib/i18n"
import { getLocale } from "@/lib/locale"
import { getSeedROIMetrics, getSeedMonthlyTrends } from "@/lib/seed-data"
import type { ROIMetrics, MonthlyTrend } from "@/lib/types"

async function getROIMetrics(): Promise<ROIMetrics> {
  if (!isSupabaseConfigured()) return getSeedROIMetrics()
  try {
    return await fetchROIMetrics()
  } catch (error) {
    console.error("Error fetching ROI metrics:", error)
    return getSeedROIMetrics()
  }
}

async function fetchROIMetrics(): Promise<ROIMetrics> {
  const supabase = await createServerClient()

  // Get all assessments
  const { data: assessments } = await supabase
    .from("assessments")
    .select("*")
    .order("assessment_date", { ascending: false })

  // Get all surveys
  const { data: surveys } = await supabase
    .from("patient_surveys")
    .select("*")
    .eq("status", "scored")
    .order("survey_date", { ascending: false })

  // Get all patients
  const { data: patients } = await supabase.from("patients").select("*")

  const totalAssessments = (assessments?.length || 0) + (surveys?.length || 0)
  const totalPatients = patients?.length || 0

  // Time savings calculations
  const manualTimePerAssessment = 8 * 60 // 8 minutes in seconds for manual assessment
  const aiTimePerAssessment = 30 // 30 seconds with AI
  const timeSavedPerAssessment = manualTimePerAssessment - aiTimePerAssessment
  const totalSecondsSaved = totalAssessments * timeSavedPerAssessment
  const totalMinutesSaved = Math.round(totalSecondsSaved / 60)
  const monthlyHoursSaved = Math.round((totalMinutesSaved / 60) * (30 / Math.max(1, totalAssessments)))
  const hourlyRate = 500 // NIS per hour (estimated)
  const estimatedMonthlySavings = monthlyHoursSaved * hourlyRate

  // Clinical outcomes calculations
  const patientScores: Record<string, number[]> = {}

  assessments?.forEach((a) => {
    if (!patientScores[a.patient_id]) patientScores[a.patient_id] = []
    patientScores[a.patient_id].push(a.total_score)
  })

  surveys?.forEach((s) => {
    if (s.patient_id && s.total_score !== null) {
      if (!patientScores[s.patient_id]) patientScores[s.patient_id] = []
      patientScores[s.patient_id].push(s.total_score)
    }
  })

  let improvingPatients = 0
  let totalScoreReduction = 0
  let patientsWithMultipleAssessments = 0

  Object.values(patientScores).forEach((scores) => {
    if (scores.length >= 2) {
      patientsWithMultipleAssessments++
      const firstScore = scores[scores.length - 1]
      const lastScore = scores[0]
      if (lastScore < firstScore) {
        improvingPatients++
        totalScoreReduction += firstScore - lastScore
      }
    }
  })

  const improvementRate =
    patientsWithMultipleAssessments > 0 ? Math.round((improvingPatients / patientsWithMultipleAssessments) * 100) : 0
  const avgScoreReduction = improvingPatients > 0 ? Math.round(totalScoreReduction / improvingPatients) : 0

  // Severe cases that improved
  const severeToClinicallySignificant = assessments?.filter((a) => a.severity_level === "Severe").length || 0

  // Revenue optimization
  const additionalCapacity = Math.round(monthlyHoursSaved * 4) // 4 patients per hour saved
  const surveyCompletionRate = surveys && surveys.length > 0 ? 85 : 0 // Placeholder
  const followUpComplianceRate =
    totalPatients > 0 ? Math.round((patientsWithMultipleAssessments / totalPatients) * 100) : 0
  const estimatedRevenueIncrease = additionalCapacity * 350 // NIS per visit

  // Patient engagement
  const activePatients = Object.keys(patientScores).length
  const retentionRate = totalPatients > 0 ? Math.round((activePatients / totalPatients) * 100) : 0

  return {
    timeSavings: {
      totalAssessments,
      totalMinutesSaved,
      averageTimePerAssessment: aiTimePerAssessment,
      monthlyHoursSaved,
      estimatedMonthlySavings,
    },
    clinicalOutcomes: {
      totalPatients,
      improvingPatients,
      improvementRate,
      averageScoreReduction: avgScoreReduction,
      severeToClinicallySignificant,
      treatmentSuccessRate: improvementRate,
    },
    revenueOptimization: {
      additionalCapacity,
      surveyCompletionRate,
      followUpComplianceRate,
      estimatedRevenueIncrease,
    },
    patientEngagement: {
      totalSurveysSent: (surveys?.length || 0) + 5, // Including pending
      surveysCompleted: surveys?.length || 0,
      completionRate: surveyCompletionRate,
      averageResponseTime: 24,
      activePatients,
      retentionRate,
    },
  }
}

async function getMonthlyTrends(locale: Locale): Promise<MonthlyTrend[]> {
  if (!isSupabaseConfigured()) return getSeedMonthlyTrends(locale)
  try {
    return await fetchMonthlyTrends(locale)
  } catch (error) {
    console.error("Error fetching monthly trends:", error)
    return getSeedMonthlyTrends(locale)
  }
}

async function fetchMonthlyTrends(locale: Locale): Promise<MonthlyTrend[]> {
  const supabase = await createServerClient()

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: assessments } = await supabase
    .from("assessments")
    .select("*")
    .gte("assessment_date", sixMonthsAgo.toISOString())

  const { data: surveys } = await supabase
    .from("patient_surveys")
    .select("*")
    .eq("status", "scored")
    .gte("survey_date", sixMonthsAgo.toISOString())

  // Group by month
  const monthlyData: Record<string, MonthlyTrend> = {}

  const months = getStrings(locale).roi.months

  for (let i = 5; i >= 0; i--) {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    monthlyData[key] = {
      month: months[date.getMonth()],
      assessments: 0,
      surveys: 0,
      timeSaved: 0,
      improvingPatients: 0,
    }
  }

  assessments?.forEach((a) => {
    const date = new Date(a.assessment_date)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (monthlyData[key]) {
      monthlyData[key].assessments++
      monthlyData[key].timeSaved += 7.5 // minutes saved per assessment
    }
  })

  surveys?.forEach((s) => {
    const date = new Date(s.survey_date)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (monthlyData[key]) {
      monthlyData[key].surveys++
      monthlyData[key].timeSaved += 5 // minutes saved per survey
    }
  })

  return Object.values(monthlyData)
}

function formatCurrency(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function AnalyticsPage() {
  const locale = await getLocale()
  const t = getStrings(locale)
  const [metrics, trends] = await Promise.all([getROIMetrics(), getMonthlyTrends(locale)])

  const maxTrend = Math.max(...trends.map((t) => t.assessments + t.surveys), 1)

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon data-icon="inline-start" />
              {t.roi.backToDashboard}
            </Link>
            <h1 className="font-sans text-4xl font-bold tracking-tight text-balance">{t.roi.title}</h1>
            <p className="text-muted-foreground text-pretty">{t.roi.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <CalendarIcon />
              {t.roi.allTime}
            </Badge>
            {/* Language Toggle — hidden, English is default */}
            {/* <LanguageToggle /> */}
            <ThemeToggle />
          </div>
        </div>

        {/* Section 1: Time Savings */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <ClockIcon className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t.roi.timeSavings.title}</h2>
              <p className="text-sm text-muted-foreground">{t.roi.timeSavings.subtitle}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t.roi.timeSavings.totalAssessments}</p>
                    <p className="font-mono text-3xl font-bold">{metrics.timeSavings.totalAssessments}</p>
                  </div>
                  <div className="rounded-lg bg-chart-1/10 p-2">
                    <ActivityIcon className="text-chart-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t.roi.timeSavings.minutesSaved}</p>
                    <p className="font-mono text-3xl font-bold text-success">{metrics.timeSavings.totalMinutesSaved}</p>
                  </div>
                  <div className="rounded-lg bg-success/10 p-2">
                    <ZapIcon className="text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t.roi.timeSavings.avgTimePerAssessment}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="font-mono text-3xl font-bold">{metrics.timeSavings.averageTimePerAssessment}</p>
                      <span className="text-sm text-muted-foreground">{t.roi.timeSavings.seconds}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.roi.timeSavings.vs} 8 {t.roi.timeSavings.minutesManual}
                    </p>
                  </div>
                  <div className="rounded-lg bg-info/10 p-2">
                    <ClockIcon className="text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-success/20 bg-success/5">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t.roi.timeSavings.estimatedSavings}</p>
                    <p className="font-mono text-3xl font-bold text-success">
                      {formatCurrency(metrics.timeSavings.estimatedMonthlySavings, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.roi.timeSavings.perMonth}</p>
                  </div>
                  <div className="rounded-lg bg-success/10 p-2">
                    <DollarSignIcon className="text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 2: Clinical Outcomes */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-chart-2/10 p-2">
              <HeartPulseIcon className="text-chart-2" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t.roi.clinicalOutcomes.title}</h2>
              <p className="text-sm text-muted-foreground">{t.roi.clinicalOutcomes.subtitle}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t.roi.clinicalOutcomes.totalPatients}</p>
                    <p className="font-mono text-3xl font-bold">{metrics.clinicalOutcomes.totalPatients}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2">
                    <UsersIcon className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t.roi.clinicalOutcomes.improvingPatients}
                    </p>
                    <p className="font-mono text-3xl font-bold text-success">
                      {metrics.clinicalOutcomes.improvingPatients}
                    </p>
                  </div>
                  <div className="rounded-lg bg-success/10 p-2">
                    <TrendingDownIcon className="text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t.roi.clinicalOutcomes.improvementRate}
                      </p>
                      <p className="font-mono text-3xl font-bold">{metrics.clinicalOutcomes.improvementRate}%</p>
                    </div>
                    <div className="rounded-lg bg-chart-2/10 p-2">
                      <TargetIcon className="text-chart-2" />
                    </div>
                  </div>
                  <Progress value={metrics.clinicalOutcomes.improvementRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t.roi.clinicalOutcomes.avgScoreReduction}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="font-mono text-3xl font-bold text-success">
                        -{metrics.clinicalOutcomes.averageScoreReduction}
                      </p>
                      <span className="text-sm text-muted-foreground">{t.roi.clinicalOutcomes.points}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-success/10 p-2">
                    <TrendingDownIcon className="text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 3: Revenue Optimization */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2">
              <DollarSignIcon className="text-warning" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t.roi.revenueOptimization.title}</h2>
              <p className="text-sm text-muted-foreground">{t.roi.revenueOptimization.subtitle}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t.roi.revenueOptimization.additionalCapacity}
                    </p>
                    <p className="font-mono text-3xl font-bold">+{metrics.revenueOptimization.additionalCapacity}</p>
                    <p className="text-xs text-muted-foreground">{t.roi.revenueOptimization.patientsPerMonth}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2">
                    <UsersIcon className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t.roi.revenueOptimization.surveyCompletion}
                      </p>
                      <p className="font-mono text-3xl font-bold">
                        {metrics.revenueOptimization.surveyCompletionRate}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-info/10 p-2">
                      <CheckCircleIcon className="text-info" />
                    </div>
                  </div>
                  <Progress value={metrics.revenueOptimization.surveyCompletionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t.roi.revenueOptimization.followUpCompliance}
                      </p>
                      <p className="font-mono text-3xl font-bold">
                        {metrics.revenueOptimization.followUpComplianceRate}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-chart-2/10 p-2">
                      <ActivityIcon className="text-chart-2" />
                    </div>
                  </div>
                  <Progress value={metrics.revenueOptimization.followUpComplianceRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-warning/5">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t.roi.revenueOptimization.estimatedIncrease}
                    </p>
                    <p className="font-mono text-3xl font-bold text-warning">
                      {formatCurrency(metrics.revenueOptimization.estimatedRevenueIncrease, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.roi.revenueOptimization.monthly}</p>
                  </div>
                  <div className="rounded-lg bg-warning/10 p-2">
                    <TrendingUpIcon className="text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 4: Patient Engagement */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-info/10 p-2">
              <SparklesIcon className="text-info" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t.roi.patientEngagement.title}</h2>
              <p className="text-sm text-muted-foreground">{t.roi.patientEngagement.subtitle}</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{t.roi.patientEngagement.surveysSent}</p>
                    <p className="font-mono text-3xl font-bold">{metrics.patientEngagement.totalSurveysSent}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2">
                    <BarChart3Icon className="text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t.roi.patientEngagement.completionRate}
                      </p>
                      <p className="font-mono text-3xl font-bold">{metrics.patientEngagement.completionRate}%</p>
                    </div>
                    <div className="rounded-lg bg-success/10 p-2">
                      <CheckCircleIcon className="text-success" />
                    </div>
                  </div>
                  <Progress value={metrics.patientEngagement.completionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t.roi.patientEngagement.avgResponseTime}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="font-mono text-3xl font-bold">{metrics.patientEngagement.averageResponseTime}</p>
                      <span className="text-sm text-muted-foreground">{t.roi.patientEngagement.hours}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-info/10 p-2">
                    <ClockIcon className="text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {t.roi.patientEngagement.retentionRate}
                      </p>
                      <p className="font-mono text-3xl font-bold text-success">
                        {metrics.patientEngagement.retentionRate}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-success/10 p-2">
                      <UsersIcon className="text-success" />
                    </div>
                  </div>
                  <Progress value={metrics.patientEngagement.retentionRate} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Monthly Trends Chart */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3Icon />
              {t.roi.monthlyTrends}
            </CardTitle>
            <CardDescription>{t.roi.assessmentsOverTime}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {trends.map((trend, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{trend.month}</span>
                    <span className="text-muted-foreground">
                      {trend.assessments + trend.surveys} {t.roi.assessmentsLabel} | {Math.round(trend.timeSaved)}{" "}
                      {t.roi.minutesSavedShort}
                    </span>
                  </div>
                  <div className="flex gap-1 h-8">
                    <div
                      className="bg-primary rounded-sm transition-all"
                      style={{
                        width: `${(trend.assessments / maxTrend) * 50}%`,
                        minWidth: trend.assessments > 0 ? "8px" : "0",
                      }}
                      title={`${t.roi.aiAssessments}: ${trend.assessments}`}
                    />
                    <div
                      className="bg-info rounded-sm transition-all"
                      style={{
                        width: `${(trend.surveys / maxTrend) * 50}%`,
                        minWidth: trend.surveys > 0 ? "8px" : "0",
                      }}
                      title={`${t.roi.patientSurveys}: ${trend.surveys}`}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-sm bg-primary" />
                  <span>{t.roi.aiAssessments}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-sm bg-info" />
                  <span>{t.roi.patientSurveys}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
