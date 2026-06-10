import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { AssessmentResponse, ClinicianNote, SurveyResponse } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeftIcon,
  MonitorIcon,
  MoonIcon,
  WindIcon,
  DropletIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
} from "lucide-react"
import Link from "next/link"
import { AddNoteForm } from "@/components/add-note-form"
import { MarkReviewedButton } from "@/components/mark-reviewed-button"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { ShareSurveyButton } from "@/components/share-survey-button"
import { getStrings, getSeverityLabel, localeTag, type Locale, type Strings } from "@/lib/i18n"
import { getLocale } from "@/lib/locale"
import { getSeedPatientDetail } from "@/lib/seed-data"

async function getPatientDetail(patientId: string, locale: Locale, assessmentId?: string) {
  if (!isSupabaseConfigured()) return seedPatientDetailOrEmpty(patientId, locale, assessmentId)
  try {
    return await fetchPatientDetail(patientId, assessmentId)
  } catch (error) {
    console.error("Error fetching patient detail:", error)
    return seedPatientDetailOrEmpty(patientId, locale, assessmentId)
  }
}

function seedPatientDetailOrEmpty(patientId: string, locale: Locale, assessmentId?: string) {
  const seed = getSeedPatientDetail(patientId, locale, assessmentId)
  if (seed) return seed
  return {
    patient: null,
    assessment: null,
    assessments: [],
    responses: [] as AssessmentResponse[],
    surveyResponses: [] as SurveyResponse[],
    notes: [] as ClinicianNote[],
    medications: [],
  }
}

