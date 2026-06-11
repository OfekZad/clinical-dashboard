import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { AssessmentResponse, ClinicianNote, SurveyResponse } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeftIcon, MonitorIcon, MoonIcon, WindIcon, DropletIcon,
  TrendingUpIcon, TrendingDownIcon, MinusIcon, ChevronRightIcon,
  ActivityIcon, PillIcon, StethoscopeIcon, MessageSquareQuoteIcon,
  BrainIcon, ListChecksIcon,
} from "lucide-react"
import Link from "next/link"
import { AddNoteForm } from "@/components/add-note-form"
import { MarkReviewedButton } from "@/components/mark-reviewed-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { ShareSurveyButton } from "@/components/share-survey-button"
import { getStrings, getSeverityLabel, localeTag, type Locale, type Strings, type FrequencyKey } from "@/lib/i18n"
import { getLocale } from "@/lib/locale"
import { getSeedPatientDetail } from "@/lib/seed-data"
import { PatientInfoClient } from "@/components/patient-info-client"
import { AssessmentSidebar } from "@/components/assessment-sidebar"


async function getPatientDetail(patientId: string, locale: Locale, assessmentId?: string) {
  if (!isSupabaseConfigured()) return seedPatientDetailOrEmpty(patientId, locale, assessmentId)
  try {
    const result = await fetchPatientDetail(patientId, assessmentId)
    if (!result.patient) {
      const seed = getSeedPatientDetail(patientId, locale, assessmentId)
      if (seed) return seed
    }
    return result
  } catch (error) {
    console.error("Error fetching patient detail:", error)
    return seedPatientDetailOrEmpty(patientId, locale, assessmentId)
  }
}

function seedPatientDetailOrEmpty(patientId: string, locale: Locale, assessmentId?: string) {
  const seed = getSeedPatientDetail(patientId, locale, assessmentId)
  if (seed) return seed
  return {
    patient: null, assessment: null, assessments: [],
    responses: [] as AssessmentResponse[], surveyResponses: [] as SurveyResponse[],
    notes: [] as ClinicianNote[], medications: [],
  }
}

