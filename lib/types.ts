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

export type RefillEligibilityStatus = "eligible" | "provider_approval_required" | "staff_review" | "not_eligible"

export type PrescriptionStatus = "active" | "expired" | "cancelled" | "completed" | "unknown"

export type JoyConversationStatus = "active" | "waiting_for_patient" | "refill_requested" | "escalated" | "closed"

export type JoyIntent =
  | "refill_approval"
  | "refill_rejection"
  | "refill_status_question"
  | "pharmacy_change"
  | "medication_confusion"
  | "staff_request"
  | "clinical_question"
  | "unclear"
  | "out_of_scope"

export type JoyMedicationIdentity = {
  internal_medication_id: string | null
  patient_medication_record_id: string
  medication_name: string
  generic_name: string | null
  brand_name: string | null
  dosage_strength: string | null
  dosage_form: string | null
  prescribed_instructions: string | null
  quantity_prescribed: number | null
  remaining_quantity: number | null
  estimated_supply_days: number | null
  refill_eligibility_status: RefillEligibilityStatus
  prescription_status: PrescriptionStatus
  prescribing_provider: string | null
  preferred_pharmacy: string | null
  pharmacy_phone: string | null
  pharmacy_system_id: string | null
  last_refill_date: string | null
  next_expected_refill_date: string | null
  rxnorm_code: string | null
  ndc_code: string | null
  external_medication_identifiers: Record<string, unknown>
}

export type JoyPatientMedication = PatientMedication & JoyMedicationIdentity & {
  low_medication_flag: boolean
  low_medication_detected_at: string | null
}

export type JoyRefillConversation = {
  id: string
  patient_id: string
  patient_medication_id: string
  channel: "sms"
  status: JoyConversationStatus
  last_detected_intent: JoyIntent | null
  escalation_reason: string | null
  sms_from: string | null
  sms_to: string | null
  started_at: string
  last_message_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type JoySmsMessage = {
  id: string
  conversation_id: string
  patient_id: string
  patient_medication_id: string
  direction: "inbound" | "outbound"
  body: string
  interpreted_intent: JoyIntent | null
  external_message_id: string | null
  created_at: string
}

export type JoyRefillRequest = {
  id: string
  conversation_id: string | null
  patient_id: string
  patient_medication_id: string
  medication_id: string | null
  pharmacy_name: string | null
  pharmacy_phone: string | null
  status: "pending" | "submitted" | "provider_review" | "staff_review" | "approved" | "denied" | "cancelled"
  requested_by: string
  requested_at: string
  submitted_at: string | null
  outcome_notes: string | null
  created_at: string
  updated_at: string
}

export type JoyStaffTask = {
  id: string
  conversation_id: string | null
  patient_id: string
  patient_medication_id: string | null
  task_type: string
  reason: string
  status: "open" | "in_progress" | "resolved" | "cancelled"
  priority: "low" | "normal" | "high" | "urgent"
  assigned_to: string | null
  created_by: string
  created_at: string
  resolved_at: string | null
}