async function fetchPatientDetail(patientId: string, assessmentId?: string) {
  const supabase = await createServerClient()

  const { data: patient } = await supabase.from("patients").select("*").eq("id", patientId).single()

  // Fetch all assessments for this patient
  const { data: assessments } = await supabase
    .from("assessments")
    .select("*")
    .eq("patient_id", patientId)
    .order("assessment_date", { ascending: false })

  const { data: surveys } = await supabase
    .from("patient_surveys")
    .select("*")
    .eq("patient_id", patientId)
    .eq("status", "scored")
    .order("survey_date", { ascending: false })

  const allAssessments = [
    ...(assessments || []).map((a) => ({
      ...a,
      type: "ai" as const,
      date: a.assessment_date,
    })),
    ...(surveys || []).map((s) => ({
      id: s.id,
      patient_id: s.patient_id!,
      assessment_date: s.survey_date,
      total_score: s.total_score!,
      severity_level: s.severity_level!,
      has_screen_intolerance: false,
      has_night_driving_issues: false,
      has_wind_sensitivity: false,
      has_low_humidity_issues: false,
      reviewed: true,
      created_at: s.created_at,
      type: "survey" as const,
      date: s.survey_date,
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
        .from("assessment_responses")
        .select("*")
        .eq("assessment_id", selectedAssessment.id)
        .order("question_number", { ascending: true })

      const { data: notesData } = await supabase
        .from("clinician_notes")
        .select("*")
        .eq("assessment_id", selectedAssessment.id)
        .order("created_at", { ascending: false })

      responses = responsesData || []
      notes = notesData || []
    } else {
      // Fetch survey responses
      const { data: surveyResponsesData } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", selectedAssessment.id)
        .order("question_number", { ascending: true })

      surveyResponses = surveyResponsesData || []
    }
  }

  const { data: medications } = await supabase
    .from("patient_medications")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })

  return {
    patient,
    assessment: selectedAssessment,
    assessments: allAssessments,
    responses,
    surveyResponses,
    notes,
    medications: medications || [],
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

const scoreLabels: Record<Locale, string[]> = {
  he: ["אף פעם", "לעיתים רחוקות", "לעיתים", "לעתים קרובות", "תמיד"],
  en: ["Never", "Rarely", "Sometimes", "Often", "Always"],
}

function getScoreLabel(score: number, locale: Locale): string {
  return scoreLabels[locale][score] || (locale === "he" ? "לא ידוע" : "Unknown")
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
    id,
    locale,
    assessmentId,
  )

  if (!patient) {
    return <div className="p-6"> {t.patient.notFound}</div>
  }

  const previousAssessment = assessments[1] || null
  const trend =
    assessment && previousAssessment
      ? getTrendIndicator(assessment.total_score, previousAssessment.total_score, t)
      : null

  const activeMedications = medications.filter((m) => m.status === "active" || m.status === "new")
  const stoppedMedications = medications.filter((m) => m.status === "stopped")

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2">
              <ArrowLeftIcon className="size-4" />
              {t.patient.backToDashboard}
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border pb-6">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-3xl font-bold">{patient.name}</CardTitle>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {patient.date_of_birth && (
                    <span>
                      {t.patient.dateOfBirth}: {new Date(patient.date_of_birth).toLocaleDateString(localeTag[locale])}
                    </span>
                  )}
                  {patient.email && <span>{patient.email}</span>}
                  {patient.phone && <span>{patient.phone}</span>}
                  <span className="font-medium text-foreground">
                    {assessments.length} {t.patient.assessments}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ShareSurveyButton patientId={patient.id} patientName={patient.name} />
                {assessment && !assessment.reviewed && <MarkReviewedButton assessmentId={assessment.id} />}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {assessment ? (
              <>
                <div className="grid gap-6 sm:grid-cols-3">
                  <Card className="border-border bg-accent/30 shadow-sm transition-all hover:shadow-md">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="text-5xl font-bold text-foreground">{assessment.total_score}</div>
                        {trend && (
                          <div className={`flex items-center gap-1 ${trend.color}`}>
                            <trend.icon className="size-5" />
                            <span className="text-xs font-medium">{trend.label}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-sm font-medium text-muted-foreground">{t.patient.osdiScore}</div>
                      {previousAssessment && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t.patient.previousAssessment}: {previousAssessment.total_score}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-accent/30 shadow-sm transition-all hover:shadow-md">
                    <CardContent className="pt-6">
                      <Badge className={`text-base font-semibold ${getSeverityColor(assessment.severity_level)}`}>
                        {getSeverityLabel(assessment.severity_level, locale)}
                      </Badge>
                      <div className="mt-2 text-sm font-medium text-muted-foreground">{t.patient.severityLevel}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-border bg-accent/30 shadow-sm transition-all hover:shadow-md">
                    <CardContent className="pt-6">
                      <div className="text-lg font-semibold text-foreground">
                        {new Date(assessment.date).toLocaleDateString(localeTag[locale], {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="mt-2 text-sm font-medium text-muted-foreground">{t.patient.latestAssessment}</div>
                    </CardContent>
                  </Card>
                </div>

                <Tabs defaultValue="current" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4 gap-2">
                    <TabsTrigger value="current">{t.patient.currentAssessment}</TabsTrigger>
                    <TabsTrigger value="history">{t.patient.assessmentHistory}</TabsTrigger>
                    <TabsTrigger value="medications">{t.patient.medications}</TabsTrigger>
                    <TabsTrigger value="notes">{t.patient.clinicianNotes}</TabsTrigger>
                  </TabsList>

                  {/* Current Assessment Tab Content */}
                  <TabsContent value="current" className="space-y-6 mt-6">
                    <Card className="border-border bg-card shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-xl">{t.patient.symptomFlagsTitle}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div
                            className={`flex items-center gap-3 rounded-lg border p-4 transition-all ${
                              assessment.has_screen_intolerance
                                ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                                : "border-border bg-accent/20"
                            }`}
                          >
                            <MonitorIcon
                              className={`size-5 ${
                                assessment.has_screen_intolerance
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <span
                              className={`font-medium ${
                                assessment.has_screen_intolerance ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {t.patient.screenIntolerance}
                            </span>
                          </div>
                          <div
                            className={`flex items-center gap-3 rounded-lg border p-4 transition-all ${
                              assessment.has_night_driving_issues
                                ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                                : "border-border bg-accent/20"
                            }`}
                          >
                            <MoonIcon
                              className={`size-5 ${
                                assessment.has_night_driving_issues
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <span
                              className={`font-medium ${
                                assessment.has_night_driving_issues ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {t.patient.nightDrivingIssues}
                            </span>
                          </div>
                          <div
                            className={`flex items-center gap-3 rounded-lg border p-4 transition-all ${
                              assessment.has_wind_sensitivity
                                ? "border-cyan-300 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-950/30"
                                : "border-border bg-accent/20"
                            }`}
                          >
                            <WindIcon
                              className={`size-5 ${
                                assessment.has_wind_sensitivity
                                  ? "text-cyan-600 dark:text-cyan-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <span
                              className={`font-medium ${
                                assessment.has_wind_sensitivity ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {t.patient.windSensitivity}
                            </span>
                          </div>
                          <div
                            className={`flex items-center gap-3 rounded-lg border p-4 transition-all ${
                              assessment.has_low_humidity_issues
                                ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30"
                                : "border-border bg-accent/20"
                            }`}
                          >
                            <DropletIcon
                              className={`size-5 ${
                                assessment.has_low_humidity_issues
                                  ? "text-indigo-600 dark:text-indigo-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <span
                              className={`font-medium ${
                                assessment.has_low_humidity_issues ? "text-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {t.patient.humidityIssues}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {assessment?.type === "ai" && responses.length > 0 && (
                      <Card className="border-border bg-card shadow-sm">
                        <CardContent className="space-y-3">
                          {responses.map((response) => (
                            <div
                              key={response.id}
                              className="rounded-lg border border-border bg-accent/30 p-4 transition-all hover:bg-accent/50"
                            >
                              <div className="mb-3 flex items-start justify-between gap-4">
                                <div className="font-medium">
                                  <span className="text-muted-foreground">Q{response.question_number}.</span>{" "}
                                  {response.question_text}
                                </div>
                                <Badge variant="outline" className="shrink-0 font-semibold">
                                  {response.patient_response}/4 - {getScoreLabel(response.patient_response, locale)}
                                </Badge>
                              </div>
                              {response.patient_quote && (
                                <div className="mb-2 italic text-muted-foreground">"{response.patient_quote}"</div>
                              )}
                              {response.reasoning && (
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">{t.patient.clinicalNote}:</span>{" "}
                                  {response.reasoning}
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {assessment?.type === "survey" && surveyResponses.length > 0 && (
                      <Card className="border-border bg-card shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-xl font-semibold text-foreground">
                            {t.patient.patientResponsesTitle}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {surveyResponses.map((response) => (
                            <div key={response.id} className="border-b border-border pb-4 last:border-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="text-sm font-medium text-foreground">
                                  {t.patient.question} {response.question_number}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {t.patient.score}: {response.assigned_score}/4
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium">{t.patient.frequency}:</span>{" "}
                                  {t.survey.frequency[response.frequency as keyof typeof t.survey.frequency]}
                                </div>
                                {response.free_text && (
                                  <div className="text-sm bg-muted p-3 rounded-md">
                                    <span className="font-medium text-foreground">{t.patient.patientDescription}:</span>
                                    <p className="mt-1 text-muted-foreground">{response.free_text}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    <Card className="border-border bg-card shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-xl">{t.patient.clinicianNotes}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {notes.length > 0 ? (
                          notes.map((note) => (
                            <div
                              key={note.id}
                              className="rounded-lg border border-border bg-accent/30 p-4 transition-all hover:bg-accent/50"
                            >
                              <div className="mb-2 text-foreground">{note.note_text}</div>
                              <div className="text-xs text-muted-foreground">
                                {note.created_by} • {new Date(note.created_at).toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">{t.patient.noNotesYet}</p>
                        )}
                        <AddNoteForm assessmentId={assessment.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Assessment History Tab Content */}
                  <TabsContent value="history" className="space-y-4 mt-6">
                    {assessments.map((hist, index) => {
                      const prevHist = assessments[index + 1] || null
                      const histTrend = prevHist ? getTrendIndicator(hist.total_score, prevHist.total_score, t) : null
                      const isSelected = assessment?.id === hist.id

                      return (
                        <Card
                          key={hist.id}
                          className={`border-border bg-card shadow-sm transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`}
                        >
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-4">
                                  <div className="text-3xl font-bold text-foreground">{hist.total_score}</div>
                                  <Badge className={`text-sm ${getSeverityColor(hist.severity_level)}`}>
                                    {getSeverityLabel(hist.severity_level, locale)}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {hist.type === "ai" ? t.patient.aiAssessment : t.patient.selfSurvey}
                                  </Badge>
                                  {histTrend && (
                                    <div className={`flex items-center gap-1 ${histTrend.color}`}>
                                      <histTrend.icon className="size-4" />
                                      <span className="text-xs font-medium">{histTrend.label}</span>
                                    </div>
                                  )}
                                  {isSelected && (
                                    <Badge variant="outline" className="text-xs">
                                      {t.patient.viewing}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(hist.date).toLocaleDateString(localeTag[locale], {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                                {/* Existing symptom flags */}
                                <div className="flex gap-2 mt-3">
                                  {hist.has_screen_intolerance && (
                                    <Badge variant="outline" className="text-xs">
                                      <MonitorIcon className="size-3 mr-1" />
                                      {t.patient.flagScreenShort}
                                    </Badge>
                                  )}
                                  {hist.has_night_driving_issues && (
                                    <Badge variant="outline" className="text-xs">
                                      <MoonIcon className="size-3 mr-1" />
                                      {t.patient.flagNightShort}
                                    </Badge>
                                  )}
                                  {hist.has_wind_sensitivity && (
                                    <Badge variant="outline" className="text-xs">
                                      <WindIcon className="size-3 mr-1" />
                                      {t.patient.flagWindShort}
                                    </Badge>
                                  )}
                                  {hist.has_low_humidity_issues && (
                                    <Badge variant="outline" className="text-xs">
                                      <DropletIcon className="size-3 mr-1" />
                                      {t.patient.flagHumidityShort}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="hover:bg-accent transition-colors bg-transparent"
                              >
                                <Link href={`/patient/${id}?assessment=${hist.id}`}>{t.patient.viewReport}</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </TabsContent>

                  {/* Medications Tab Content */}
                  <TabsContent value="medications" className="space-y-6">
                    {/* Active Medications */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {t.patient.activeMedications}
                          <Badge variant="secondary" className="text-xs">
                            {activeMedications.length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {activeMedications.length === 0 ? (
                          <p className="text-center text-muted-foreground">{t.patient.noMedications}</p>
                        ) : (
                          <div className="space-y-4">
                            {activeMedications.map((med) => (
                              <div key={med.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-1">
                                    <h4 className="font-semibold text-lg">{med.medication_name}</h4>
                                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                                      {med.dosage && (
                                        <div>
                                          <span className="font-medium">{t.patient.dosage}:</span> {med.dosage}
                                        </div>
                                      )}
                                      {med.frequency && (
                                        <div>
                                          <span className="font-medium">{t.patient.frequency}:</span> {med.frequency}
                                        </div>
                                      )}
                                      {med.start_date && (
                                        <div>
                                          <span className="font-medium">{t.patient.startDate}:</span>{" "}
                                          {new Date(med.start_date).toLocaleDateString(localeTag[locale])}
                                        </div>
                                      )}
                                    </div>
                                    {med.notes && <p className="text-sm text-muted-foreground mt-2">{med.notes}</p>}
                                  </div>
                                  {med.status === "new" && (
                                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                                      {t.patient.medicationStatus.new}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Stopped Medications */}
                    {stoppedMedications.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            {t.patient.stoppedMedications}
                            <Badge variant="secondary" className="text-xs">
                              {stoppedMedications.length}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {stoppedMedications.map((med) => (
                              <div key={med.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-1">
                                    <h4 className="font-semibold text-lg opacity-60">{med.medication_name}</h4>
                                    <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                                      {med.dosage && (
                                        <div>
                                          <span className="font-medium">{t.patient.dosage}:</span> {med.dosage}
                                        </div>
                                      )}
                                      {med.stop_date && (
                                        <div>
                                          <span className="font-medium">{t.patient.stopDate}:</span>{" "}
                                          {new Date(med.stop_date).toLocaleDateString(localeTag[locale])}
                                        </div>
                                      )}
                                    </div>
                                    {med.notes && <p className="text-sm text-muted-foreground mt-2">{med.notes}</p>}
                                  </div>
                                  <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                                    {t.patient.medicationStatus.stopped}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Clinician Notes Tab Content */}
                  <TabsContent value="notes" className="space-y-6 mt-6">
                    <Card className="border-border bg-card shadow-sm">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-xl">{t.patient.clinicianNotes}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {notes.length > 0 ? (
                          notes.map((note) => (
                            <div
                              key={note.id}
                              className="rounded-lg border border-border bg-accent/30 p-4 transition-all hover:bg-accent/50"
                            >
                              <div className="mb-2 text-foreground">{note.note_text}</div>
                              <div className="text-xs text-muted-foreground">
                                {note.created_by} • {new Date(note.created_at).toLocaleString()}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">{t.patient.noNotesYet}</p>
                        )}
                        <AddNoteForm assessmentId={assessment.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="py-12 text-center text-muted-foreground">{t.patient.noAssessments}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
