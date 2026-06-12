"use client"

import { useMemo } from "react"
import { useDataCache, useCachedPatient, useCachedAssessments, useCachedMedications } from "@/lib/cache"
import type { AssessmentResponse, ClinicianNote, SurveyResponse, AssessmentWithType, PatientMedication } from "@/lib/types"
import { CacheLoadingState } from "./cache-loading"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeftIcon, MonitorIcon, MoonIcon, WindIcon, DropletIcon,
  TrendingUpIcon, TrendingDownIcon, MinusIcon, ChevronRightIcon,
  ActivityIcon, PillIcon, StethoscopeIcon, MessageSquareQuoteIcon,
  BrainIcon, ListChecksIcon,
} from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import Link from "next/link"
import { AddNoteForm } from "@/components/add-note-form"
import { MarkReviewedButton } from "@/components/mark-reviewed-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { JoyIndicator } from "@/components/joy-indicator"
import { PatientInfoClient } from "@/components/patient-info-client"
import { AssessmentSidebar } from "@/components/assessment-sidebar"
import { useSearchParams } from "next/navigation"
import { getStrings, getSeverityLabel, localeTag, type Locale, type FrequencyKey } from "@/lib/i18n"
import { useLocale } from "@/components/locale-provider"

const frequencyLabels: Record<FrequencyKey, { en: string; he: string }> = {
  none: { en: "Never", he: "\u05d0\u05e3 \u05e4\u05e2\u05dd" },
  sometimes: { en: "Sometimes", he: "\u05dc\u05e4\u05e2\u05de\u05d9\u05dd" },
  half: { en: "About half", he: "\u05db\u05de\u05d7\u05e6\u05d9\u05ea" },
  most: { en: "Most of the time", he: "\u05e8\u05d5\u05d1 \u05d4\u05d6\u05de\u05df" },
  all: { en: "All the time", he: "\u05db\u05dc \u05d4\u05d6\u05de\u05df" },
  not_applicable: { en: "N/A", he: "\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9" },
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "Normal": return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800"
    case "Mild": return "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-800"
    case "Moderate": return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800"
    case "Severe": return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800"
    default: return "text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950/50 dark:border-gray-800"
  }
}

function getScoreColor(score: number) {
  if (score === 0) return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800"
  if (score <= 1) return "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-800"
  if (score <= 2) return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800"
  return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800"
}

function getScoreLabel(score: number, locale: Locale): string {
  const labels: Record<Locale, Record<number, string>> = {
    en: { 0: "None", 1: "Mild", 2: "Moderate", 3: "Severe", 4: "Very Severe" },
    he: { 0: "\u05dc\u05dc\u05d0", 1: "\u05e7\u05dc", 2: "\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9", 3: "\u05d7\u05de\u05d5\u05e8", 4: "\u05d7\u05de\u05d5\u05e8 \u05de\u05d0\u05d5\u05d3" },
  }
  return labels[locale]?.[score] ?? `${score}`
}

function getTrendIndicator(currentScore: number, previousScore: number | null) {
  if (previousScore === null) return null
  const diff = currentScore - previousScore
  if (diff > 5) return { icon: TrendingUpIcon, label: "Worsening", color: "text-red-600 dark:text-red-400" }
  if (diff < -5) return { icon: TrendingDownIcon, label: "Improving", color: "text-emerald-600 dark:text-emerald-400" }
  return { icon: MinusIcon, label: "Stable", color: "text-gray-600 dark:text-gray-400" }
}

