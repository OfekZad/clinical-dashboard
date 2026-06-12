import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  JoyActionLogType,
  JoyEscalationReason,
  JoyIntent,
  JoyMedicationContext,
  JoyRefillDecision,
  JoySmsPayload,
} from "@/lib/types"

const CLINICAL_TERMS = [
  "pain",
  "hurt",
  "dizzy",
  "rash",
  "swelling",
  "bleeding",
  "allergic",
  "reaction",
  "side effect",
  "side-effect",
  "symptom",
  "sick",
  "nausea",
  "vomit",
  "headache",
  "pregnant",
  "dose",
  "dosage",
  "increase",
  "decrease",
  "change how",
  "stop taking",
]

const HUMAN_TERMS = ["person", "human", "staff", "nurse", "doctor", "dr miller", "call me", "office"]
const AFFIRMATIVE_TERMS = ["yes", "y", "yeah", "yep", "ok", "okay", "sure", "please", "refill", "need", "send it"]
const NEGATIVE_TERMS = ["no", "n", "nope", "not now", "don't", "dont", "stop", "cancel"]
const PHARMACY_CHANGE_TERMS = ["different pharmacy", "new pharmacy", "change pharmacy", "switch pharmacy", "cvs", "walgreens", "rite aid", "costco", "walmart"]

export function classifyJoyIntent(message: string): { intent: JoyIntent; confidence: number; escalationReason?: JoyEscalationReason } {
  const normalized = normalizeMessage(message)

  if (!normalized) {
    return { intent: "unclear", confidence: 0.2, escalationReason: "low_confidence" }
  }

  if (containsAny(normalized, CLINICAL_TERMS)) {
    return { intent: "clinical_question", confidence: 0.9, escalationReason: "clinical_advice_or_symptoms" }
  }

  if (containsAny(normalized, HUMAN_TERMS)) {
    return { intent: "speak_to_staff", confidence: 0.9, escalationReason: "patient_requested_staff" }
  }

  if (containsAny(normalized, PHARMACY_CHANGE_TERMS)) {
    return { intent: "change_pharmacy", confidence: 0.75, escalationReason: "missing_required_data" }
  }

  if (containsAny(normalized, NEGATIVE_TERMS)) {
    return { intent: "decline_refill", confidence: 0.8 }
  }

  if (containsAny(normalized, AFFIRMATIVE_TERMS)) {
    return { intent: "confirm_refill", confidence: 0.82 }
  }

  return { intent: "unclear", confidence: 0.35, escalationReason: "low_confidence" }
}

export function buildJoyOpeningMessage(context: JoyMedicationContext): string {
  return [
    `Hi ${context.patient.name}, this is Joy from Dr. Miller's office.`,
    `Our records show you may be low on ${formatMedicationLabel(context)}.`,
    context.preferred_pharmacy ? `Would you like me to start a refill request with ${context.preferred_pharmacy}?` : "Would you like me to start a refill request?",
  ].join(" ")
}

export function buildJoyReply(decision: JoyRefillDecision, context: JoyMedicationContext): string {
  if (decision.action === "create_refill_request") {
    return `Thanks — I started a refill request for ${formatMedicationLabel(context)}. Dr. Miller's office will review it and follow up if anything else is needed.`
  }

  if (decision.action === "close_declined") {
    return `No problem. I will not start a refill request for ${formatMedicationLabel(context)} right now. Reply if you need help later.`
  }

  if (decision.action === "ask_clarifying_question") {
    return `Sorry, I want to make sure I understood. Reply YES if you want a refill request for ${formatMedicationLabel(context)}, or STAFF if you want someone from Dr. Miller's office to help.`
  }

  return "Thanks for letting me know. I am sending this to Dr. Miller's office so a staff member can help. If this is urgent, please call the office directly."
}

export async function startJoyRefillOutreach(supabase: SupabaseClient, patientMedicationRecordId: string) {
  const context = await loadMedicationContext(supabase, patientMedicationRecordId)

  if (!context) {
    throw new Error("Unable to find a low-supply patient medication record for Joy outreach")
  }

  const message = buildJoyOpeningMessage(context)
  const conversation = await upsertConversation(supabase, context, "outreach_sent")
  await saveSmsMessage(supabase, conversation.id, "outbound", message, "outreach")
  await logJoyAction(supabase, {
    patient_id: context.patient.id,
    patient_medication_id: context.patient_medication_id,
    conversation_id: conversation.id,
    action_type: "outreach_started",
    details: { message },
  })

  return { context, conversation_id: conversation.id, message }
}

