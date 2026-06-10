// Hardcoded fallback seed data.
//
// Used to populate the UI when Supabase is not configured or a query fails, so
// the dashboard, patient pages and analytics still render meaningful demo data
// instead of an empty screen or a crash.

import { getStrings, type Locale } from "@/lib/i18n"
import type {
  Assessment,
  AssessmentResponse,
  AssessmentWithType,
  ClinicianNote,
  MonthlyTrend,
  Patient,
  PatientMedication,
  PatientWithLatestAssessment,
  ROIMetrics,
  SurveyResponse,
} from "@/lib/types"

type Localized = { he: string; en: string }

function pick(value: Localized, locale: Locale): string {
  return value[locale] ?? value.he
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function dateOnly(days: number): string {
  return daysAgo(days).slice(0, 10)
}

// ---------------------------------------------------------------------------
// Single source of truth for the seed patients
// ---------------------------------------------------------------------------

type SeedResponse = {
  question_number: number
  patient_response: number
  quote: Localized
  reasoning: Localized
}

type SeedMedication = {
  id: string
  medication_name: string
  dosage: Localized | null
  frequency: Localized | null
  status: "active" | "stopped" | "new"
  start_date: string | null
  stop_date: string | null
  notes: Localized | null
}

type SeedNote = {
  id: string
  note_text: Localized
  created_by: string
  created_at: string
}

type SeedPatientRecord = {
  patient: Patient
  // Newest assessment first
  assessments: Assessment[]
  responses: SeedResponse[] // detailed responses for the latest assessment
  notes: SeedNote[]
  medications: SeedMedication[]
}

function makePatient(id: string, name: string, dob: string | null, email: string, phone: string): Patient {
  return {
    id,
    name,
    date_of_birth: dob,
    email,
    phone,
    created_at: daysAgo(120),
    updated_at: daysAgo(1),
  }
}

function makeAssessment(
  id: string,
  patientId: string,
  daysAgoValue: number,
  totalScore: number,
  severity: Assessment["severity_level"],
  flags: Partial<Pick<
    Assessment,
    "has_screen_intolerance" | "has_night_driving_issues" | "has_wind_sensitivity" | "has_low_humidity_issues"
  >>,
  reviewed: boolean,
): Assessment {
  return {
    id,
    patient_id: patientId,
    assessment_date: daysAgo(daysAgoValue),
    total_score: totalScore,
    severity_level: severity,
    has_screen_intolerance: flags.has_screen_intolerance ?? false,
    has_night_driving_issues: flags.has_night_driving_issues ?? false,
    has_wind_sensitivity: flags.has_wind_sensitivity ?? false,
    has_low_humidity_issues: flags.has_low_humidity_issues ?? false,
    reviewed,
    created_at: daysAgo(daysAgoValue),
  }
}

const SEED_RECORDS: SeedPatientRecord[] = [
  {
    patient: makePatient("seed-sarah", "Sarah Johnson", "1978-05-15", "sarah.j@email.com", "555-0101"),
    assessments: [
      makeAssessment("seed-sarah-a2", "seed-sarah", 2, 82, "Severe", {
        has_screen_intolerance: true,
        has_night_driving_issues: true,
        has_low_humidity_issues: true,
      }, false),
      makeAssessment("seed-sarah-a1", "seed-sarah", 40, 88, "Severe", {
        has_screen_intolerance: true,
        has_low_humidity_issues: true,
      }, true),
      makeAssessment("seed-sarah-a0", "seed-sarah", 70, 95, "Severe", {
        has_screen_intolerance: true,
        has_night_driving_issues: true,
        has_wind_sensitivity: true,
        has_low_humidity_issues: true,
      }, true),
    ],
    responses: [
      {
        question_number: 1,
        patient_response: 4,
        quote: {
          he: "אני בקושי יכולה להסתכל על מסך המחשב בלי כאב",
          en: "I can barely look at my computer screen without pain",
        },
        reasoning: {
          he: "המטופלת מדווחת על רגישות קשה לאור המשפיעה על עבודתה היומיומית",
          en: "Patient reports severe photophobia affecting her daily work",
        },
      },
      {
        question_number: 2,
        patient_response: 3,
        quote: { he: "מרגיש כמו חול בעיניים כל הזמן", en: "It feels like sand in my eyes all the time" },
        reasoning: {
          he: "תחושת גוף זר מתמשכת מעידה על יובש משמעותי",
          en: "Persistent foreign-body sensation indicates significant dry eye",
        },
      },
      {
        question_number: 3,
        patient_response: 4,
        quote: { he: "הצריבה קבועה לאורך כל היום", en: "The burning pain is constant throughout the day" },
        reasoning: { he: "כאב עיני קשה הדורש התערבות", en: "Severe ocular pain requiring intervention" },
      },
      {
        question_number: 4,
        patient_response: 3,
        quote: {
          he: "הראייה מתבהרת אחרי מצמוץ אבל מטשטשת מהר",
          en: "Vision clears after blinking but gets blurry quickly",
        },
        reasoning: {
          he: "חוסר יציבות בשכבת הדמעות משפיע על חדות הראייה",
          en: "Tear film instability affecting visual acuity",
        },
      },
      {
        question_number: 5,
        patient_response: 2,
        quote: {
          he: "רק כשאני עובדת מול מחשב לאורך זמן",
          en: "Only when working on the computer for extended periods",
        },
        reasoning: { he: "זמן מסך מחמיר את התסמינים", en: "Screen time exacerbates symptoms" },
      },
      {
        question_number: 6,
        patient_response: 3,
        quote: {
          he: "קשה לי לקרוא יותר מכמה דקות לפני שהעיניים נשרפות",
          en: "I can't read for more than a few minutes before my eyes burn",
        },
        reasoning: {
          he: "התסמינים מחמירים בקריאה ממושכת",
          en: "Symptoms worsen with sustained reading",
        },
      },
      {
        question_number: 7,
        patient_response: 4,
        quote: {
          he: "הילות סביב פנסים מקשות עליי מאוד לנהוג בלילה",
          en: "Halos around headlights make night driving very difficult",
        },
        reasoning: {
          he: "פיזור אור עקב חוסר יציבות בשכבת הדמעות",
          en: "Light scatter from an unstable tear film",
        },
      },
      {
        question_number: 8,
        patient_response: 4,
        quote: {
          he: "אחרי שעה מול המסך העיניים שלי אדומות ויבשות",
          en: "After an hour at the screen my eyes are red and dry",
        },
        reasoning: {
          he: "ירידה בקצב המצמוץ מול מסך מחמירה את היובש",
          en: "Reduced blink rate at screens worsens the dryness",
        },
      },
      {
        question_number: 9,
        patient_response: 2,
        quote: {
          he: "לפעמים אני צריכה לעצום עיניים באמצע צפייה בטלוויזיה",
          en: "Sometimes I have to close my eyes while watching TV",
        },
        reasoning: {
          he: "אי-נוחות מתונה בצפייה ממושכת",
          en: "Moderate discomfort during prolonged viewing",
        },
      },
      {
        question_number: 10,
        patient_response: 3,
        quote: {
          he: "רוח גורמת לי לדמעות ולצריבה מיידית",
          en: "Wind causes immediate tearing and burning",
        },
        reasoning: {
          he: "רגישות סביבתית האופיינית ליובש בינוני-חמור",
          en: "Environmental sensitivity typical of moderate-to-severe dry eye",
        },
      },
      {
        question_number: 11,
        patient_response: 4,
        quote: {
          he: "מיזוג האוויר במשרד הורס לי את היום",
          en: "The office air-conditioning ruins my day",
        },
        reasoning: {
          he: "סביבה יבשה מאיצה את אידוי הדמעות",
          en: "Dry environments accelerate tear evaporation",
        },
      },
      {
        question_number: 12,
        patient_response: 3,
        quote: {
          he: "בימים יבשים אני מטפטפת דמעות מלאכותיות כל שעה",
          en: "On dry days I use artificial tears every hour",
        },
        reasoning: {
          he: "תלות גבוהה בתחליפי דמעות בתנאי לחות נמוכה",
          en: "High reliance on tear substitutes in low humidity",
        },
      },
    ],
    notes: [
      {
        id: "seed-sarah-note-1",
        note_text: {
          he: "המטופלת מציגה שיפור עם משטר הטיפול הנוכחי. נרשמו פקקי דמעות וטיפות ציקלוספורין. מעקב בעוד 6 שבועות.",
          en: "Patient showing improvement with the current treatment regimen. Prescribed punctal plugs and cyclosporine drops. Follow up in 6 weeks.",
        },
        created_by: "Dr. Elad",
        created_at: daysAgo(2),
      },
      {
        id: "seed-sarah-note-2",
        note_text: {
          he: "המטופלת החלה טיפול בטיפות ציקלוספורין והומלץ להפסיק עדשות מגע למשך החודש הקרוב. דמעות מלאכותיות ללא חומר משמר לפי הצורך.",
          en: "Patient started cyclosporine drops; advised to stop contact lenses for the next month. Preservative-free artificial tears as needed.",
        },
        created_by: "Dr. Elad",
        created_at: daysAgo(20),
      },
    ],
    medications: [
      {
        id: "seed-sarah-med-1",
        medication_name: "Restasis (Cyclosporine)",
        dosage: { he: "טיפה אחת", en: "One drop" },
        frequency: { he: "פעמיים ביום", en: "Twice daily" },
        status: "active",
        start_date: dateOnly(40),
        stop_date: null,
        notes: { he: "לטיפול ביובש כרוני", en: "For chronic dry eye" },
      },
      {
        id: "seed-sarah-med-2",
        medication_name: "Artificial Tears",
        dosage: { he: "טיפה אחת", en: "One drop" },
        frequency: { he: "לפי הצורך", en: "As needed" },
        status: "new",
        start_date: dateOnly(2),
        stop_date: null,
        notes: null,
      },
      {
        id: "seed-sarah-med-3",
        medication_name: "Steroid drops",
        dosage: null,
        frequency: null,
        status: "stopped",
        start_date: dateOnly(60),
        stop_date: dateOnly(40),
        notes: { he: "הופסק לאחר התלקחות ראשונית", en: "Stopped after initial flare-up" },
      },
    ],
  },
  {
    patient: makePatient("seed-michael", "Michael Chen", "1965-09-22", "mchen@email.com", "555-0102"),
    assessments: [
      makeAssessment("seed-michael-a2", "seed-michael", 1, 38, "Moderate", {
        has_night_driving_issues: true,
        has_wind_sensitivity: true,
      }, true),
      makeAssessment("seed-michael-a1", "seed-michael", 35, 52, "Severe", { has_night_driving_issues: true }, true),
    ],
    responses: [],
    notes: [],
    medications: [
      {
        id: "seed-michael-med-1",
        medication_name: "Artificial Tears",
        dosage: { he: "טיפה אחת", en: "One drop" },
        frequency: { he: "4 פעמים ביום", en: "4 times a day" },
        status: "active",
        start_date: dateOnly(35),
        stop_date: null,
        notes: null,
      },
    ],
  },
  {
    patient: makePatient("seed-emily", "Emily Rodriguez", "1982-12-08", "emily.r@email.com", "555-0103"),
    assessments: [
      makeAssessment("seed-emily-a2", "seed-emily", 5, 18, "Mild", {}, true),
      makeAssessment("seed-emily-a1", "seed-emily", 33, 15, "Mild", {}, true),
    ],
    responses: [],
    notes: [],
    medications: [],
  },
  {
    patient: makePatient("seed-robert", "Robert Williams", "1955-03-30", "rwilliams@email.com", "555-0104"),
    assessments: [
      makeAssessment("seed-robert-a2", "seed-robert", 1, 68, "Severe", {
        has_screen_intolerance: true,
        has_night_driving_issues: true,
        has_wind_sensitivity: true,
        has_low_humidity_issues: true,
      }, false),
      makeAssessment("seed-robert-a1", "seed-robert", 30, 60, "Severe", {
        has_screen_intolerance: true,
        has_wind_sensitivity: true,
      }, true),
    ],
    responses: [],
    notes: [],
    medications: [],
  },
  {
    patient: makePatient("seed-jennifer", "Jennifer Taylor", "1990-07-19", "jtaylor@email.com", "555-0105"),
    assessments: [
      makeAssessment("seed-jennifer-a2", "seed-jennifer", 3, 8, "Normal", {}, true),
      makeAssessment("seed-jennifer-a1", "seed-jennifer", 28, 22, "Mild", {}, true),
    ],
    responses: [],
    notes: [],
    medications: [],
  },
]

// ---------------------------------------------------------------------------
// Derived views used by the data-fetching functions
// ---------------------------------------------------------------------------

export const SEED_PENDING_SURVEYS_COUNT = 3

export function getSeedDashboardPatients(): PatientWithLatestAssessment[] {
  return SEED_RECORDS.map((record) => ({
    ...record.patient,
    latest_assessment: record.assessments[0] ?? null,
    previous_assessment: record.assessments[1] ?? null,
  }))
}

export function getSeedPatientById(id: string): Pick<Patient, "id" | "name" | "email" | "phone"> | null {
  const record = SEED_RECORDS.find((r) => r.patient.id === id) ?? SEED_RECORDS[0]
  if (!record) return null
  return {
    id: record.patient.id,
    name: record.patient.name,
    email: record.patient.email,
    phone: record.patient.phone,
  }
}

export type SeedPatientDetail = {
  patient: Patient
  assessment: AssessmentWithType | null
  assessments: AssessmentWithType[]
  responses: AssessmentResponse[]
  surveyResponses: SurveyResponse[]
  notes: ClinicianNote[]
  medications: PatientMedication[]
}

export function getSeedPatientDetail(id: string, locale: Locale, assessmentId?: string): SeedPatientDetail | null {
  const record = SEED_RECORDS.find((r) => r.patient.id === id)
  if (!record) return null

  const strings = getStrings(locale)

  const assessments: AssessmentWithType[] = record.assessments.map((a) => ({
    ...a,
    type: "ai" as const,
    date: a.assessment_date,
  }))

  const selectedAssessment = assessmentId
    ? assessments.find((a) => a.id === assessmentId) ?? assessments[0] ?? null
    : assessments[0] ?? null

  const isLatest = selectedAssessment ? selectedAssessment.id === record.assessments[0]?.id : false

  const responses: AssessmentResponse[] =
    isLatest && selectedAssessment
      ? record.responses.map((r, index) => ({
          id: `${selectedAssessment.id}-r${r.question_number}`,
          assessment_id: selectedAssessment.id,
          question_number: r.question_number,
          question_text:
            strings.survey.questions[r.question_number as keyof typeof strings.survey.questions] ??
            `Q${r.question_number}`,
          patient_response: r.patient_response,
          patient_quote: pick(r.quote, locale),
          reasoning: pick(r.reasoning, locale),
          created_at: selectedAssessment.date,
        }))
      : []

  const notes: ClinicianNote[] =
    isLatest && selectedAssessment
      ? record.notes.map((n) => ({
          id: n.id,
          assessment_id: selectedAssessment.id,
          note_text: pick(n.note_text, locale),
          created_by: n.created_by,
          created_at: n.created_at,
        }))
      : []

  const medications: PatientMedication[] = record.medications.map((m) => ({
    id: m.id,
    patient_id: record.patient.id,
    survey_id: null,
    medication_name: m.medication_name,
    dosage: m.dosage ? pick(m.dosage, locale) : null,
    frequency: m.frequency ? pick(m.frequency, locale) : null,
    status: m.status,
    start_date: m.start_date,
    stop_date: m.stop_date,
    notes: m.notes ? pick(m.notes, locale) : null,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
  }))

  return {
    patient: record.patient,
    assessment: selectedAssessment,
    assessments,
    responses,
    surveyResponses: [],
    notes,
    medications,
  }
}

export function getSeedROIMetrics(): ROIMetrics {
  return {
    timeSavings: {
      totalAssessments: 10,
      totalMinutesSaved: 1250,
      averageTimePerAssessment: 30,
      monthlyHoursSaved: 21,
      estimatedMonthlySavings: 10500,
    },
    clinicalOutcomes: {
      totalPatients: 5,
      improvingPatients: 3,
      improvementRate: 60,
      averageScoreReduction: 12,
      severeToClinicallySignificant: 2,
      treatmentSuccessRate: 60,
    },
    revenueOptimization: {
      additionalCapacity: 84,
      surveyCompletionRate: 85,
      followUpComplianceRate: 80,
      estimatedRevenueIncrease: 29400,
    },
    patientEngagement: {
      totalSurveysSent: 12,
      surveysCompleted: 7,
      completionRate: 85,
      averageResponseTime: 24,
      activePatients: 5,
      retentionRate: 100,
    },
  }
}

// Counts for the last 6 months, ordered oldest -> newest
const SEED_MONTHLY_COUNTS = [
  { assessments: 3, surveys: 2 },
  { assessments: 5, surveys: 3 },
  { assessments: 4, surveys: 4 },
  { assessments: 6, surveys: 3 },
  { assessments: 5, surveys: 5 },
  { assessments: 7, surveys: 4 },
]

export function getSeedMonthlyTrends(locale: Locale): MonthlyTrend[] {
  const months = getStrings(locale).roi.months
  return SEED_MONTHLY_COUNTS.map((counts, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (SEED_MONTHLY_COUNTS.length - 1 - index))
    return {
      month: months[date.getMonth()],
      assessments: counts.assessments,
      surveys: counts.surveys,
      timeSaved: counts.assessments * 7.5 + counts.surveys * 5,
      improvingPatients: Math.round(counts.assessments * 0.4),
    }
  })
}