async function fetchPatientDetail(patientId: string, assessmentId?: string) {
  const supabase = await createServerClient()
  const { data: patient } = await supabase.from("patients").select("*").eq("id", patientId).single()
  const { data: assessments } = await supabase
    .from("assessments").select("*").eq("patient_id", patientId).order("assessment_date", { ascending: false })
  const { data: surveys } = await supabase
    .from("patient_surveys").select("*").eq("patient_id", patientId).eq("status", "scored").order("survey_date", { ascending: false })

  const allAssessments = [
    ...(assessments || []).map((a) => ({ ...a, type: "ai" as const, date: a.assessment_date })),
    ...(surveys || []).map((s) => ({
      id: s.id, patient_id: s.patient_id!, assessment_date: s.survey_date,
      total_score: s.total_score!, severity_level: s.severity_level!,
      has_screen_intolerance: false, has_night_driving_issues: false,
      has_wind_sensitivity: false, has_low_humidity_issues: false,
      reviewed: true, created_at: s.created_at, type: "survey" as const, date: s.survey_date,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const selectedAssessment = assessmentId
    ? allAssessments?.find((a) => a.id === assessmentId) || allAssessments?.[0]
    : allAssessments?.[0] || null

  let responses: AssessmentResponse[] = []
  let surveyResponses: SurveyResponse[] = []
  let notes: ClinicianNote[] = []

  if (selectedAssessment) {
    if (selectedAssessment.type === "ai") {
      const { data: responsesData } = await supabase
        .from("assessment_responses").select("*").eq("assessment_id", selectedAssessment.id).order("question_number", { ascending: true })
      const { data: notesData } = await supabase
        .from("clinician_notes").select("*").eq("assessment_id", selectedAssessment.id).order("created_at", { ascending: false })
      responses = responsesData || []
      notes = notesData || []
    } else {
      const { data: surveyResponsesData } = await supabase
        .from("survey_responses").select("*").eq("survey_id", selectedAssessment.id).order("question_number", { ascending: true })
      surveyResponses = surveyResponsesData || []
    }
  }

  const { data: medications } = await supabase
    .from("patient_medications").select("*").eq("patient_id", patientId).order("created_at", { ascending: false })

  return {
    patient, assessment: selectedAssessment, assessments: allAssessments,
    responses, surveyResponses, notes, medications: medications || [],
  }
}


function getSeverityColor(severity: string) {
  switch (severity) {
    case "Normal":
      return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800"
    case "Mild":
      return "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-800"
    case "Moderate":
      return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800"
    case "Severe":
      return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800"
    default:
      return "text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950/50 dark:border-gray-800"
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

const frequencyLabels: Record<FrequencyKey, { en: string; he: string }> = {
  none: { en: "Never", he: "\u05d0\u05e3 \u05e4\u05e2\u05dd" },
  sometimes: { en: "Sometimes", he: "\u05dc\u05e4\u05e2\u05de\u05d9\u05dd" },
  half: { en: "About half", he: "\u05db\u05de\u05d7\u05e6\u05d9\u05ea" },
  most: { en: "Most of the time", he: "\u05e8\u05d5\u05d1 \u05d4\u05d6\u05de\u05df" },
  all: { en: "All the time", he: "\u05db\u05dc \u05d4\u05d6\u05de\u05df" },
  not_applicable: { en: "N/A", he: "\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9" },
}

function getTrendIndicator(currentScore: number, previousScore: number | null, t: Strings) {
  if (previousScore === null) return null
  const diff = currentScore - previousScore
  if (diff > 5) return { icon: TrendingUpIcon, label: t.patient.worsening, color: "text-red-600 dark:text-red-400" }
  if (diff < -5)
    return { icon: TrendingDownIcon, label: t.patient.improving, color: "text-emerald-600 dark:text-emerald-400" }
  return { icon: MinusIcon, label: t.patient.stable, color: "text-gray-600 dark:text-gray-400" }
}


export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ assessment?: string }>
}) {
  const { id } = await params
  const { assessment: assessmentId } = await searchParams
  const locale = await getLocale()
  const t = getStrings(locale)
  const { patient, assessment, assessments, responses, surveyResponses, notes, medications } = await getPatientDetail(
    id, locale, assessmentId,
  )

  if (!patient) {
    return <div className="p-6"> {t.patient.notFound}</div>
  }

  const previousAssessment = assessments[1] || null

  const medStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
      case "new":
        return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
      case "stopped":
        return "border-muted-foreground/30 bg-muted/20 text-muted-foreground/60"
      default:
        return "border-border bg-accent/20 text-foreground"
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
            {/* <LanguageToggle /> */}
            <ThemeToggle />
          </div>
        </div>

        {/* Patient Info Header + Summary Cards */}
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
          {/* <ShareSurveyButton patientId={patient.id} patientName={patient.name} /> */}
          {assessment && !assessment.reviewed && <MarkReviewedButton assessmentId={assessment.id} />}
        </PatientInfoClient>

        {assessment ? (
          <>
            {/* Two equal columns: Left = History (z-above overlay), Right = Flags + Meds */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Left Column: Assessment History (picker) — stays above backdrop when sidebar open */}
              <div className="space-y-4 relative z-50">
                <Card className="border-border bg-card shadow-sm">
                  <CardHeader className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <TrendingDownIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">{t.patient.assessmentHistory}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0 space-y-2">
                    {assessments.slice(0, 8).map((hist, index) => {
                      const prevHist = assessments[index + 1] || null
                      const histTrend = prevHist ? getTrendIndicator(hist.total_score, prevHist.total_score, t) : null
                      const isSelected = assessment?.id === hist.id

                      return (
                        <Link key={hist.id} href={`/patient/${id}?assessment=${hist.id}`} className="block">
                          <div
                            className={`rounded-lg border px-3 py-2 transition-all cursor-pointer ${
                              isSelected
                                ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                                : "border-border bg-accent/20 hover:bg-accent/40"
                            }`}
                          >
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
                                {new Date(hist.date).toLocaleDateString(localeTag[locale], {
                                  month: "short", day: "numeric", year: "numeric",
                                })}
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
                    {assessments.length > 8 && (
                      <p className="text-[10px] text-center text-muted-foreground">
                        +{assessments.length - 8} more
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Symptom Flags + Medications (always visible) */}
              <div className="space-y-4">
                {/* Symptom Flags */}
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
                        <div
                          key={label}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-all ${
                            flag
                              ? `border-${color}-300 bg-${color}-50 dark:border-${color}-800 dark:bg-${color}-950/30`
                              : "border-border bg-accent/20 opacity-50"
                          }`}
                        >
                          <Icon className={`size-3 shrink-0 ${flag ? `text-${color}-600 dark:text-${color}-400` : "text-muted-foreground"}`} />
                          <span className={`text-[10px] whitespace-nowrap ${flag ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                            {flag ? label : `No ${label}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Medications */}
                <Card className="border-border bg-card shadow-sm">
                  <CardHeader className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <PillIcon className="size-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">{t.patient.medications}</CardTitle>
                      {medications.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {medications.length}
                        </Badge>
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
                          <div
                            key={med.id}
                            className={`rounded-lg border p-3 space-y-1 transition-all ${stopped ? ms : `${ms} hover:opacity-90`}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className={`text-xs font-semibold ${stopped ? "opacity-60" : ""}`}>{med.medication_name}</h4>
                                <div className={`text-[10px] ${stopped ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                                  {med.dosage && <span>{med.dosage}{med.frequency ? `, ${med.frequency}` : ""}</span>}
                                </div>
                                {med.start_date && !stopped && (
                                  <div className="text-[10px] text-muted-foreground">
                                    {t.patient.startDate}: {new Date(med.start_date).toLocaleDateString(localeTag[locale])}
                                  </div>
                                )}
                                {med.stop_date && stopped && (
                                  <div className="text-[10px] text-muted-foreground">
                                    {t.patient.stopDate}: {new Date(med.stop_date).toLocaleDateString(localeTag[locale])}
                                  </div>
                                )}
                                {med.notes && <p className={`text-[10px] mt-1 ${stopped ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{med.notes}</p>}
                              </div>
                              <Badge
                                className={`shrink-0 text-[9px] px-1.5 py-0 ${
                                  stopped
                                    ? "border-muted-foreground/30 text-muted-foreground bg-transparent"
                                    : med.status === "new"
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-0"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-0"
                                }`}
                              >
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

            {/* Clinician Notes — full width at the bottom */}
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
                      <div className="text-[10px] text-muted-foreground">
                        {note.created_by} &bull; {new Date(note.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">{t.patient.noNotesYet}</p>
                )}
                <AddNoteForm assessmentId={assessment.id} />
              </CardContent>
            </Card>

            {/* Sidebar — overlay + slide-in panel, rendered client-side */}
            <AssessmentSidebar
              responses={responses}
              surveyResponses={surveyResponses}
              assessmentType={assessment.type}
              id={id}
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
