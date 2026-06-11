export type Patient = {
  id: string
  name: string // Simplified to single name field
  date_of_birth: string | null // Made date_of_birth optional
  email: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export type Assessment = {
  id: string
  patient_id: string
  assessment_date: string
  total_score: number
  severity_level: "Normal" | "Mild" | "Moderate" | "Severe"
  has_screen_intolerance: boolean
  has_night_driving_issues: boolean
  has_wind_sensitivity: boolean
  has_low_humidity_issues: boolean
  reviewed: boolean
  created_at: string
}

export type AssessmentResponse = {
  id: string
  assessment_id: string
  question_number: number
  question_text: string
  patient_response: number
  patient_quote: string | null
  reasoning: string | null
  created_at: string
}

export type ClinicianNote = {
  id: string
  assessment_id: string
  note_text: string
  created_by: string | null
  created_at: string
}

export type PatientWithLatestAssessment = Patient & {
  latest_assessment: Assessment | null
  previous_assessment: Assessment | null
}

export type PatientSurvey = {
  id: string
  patient_id: string | null
  patient_name: string | null
  patient_email: string | null
  patient_phone: string | null
  survey_date: string
  status: "pending" | "scored" | "archived"
  total_score: number | null
  severity_level: "Normal" | "Mild" | "Moderate" | "Severe" | null
  clinician_notes: string | null
  created_at: string
  updated_at: string
}

export type SurveyResponse = {
  id: string
  survey_id: string
  question_number: number
  frequency: "none" | "sometimes" | "half" | "most" | "all" | "not_applicable"
  free_text: string | null
  assigned_score: number | null
  created_at: string
}

export type PatientSurveyWithResponses = PatientSurvey & {
  responses: SurveyResponse[]
}

export type RetellAssessmentPayload = {
  patient: {
    name: string
    date_of_birth?: string
    phone?: string
    email?: string
  }
  responses: Array<{
    question_number: number
    score: number
    quote: string
    reasoning: string
  }>
  summary: {
    chief_complaint: string
    key_observations: string[]
  }
}

export type PatientMedication = {
  id: string
  patient_id: string
  survey_id: string | null
  medication_name: string
  dosage: string | null
  frequency: string | null
  status: "active" | "stopped" | "new"
  start_date: string | null
  stop_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type MedicationUpdate = {
  medication_name: string
  dosage?: string
  frequency?: string
  status: "active" | "stopped" | "new"
  start_date?: string
  stop_date?: string
  notes?: string
}

export type Call = {
  id: string
  patient_id: string
  call_number: number
  assessment_id: string | null
  dial_call_id: string | null
  called_at: string
  status: "completed" | "no_answer" | "declined" | "failed" | "cancelled"
  duration_seconds: number | null
  transcript: string | null
  summary: string | null
  next_time: string | null
  medication_adherence: "confirmed" | "changed" | "not_discussed" | null
  medication_notes: string | null
  created_at: string
  updated_at: string
}

export type AssessmentWithType = Assessment & {
  type: "ai" | "survey"
  date: string
}

export type ROIMetrics = {
  timeSavings: {
    totalAssessments: number
    totalMinutesSaved: number
    averageTimePerAssessment: number // in seconds
    monthlyHoursSaved: number
    estimatedMonthlySavings: number // in currency
  }
  clinicalOutcomes: {
    totalPatients: number
    improvingPatients: number
    improvementRate: number
    averageScoreReduction: number
    severeToClinicallySignificant: number
    treatmentSuccessRate: number
  }
  revenueOptimization: {
    additionalCapacity: number // extra patients per month
    surveyCompletionRate: number
    followUpComplianceRate: number
    estimatedRevenueIncrease: number
  }
  patientEngagement: {
    totalSurveysSent: number
    surveysCompleted: number
    completionRate: number
    averageResponseTime: number // in hours
    activePatients: number
    retentionRate: number
  }
}

export type MonthlyTrend = {
  month: string
  assessments: number
  surveys: number
  timeSaved: number
  improvingPatients: number
}