export async function processJoySmsReply(supabase: SupabaseClient, payload: JoySmsPayload) {
  const context = await loadMedicationContextByConversationOrPhone(supabase, payload)

  if (!context) {
    await logJoyAction(supabase, {
      action_type: "escalated",
      details: { reason: "missing_required_data", payload },
    })
    throw new Error("Unable to identify the patient and medication for this SMS reply")
  }

  const conversation = await upsertConversation(supabase, context, "patient_replied", payload.conversation_id)
  await saveSmsMessage(supabase, conversation.id, "inbound", payload.message, "patient_reply")

  const classification = classifyJoyIntent(payload.message)
  const decision = decideRefillAction(context, classification)

  if (decision.action === "create_refill_request") {
    await createRefillRequest(supabase, context, conversation.id)
  }

  if (decision.action === "escalate_to_staff") {
    await createStaffTask(supabase, context, conversation.id, decision.reason ?? "low_confidence", payload.message)
  }

  await updateConversationStatus(supabase, conversation.id, decision.conversationStatus)
  const reply = buildJoyReply(decision, context)
  await saveSmsMessage(supabase, conversation.id, "outbound", reply, decision.action)
  await logJoyAction(supabase, {
    patient_id: context.patient.id,
    patient_medication_id: context.patient_medication_id,
    conversation_id: conversation.id,
    action_type: decision.action === "escalate_to_staff" ? "escalated" : decision.action,
    details: { classification, decision, reply },
  })

  return { context, conversation_id: conversation.id, classification, decision, reply }
}

function decideRefillAction(
  context: JoyMedicationContext,
  classification: ReturnType<typeof classifyJoyIntent>,
): JoyRefillDecision {
  if (classification.escalationReason) {
    return {
      action: "escalate_to_staff",
      reason: classification.escalationReason,
      conversationStatus: "escalated",
    }
  }

  if (classification.confidence < 0.7 || classification.intent === "unclear") {
    return { action: "ask_clarifying_question", conversationStatus: "needs_patient_reply" }
  }

  if (classification.intent === "decline_refill") {
    return { action: "close_declined", conversationStatus: "closed_declined" }
  }

  if (!context.refill_eligible || context.prescription_status !== "active") {
    return {
      action: "escalate_to_staff",
      reason: "not_refillable_automatically",
      conversationStatus: "escalated",
    }
  }

  if (!context.preferred_pharmacy || !context.medication_id || !context.patient_medication_id) {
    return {
      action: "escalate_to_staff",
      reason: "missing_required_data",
      conversationStatus: "escalated",
    }
  }

  return { action: "create_refill_request", conversationStatus: "refill_requested" }
}

async function loadMedicationContext(supabase: SupabaseClient, patientMedicationRecordId: string): Promise<JoyMedicationContext | null> {
  const { data, error } = await supabase
    .from("patient_medications")
    .select("id, patient_id, medication_id, medication_name, dosage, dosage_strength, dosage_form, instructions, quantity_remaining, estimated_days_remaining, refill_eligible, prescription_status, preferred_pharmacy, last_refill_date, rxnorm_code, ndc_code, pharmacy_medication_id, patients(id, name, phone)")
    .eq("id", patientMedicationRecordId)
    .eq("low_on_medicine", true)
    .maybeSingle()

  if (error || !data) return null
  return mapMedicationContext(data as PatientMedicationRow)
}

async function loadMedicationContextByConversationOrPhone(
  supabase: SupabaseClient,
  payload: JoySmsPayload,
): Promise<JoyMedicationContext | null> {
  if (payload.conversation_id) {
    const { data } = await supabase
      .from("joy_sms_conversations")
      .select("patient_medication_id")
      .eq("id", payload.conversation_id)
      .maybeSingle()

    const conversation = data as { patient_medication_id?: string } | null
    if (conversation?.patient_medication_id) {
      return loadMedicationContext(supabase, conversation.patient_medication_id)
    }
  }

  if (!payload.from_phone) return null

  const { data, error } = await supabase
    .from("patient_medications")
    .select("id, patient_id, medication_id, medication_name, dosage, dosage_strength, dosage_form, instructions, quantity_remaining, estimated_days_remaining, refill_eligible, prescription_status, preferred_pharmacy, last_refill_date, rxnorm_code, ndc_code, pharmacy_medication_id, patients!inner(id, name, phone)")
    .eq("low_on_medicine", true)
    .eq("patients.phone", payload.from_phone)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return mapMedicationContext(data as PatientMedicationRow)
}