function ScoreTrendChart({ items, locale, t }: { items: AssessmentWithType[]; locale: Locale; t: { scoreTrend: string } }) {
  // Sort chronologically (oldest first) for the line chart
  const chartData = useMemo(() => {
    return [...items]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item) => {
        const d = new Date(item.date)
        return {
          date: d.toLocaleDateString(localeTag[locale], {
            month: "short",
            day: "numeric",
          }),
          time: d.toLocaleTimeString(localeTag[locale], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          score: item.total_score,
          fullDate: item.date,
        }
      })
  }, [items, locale])

  if (chartData.length < 2) return null

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUpIcon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{t.scoreTrend}</span>
      </div>
      <div className="w-full h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#888", className: "fill-muted-foreground" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, "auto"]}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#888" }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickCount={6}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: "6px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
              }}
              labelStyle={{ fontWeight: 600, marginBottom: 2 }}
              formatter={(value: number) => [`Score: ${value}`]}
              labelFormatter={(_label, payload) => {
                if (!payload?.length) return ""
                const d = payload[0].payload
                return `${d.date} ${d.time}`
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#8884d8"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#8884d8" }}
              activeDot={{ r: 4, fill: "#8884d8" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface Props {
  patientId: string
}

export function CachedPatientContent({ patientId }: Props) {
  const searchParams = useSearchParams()
  const assessmentId = searchParams.get("assessment")
  const { t, locale } = useLocale()
  const { cache, loading } = useDataCache()

  // Read everything from cache using memoized selectors
  const patient = useCachedPatient(patientId)
  const medications = useCachedMedications(patientId)

  const allItems = useMemo(() => {
    const assessments = Object.values(cache.assessments).filter((a) => a.patient_id === patientId)
    const surveys = Object.values(cache.patient_surveys).filter(
      (s) => s.patient_id === patientId && s.status === "scored" && s.total_score !== null,
    )
    const merged: Array<AssessmentWithType> = [
      ...assessments.map((a) => ({ ...a, type: "ai" as const, date: a.assessment_date })),
      ...surveys.map((s) => ({
        id: s.id, patient_id: s.patient_id!, assessment_date: s.survey_date,
        total_score: s.total_score!, severity_level: s.severity_level!,
        has_screen_intolerance: false, has_night_driving_issues: false,
        has_wind_sensitivity: false, has_low_humidity_issues: false,
        reviewed: true, created_at: s.created_at, type: "survey" as const, date: s.survey_date,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return merged
  }, [cache.assessments, cache.patient_surveys, patientId])

  const selectedAssessment = useMemo(() => {
    if (!allItems.length) return null
    if (assessmentId) return allItems.find((a) => a.id === assessmentId) || allItems[0]
    return allItems[0]
  }, [allItems, assessmentId])

  // Get responses/notes from cache for the selected assessment
  const responses = useMemo(() => {
    if (!selectedAssessment || selectedAssessment.type !== "ai") return []
    return Object.values(cache.assessment_responses)
      .filter((r) => r.assessment_id === selectedAssessment.id)
      .sort((a, b) => a.question_number - b.question_number)
  }, [cache.assessment_responses, selectedAssessment])

  const surveyResponses = useMemo(() => {
    if (!selectedAssessment || selectedAssessment.type !== "survey") return []
    return Object.values(cache.survey_responses)
      .filter((r) => r.survey_id === selectedAssessment.id)
      .sort((a, b) => a.question_number - b.question_number)
  }, [cache.survey_responses, selectedAssessment])

  const notes = useMemo(() => {
    if (!selectedAssessment || selectedAssessment.type !== "ai") return []
    return Object.values(cache.clinician_notes)
      .filter((n) => n.assessment_id === selectedAssessment.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [cache.clinician_notes, selectedAssessment])

  // Show loading state while cache initializes
  if (loading && !patient) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <CacheLoadingState />
        </div>
      </div>
    )
  }

  if (!patient) {
    return <div className="p-6">{t.patient.notFound}</div>
  }

  const assessment = selectedAssessment
  const previousAssessment = allItems[1] || null

  const medStatusStyle = (status: string) => {
    switch (status) {
      case "active": return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
      case "new": return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
      case "stopped": return "border-muted-foreground/30 bg-muted/20 text-muted-foreground/60"
      default: return "border-border bg-accent/20 text-foreground"
    }
  }

  const medStatusLabel = (status: string) => {
    switch (status) {
      case "active": return t.patient.medicationStatus.active
      case "new": return t.patient.medicationStatus.new
      case "stopped": return t.patient.medicationStatus.stopped
      default: return status
    }
  }

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-1.5 h-8 text-sm">
              <ArrowLeftIcon className="size-4" />
              {t.patient.backToDashboard}
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <JoyIndicator />
            <ThemeToggle />
          </div>
        </div>

        {/* Patient Info Header */}
        <PatientInfoClient
          patient={patient}
          assessment={assessment}
          previousScore={previousAssessment?.total_score ?? null}
          locale={locale}
          t={{
            dateOfBirth: t.patient.dateOfBirth,
            osdiScore: t.patient.osdiScore,
            severityLevel: t.patient.severityLevel,
            latestAssessment: t.patient.latestAssessment,
            previousAssessment: t.patient.previousAssessment,
            worsening: t.patient.worsening,
            improving: t.patient.improving,
            stable: t.patient.stable,
          }}
        >
          {assessment && !assessment.reviewed && <MarkReviewedButton assessmentId={assessment.id} />}
        </PatientInfoClient>

        {assessment ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Left Column: Assessment History */}
              <div className="space-y-4 relative z-50">
                <Card className="border-border bg-card shadow-sm">
                  <CardHeader className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TrendingDownIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">{t.patient.assessmentHistory}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2">
                    {allItems.slice(0, 8).map((hist, index) => {
                      const prevHist = allItems[index + 1] || null
                      const histTrend = prevHist ? getTrendIndicator(hist.total_score, prevHist.total_score) : null
                      const isSelected = assessment?.id === hist.id
                      return (
                        <Link key={hist.id} href={`/patient/${patientId}?assessment=${hist.id}`} className="block">
                          <div className={`rounded-lg border px-3 py-2 transition-all cursor-pointer ${isSelected ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border bg-accent/20 hover:bg-accent/40"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="text-base font-bold text-foreground shrink-0">{hist.total_score}</div>
                                <Badge className={`text-[10px] px-1.5 py-0 ${getSeverityColor(hist.severity_level)}`}>
                                  {getSeverityLabel(hist.severity_level, locale)}
                                </Badge>
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                  {hist.type === "ai" ? t.patient.aiAssessment : t.patient.selfSurvey}
                                </Badge>
                                {histTrend && (
                                  <div className={`flex items-center gap-0.5 ${histTrend.color}`}>
                                    <histTrend.icon className="size-3" />
                                  </div>
                                )}
                              </div>
                              <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(hist.date).toLocaleDateString(localeTag[locale], { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                              <div className="flex gap-1">
                                {hist.has_screen_intolerance && <MonitorIcon className="size-2.5 text-amber-500" />}
                                {hist.has_night_driving_issues && <MoonIcon className="size-2.5 text-blue-500" />}
                                {hist.has_wind_sensitivity && <WindIcon className="size-2.5 text-cyan-500" />}
                                {hist.has_low_humidity_issues && <DropletIcon className="size-2.5 text-indigo-500" />}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                    {allItems.length > 8 && (
                      <p className="text-[10px] text-center text-muted-foreground">+{allItems.length - 8} more</p>
                    )}
                    <ScoreTrendChart items={allItems} locale={locale} t={{ scoreTrend: t.patient.scoreTrend }} />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Flags + Meds */}
              <div className="space-y-4">
                <Card className="border-border bg-card shadow-sm">
                  <CardHeader className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <ActivityIcon className="size-3.5 text-muted-foreground" />
                      <CardTitle className="text-xs font-semibold">{t.patient.symptomFlagsTitle}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { flag: assessment.has_screen_intolerance, icon: MonitorIcon, label: t.patient.flagScreenShort, color: "amber" },
                        { flag: assessment.has_night_driving_issues, icon: MoonIcon, label: t.patient.flagNightShort, color: "blue" },
                        { flag: assessment.has_wind_sensitivity, icon: WindIcon, label: t.patient.flagWindShort, color: "cyan" },
                        { flag: assessment.has_low_humidity_issues, icon: DropletIcon, label: t.patient.flagHumidityShort, color: "indigo" },
                      ].map(({ flag, icon: Icon, label, color }) => (
                        <div key={label} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-all ${flag ? `border-${color}-300 bg-${color}-50 dark:border-${color}-800 dark:bg-${color}-950/30` : "border-border bg-accent/20 opacity-50"}`}>
                          <Icon className={`size-3 shrink-0 ${flag ? `text-${color}-600 dark:text-${color}-400` : "text-muted-foreground"}`} />
                          <span className={`text-[10px] whitespace-nowrap ${flag ? "font-medium text-foreground" : "text-muted-foreground"}`}>{flag ? label : `No ${label}`}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card shadow-sm">
                  <CardHeader className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <PillIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">{t.patient.medications}</CardTitle>
                      {medications.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{medications.length}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2">
                    {medications.length === 0 ? (
                      <p className="text-xs text-center text-muted-foreground">{t.patient.noMedications}</p>
                    ) : (
                      medications.map((med) => {
                        const ms = medStatusStyle(med.status)
                        const stopped = med.status === "stopped"
                        return (
                          <div key={med.id} className={`rounded-lg border p-3 space-y-1 transition-all ${stopped ? ms : `${ms} hover:opacity-90`}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className={`text-xs font-semibold ${stopped ? "opacity-60" : ""}`}>{med.medication_name}</h4>
                                <div className={`text-[10px] ${stopped ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                                  {med.dosage && <span>{med.dosage}{med.frequency ? `, ${med.frequency}` : ""}</span>}
                                </div>
                                {med.start_date && !stopped && (
                                  <div className="text-[10px] text-muted-foreground">{t.patient.startDate}: {new Date(med.start_date).toLocaleDateString(localeTag[locale])}</div>
                                )}
                                {med.stop_date && stopped && (
                                  <div className="text-[10px] text-muted-foreground">{t.patient.stopDate}: {new Date(med.stop_date).toLocaleDateString(localeTag[locale])}</div>
                                )}
                                {med.notes && <p className={`text-[10px] mt-1 ${stopped ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{med.notes}</p>}
                              </div>
                              <Badge className={`shrink-0 text-[9px] px-1.5 py-0 ${stopped ? "border-muted-foreground/30 text-muted-foreground bg-transparent" : med.status === "new" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-0" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-0"}`}>
                                {medStatusLabel(med.status)}
                              </Badge>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Clinician Notes */}
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <StethoscopeIcon className="size-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">{t.patient.clinicianNotes}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 space-y-2">
                {notes.length > 0 ? (
                  notes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-border bg-accent/30 p-3 transition-all hover:bg-accent/50">
                      <div className="mb-1 text-xs text-foreground">{note.note_text}</div>
                      <div className="text-[10px] text-muted-foreground">{note.created_by} &bull; {new Date(note.created_at).toLocaleString()}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">{t.patient.noNotesYet}</p>
                )}
                <AddNoteForm assessmentId={assessment.id} />
              </CardContent>
            </Card>

            <AssessmentSidebar
              responses={responses}
              surveyResponses={surveyResponses}
              assessmentType={assessment.type}
              id={patientId}
              locale={locale}
              t={{
                questionByQuestion: t.patient.questionByQuestion,
                patientResponsesTitle: t.patient.patientResponsesTitle,
                assessments: t.patient.assessments,
              }}
            />
          </>
        ) : (
          <div className="py-12 text-center text-muted-foreground">{t.patient.noAssessments}</div>
        )}
      </div>
    </div>
  )
}