async function upsertConversation(
  supabase: SupabaseClient,
  context: JoyMedicationContext,
  status: string,
  conversationId?: string,
): Promise<{ id: string }> {
  if (conversationId) {
    const { data, error } = await supabase
      .from("joy_sms_conversations")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .select("id")
      .single()

    if (error) throw new Error(`Failed to update Joy SMS conversation: ${error.message}`)
    return data as { id: string }
  }

  const { data, error } = await supabase
    .from("joy_sms_conversations")
    .insert({
      patient_id: context.patient.id,
      patient_medication_id: context.patient_medication_id,
      status,
    })
    .select("id")
    .single()

  if (error) throw new Error(`Failed to create Joy SMS conversation: ${error.message}`)
  return data as { id: string }
}

async function saveSmsMessage(
  supabase: SupabaseClient,
  conversationId: string,
  direction: "inbound" | "outbound",
  body: string,
  messageType: string,
) {
  const { error } = await supabase.from("joy_sms_messages").insert({
    conversation_id: conversationId,
    direction,
    body,
    message_type: messageType,
  })

  if (error) throw new Error(`Failed to save Joy SMS message: ${error.message}`)
}

async function createRefillRequest(supabase: SupabaseClient, context: JoyMedicationContext, conversationId: string) {
  const { error } = await supabase.from("refill_requests").insert({
    patient_id: context.patient.id,
    patient_medication_id: context.patient_medication_id,
    medication_id: context.medication_id,
    preferred_pharmacy: context.preferred_pharmacy,
    status: "pending_review",
    source: "joy_sms",
    conversation_id: conversationId,
  })

  if (error) throw new Error(`Failed to create refill request: ${error.message}`)
}

async function createStaffTask(
  supabase: SupabaseClient,
  context: JoyMedicationContext,
  conversationId: string,
  reason: JoyEscalationReason,
  patientMessage: string,
) {
  const { error } = await supabase.from("staff_follow_up_tasks").insert({
    patient_id: context.patient.id,
    patient_medication_id: context.patient_medication_id,
    conversation_id: conversationId,
    task_type: "joy_refill_escalation",
    priority: reason === "clinical_advice_or_symptoms" ? "high" : "normal",
    status: "open",
    reason,
    summary: `Joy escalated a refill SMS conversation. Patient message: ${patientMessage}`,
  })

  if (error) throw new Error(`Failed to create staff follow-up task: ${error.message}`)
}

async function updateConversationStatus(supabase: SupabaseClient, conversationId: string, status: string) {
  const { error } = await supabase
    .from("joy_sms_conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", conversationId)

  if (error) throw new Error(`Failed to update conversation status: ${error.message}`)
}

async function logJoyAction(
  supabase: SupabaseClient,
  log: {
    patient_id?: string
    patient_medication_id?: string
    conversation_id?: string
    action_type: JoyActionLogType
    details: Record<string, unknown>
  },
) {
  const { error } = await supabase.from("joy_action_logs").insert(log)
  if (error) console.error("Failed to log Joy action", error)
}

function mapMedicationContext(row: PatientMedicationRow): JoyMedicationContext {
  const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      phone: patient.phone,
    },
    medication_id: row.medication_id,
    patient_medication_id: row.id,
    medicine_name: row.medication_name,
    dosage_strength: row.dosage_strength ?? row.dosage,
    dosage_form: row.dosage_form,
    instructions: row.instructions,
    quantity_remaining: row.quantity_remaining,
    estimated_days_remaining: row.estimated_days_remaining,
    refill_eligible: row.refill_eligible,
    prescription_status: row.prescription_status,
    preferred_pharmacy: row.preferred_pharmacy,
    last_refill_date: row.last_refill_date,
    external_ids: {
      rxnorm: row.rxnorm_code,
      ndc: row.ndc_code,
      pharmacyMedicationId: row.pharmacy_medication_id,
    },
  }
}

function formatMedicationLabel(context: JoyMedicationContext) {
  return [context.medicine_name, context.dosage_strength, context.dosage_form].filter(Boolean).join(" ")
}

function normalizeMessage(message: string) {
  return message.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim()
}

function containsAny(message: string, terms: string[]) {
  return terms.some((term) => message.includes(term))
}

type PatientMedicationRow = {
  id: string
  patient_id: string
  medication_id: string | null
  medication_name: string
  dosage: string | null
  dosage_strength: string | null
  dosage_form: string | null
  instructions: string | null
  quantity_remaining: number | null
  estimated_days_remaining: number | null
  refill_eligible: boolean
  prescription_status: "active" | "expired" | "cancelled" | "unknown"
  preferred_pharmacy: string | null
  last_refill_date: string | null
  rxnorm_code: string | null
  ndc_code: string | null
  pharmacy_medication_id: string | null
  patients: {
    id: string
    name: string
    phone: string | null
  } | Array<{
    id: string
    name: string
    phone: string | null
  }>
}
