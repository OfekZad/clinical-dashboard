import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  JoyConversationStatus,
  JoyIntent,
  JoyMedicationIdentity,
  JoyPatientMedication,
  JoyRefillConversation,
  Patient,
} from "@/lib/types"

type JsonObject = Record<string, unknown>

type JoyContext = {
  patient: Pick<Patient, "id" | "name" | "phone">
  medication: JoyPatientMedication
  conversation: JoyRefillConversation
}

export type JoySmsDelivery = {
  to: string
  body: string
  provider: "configured_webhook" | "console"
  externalMessageId: string | null
}

export type JoyReplyResult = {
  intent: JoyIntent
  responseBody: string
  status: JoyConversationStatus
  refillRequestId?: string
  staffTaskId?: string
  sms: JoySmsDelivery | null
}

const CLINICAL_TERMS = [
  "side effect",
  "side effects",
  "dizzy",
  "rash",
  "pain",
  "hurt",
  "allergic",
  "allergy",
  "pregnant",
  "dose",
  "dosage",
  "take more",
  "take less",
  "stop taking",
  "symptom",
  "symptoms",
  "emergency",
]

const STAFF_TERMS = ["person", "human", "staff", "office", "doctor", "dr miller", "nurse", "call me", "representative"]
const APPROVAL_TERMS = ["yes", "yep", "yeah", "please", "refill", "ok", "okay", "sure", "need it", "send it", "sounds good"]
const REJECTION_TERMS = ["no", "nope", "don't", "do not", "dont", "not now", "already have", "enough", "cancel"]
const STATUS_TERMS = ["status", "ready", "when", "where is", "did it", "processed", "approved"]
const PHARMACY_TERMS = ["pharmacy", "cvs", "walgreens", "rite aid", "walmart", "costco", "change pharmacy", "different pharmacy"]
const CONFUSION_TERMS = ["which", "what med", "what medication", "confused", "not mine", "wrong", "don't know", "dont know"]

function normalizeMessage(message: string): string {
  return message.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim()
}

function includesAny(message: string, terms: string[]): boolean {
  return terms.some((term) => message.includes(term))
}

export function detectJoyIntent(message: string): JoyIntent {
  const normalized = normalizeMessage(message)

  if (!normalized) return "unclear"
  if (includesAny(normalized, CLINICAL_TERMS)) return "clinical_question"
  if (includesAny(normalized, STAFF_TERMS)) return "staff_request"
  if (includesAny(normalized, PHARMACY_TERMS)) return "pharmacy_change"
  if (includesAny(normalized, STATUS_TERMS)) return "refill_status_question"
  if (includesAny(normalized, CONFUSION_TERMS)) return "medication_confusion"
  if (includesAny(normalized, REJECTION_TERMS)) return "refill_rejection"
  if (includesAny(normalized, APPROVAL_TERMS)) return "refill_approval"

  return "unclear"
}

export function getMedicationIdentity(medication: JoyPatientMedication): JoyMedicationIdentity {
  return {
    internal_medication_id: medication.internal_medication_id,
    patient_medication_record_id: medication.id,
    medication_name: medication.medication_name,
    generic_name: medication.generic_name,
    brand_name: medication.brand_name,
    dosage_strength: medication.dosage_strength ?? medication.dosage,
    dosage_form: medication.dosage_form,
    prescribed_instructions: medication.prescribed_instructions ?? medication.frequency,
    quantity_prescribed: medication.quantity_prescribed,
    remaining_quantity: medication.remaining_quantity,
    estimated_supply_days: medication.estimated_supply_days,
    refill_eligibility_status: medication.refill_eligibility_status,
    prescription_status: medication.prescription_status,
    prescribing_provider: medication.prescribing_provider,
    preferred_pharmacy: medication.preferred_pharmacy,
    pharmacy_phone: medication.pharmacy_phone,
    pharmacy_system_id: medication.pharmacy_system_id,
    last_refill_date: medication.last_refill_date,
    next_expected_refill_date: medication.next_expected_refill_date,
    rxnorm_code: medication.rxnorm_code,
    ndc_code: medication.ndc_code,
    external_medication_identifiers: medication.external_medication_identifiers ?? {},
  }
}

export function formatMedicationForSms(medication: JoyPatientMedication): string {
  const dosage = medication.dosage_strength ?? medication.dosage
  return [medication.medication_name, dosage].filter(Boolean).join(" ")
}

export function buildInitialRefillSms(patient: Pick<Patient, "name">, medication: JoyPatientMedication): string {
  const displayMedication = formatMedicationForSms(medication)
  return `Hi ${patient.name}, this is Joy from Dr. Miller's office. Our records show you may be low on ${displayMedication}. Would you like help requesting a refill? Reply YES, NO, or STAFF.`
}

function buildEscalationSms(reason: string): string {
  if (reason === "clinical_question") {
    return "Thanks for letting us know. I can't answer clinical questions by text, so I've asked Dr. Miller's office to follow up with you."
  }

  return "Thanks. I've asked Dr. Miller's office to review this and follow up with you."
}

async function logAudit(
  supabase: SupabaseClient,
  input: {
    patientId: string | null
    patientMedicationId: string | null
    conversationId: string | null
    actionType: string
    outcome: string
    details?: JsonObject
  },
): Promise<void> {
  const { error } = await supabase.from("joy_audit_logs").insert({
    patient_id: input.patientId,
    patient_medication_id: input.patientMedicationId,
    conversation_id: input.conversationId,
    action_type: input.actionType,
    outcome: input.outcome,
    details: input.details ?? {},
  })

  if (error) {
    console.error("Joy audit log failed:", error)
  }
}

async function sendSms(to: string | null, body: string): Promise<JoySmsDelivery | null> {
  if (!to) return null

  const webhookUrl = process.env.JOY_SMS_WEBHOOK_URL
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, body, from: process.env.JOY_SMS_FROM_NUMBER ?? null }),
    })

    if (!response.ok) {
      throw new Error(`SMS webhook failed with status ${response.status}`)
    }

    const payload = (await response.json().catch(() => ({}))) as { messageId?: string }
    return { to, body, provider: "configured_webhook", externalMessageId: payload.messageId ?? null }
  }

  console.info("Joy SMS delivery skipped; JOY_SMS_WEBHOOK_URL is not configured", { to, body })
  return { to, body, provider: "console", externalMessageId: null }
}

async function storeMessage(
  supabase: SupabaseClient,
  input: {
    conversationId: string
    patientId: string
    patientMedicationId: string
    direction: "inbound" | "outbound"
    body: string
    interpretedIntent?: JoyIntent | null
    externalMessageId?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from("joy_sms_messages").insert({
    conversation_id: input.conversationId,
    patient_id: input.patientId,
    patient_medication_id: input.patientMedicationId,
    direction: input.direction,
    body: input.body,
    interpreted_intent: input.interpretedIntent ?? null,
    external_message_id: input.externalMessageId ?? null,
  })

  if (error) throw error
}

export async function startJoyRefillConversation(
  supabase: SupabaseClient,
  input: { patientId: string; patientMedicationId: string; smsTo?: string | null },
): Promise<{ conversation: JoyRefillConversation; sms: JoySmsDelivery | null; medicationIdentity: JoyMedicationIdentity }> {
  const [{ data: patient, error: patientError }, { data: medication, error: medicationError }] = await Promise.all([
    supabase.from("patients").select("id, name, phone").eq("id", input.patientId).single(),
    supabase.from("patient_medications").select("*").eq("id", input.patientMedicationId).eq("patient_id", input.patientId).single(),
  ])

  if (patientError || !patient) throw new Error("Patient not found")
  if (medicationError || !medication) throw new Error("Medication record not found")

  await logAudit(supabase, {
    patientId: patient.id,
    patientMedicationId: medication.id,
    conversationId: null,
    actionType: "read_medication_identity",
    outcome: "success",
    details: { medicationIdentity: getMedicationIdentity(medication as JoyPatientMedication) },
  })

  const { data: conversation, error: conversationError } = await supabase
    .from("joy_refill_conversations")
    .insert({
      patient_id: patient.id,
      patient_medication_id: medication.id,
      status: "waiting_for_patient",
      sms_to: input.smsTo ?? patient.phone,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (conversationError || !conversation) throw conversationError ?? new Error("Failed to create Joy conversation")

  await logAudit(supabase, {
    patientId: patient.id,
    patientMedicationId: medication.id,
    conversationId: conversation.id,
    actionType: "create_refill_conversation",
    outcome: "success",
  })

  const body = buildInitialRefillSms(patient, medication as JoyPatientMedication)
  const sms = await sendSms(input.smsTo ?? patient.phone, body)

  await storeMessage(supabase, {
    conversationId: conversation.id,
    patientId: patient.id,
    patientMedicationId: medication.id,
    direction: "outbound",
    body,
    externalMessageId: sms?.externalMessageId ?? null,
  })

  await logAudit(supabase, {
    patientId: patient.id,
    patientMedicationId: medication.id,
    conversationId: conversation.id,
    actionType: "send_initial_sms",
    outcome: sms ? "success" : "missing_patient_phone",
    details: { provider: sms?.provider ?? null },
  })

  return {
    conversation: conversation as JoyRefillConversation,
    sms,
    medicationIdentity: getMedicationIdentity(medication as JoyPatientMedication),
  }
}

async function loadContext(supabase: SupabaseClient, conversationId: string): Promise<JoyContext> {
  const { data: conversation, error: conversationError } = await supabase
    .from("joy_refill_conversations")
    .select("*")
    .eq("id", conversationId)
    .single()

  if (conversationError || !conversation) throw new Error("Joy conversation not found")

  const [{ data: patient, error: patientError }, { data: medication, error: medicationError }] = await Promise.all([
    supabase.from("patients").select("id, name, phone").eq("id", conversation.patient_id).single(),
    supabase.from("patient_medications").select("*").eq("id", conversation.patient_medication_id).single(),
  ])

  if (patientError || !patient) throw new Error("Patient not found")
  if (medicationError || !medication) throw new Error("Medication record not found")

  await logAudit(supabase, {
    patientId: patient.id,
    patientMedicationId: medication.id,
    conversationId,
    actionType: "read_conversation_context",
    outcome: "success",
  })

  return {
    patient,
    medication: medication as JoyPatientMedication,
    conversation: conversation as JoyRefillConversation,
  }
}

async function escalate(
  supabase: SupabaseClient,
  context: JoyContext,
  reason: string,
  responseBody = buildEscalationSms(reason),
  intent: JoyIntent = reason as JoyIntent,
): Promise<JoyReplyResult> {
  const { data: task, error: taskError } = await supabase
    .from("joy_staff_tasks")
    .insert({
      conversation_id: context.conversation.id,
      patient_id: context.patient.id,
      patient_medication_id: context.medication.id,
      reason,
      priority: reason === "clinical_question" ? "high" : "normal",
    })
    .select("id")
    .single()

  if (taskError || !task) throw taskError ?? new Error("Failed to create staff task")

  const sms = await sendSms(context.patient.phone, responseBody)

  await storeMessage(supabase, {
    conversationId: context.conversation.id,
    patientId: context.patient.id,
    patientMedicationId: context.medication.id,
    direction: "outbound",
    body: responseBody,
    externalMessageId: sms?.externalMessageId ?? null,
  })

  await supabase
    .from("joy_refill_conversations")
    .update({
      status: "escalated",
      escalation_reason: reason,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.conversation.id)

  await logAudit(supabase, {
    patientId: context.patient.id,
    patientMedicationId: context.medication.id,
    conversationId: context.conversation.id,
    actionType: "create_staff_follow_up_task",
    outcome: "success",
    details: { reason, taskId: task.id },
  })

  return { intent, responseBody, status: "escalated", staffTaskId: task.id, sms }
}

export async function handleJoyInboundSms(
  supabase: SupabaseClient,
  input: { conversationId: string; body: string; externalMessageId?: string | null },
): Promise<JoyReplyResult> {
  const context = await loadContext(supabase, input.conversationId)
  const intent = detectJoyIntent(input.body)

  await storeMessage(supabase, {
    conversationId: context.conversation.id,
    patientId: context.patient.id,
    patientMedicationId: context.medication.id,
    direction: "inbound",
    body: input.body,
    interpretedIntent: intent,
    externalMessageId: input.externalMessageId ?? null,
  })

  await supabase
    .from("joy_refill_conversations")
    .update({
      last_detected_intent: intent,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", context.conversation.id)

  await logAudit(supabase, {
    patientId: context.patient.id,
    patientMedicationId: context.medication.id,
    conversationId: context.conversation.id,
    actionType: "store_patient_sms_response",
    outcome: "success",
    details: { intent },
  })

  await logAudit(supabase, {
    patientId: context.patient.id,
    patientMedicationId: context.medication.id,
    conversationId: context.conversation.id,
    actionType: "update_conversation_intent",
    outcome: "success",
    details: { intent },
  })

  if (intent === "clinical_question" || intent === "staff_request" || intent === "pharmacy_change" || intent === "medication_confusion") {
    return escalate(supabase, context, intent)
  }

  if (intent === "refill_rejection") {
    const responseBody = `No problem. I won't request a refill for ${formatMedicationForSms(context.medication)} right now.`
    const sms = await sendSms(context.patient.phone, responseBody)
    await storeMessage(supabase, {
      conversationId: context.conversation.id,
      patientId: context.patient.id,
      patientMedicationId: context.medication.id,
      direction: "outbound",
      body: responseBody,
      externalMessageId: sms?.externalMessageId ?? null,
    })
    await supabase
      .from("joy_refill_conversations")
      .update({ status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", context.conversation.id)
    await logAudit(supabase, {
      patientId: context.patient.id,
      patientMedicationId: context.medication.id,
      conversationId: context.conversation.id,
      actionType: "close_refill_conversation",
      outcome: "patient_declined",
    })
    return { intent, responseBody, status: "closed", sms }
  }

  if (intent === "refill_status_question") {
    const { data: request } = await supabase
      .from("joy_refill_requests")
      .select("status")
      .eq("patient_medication_id", context.medication.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    await logAudit(supabase, {
      patientId: context.patient.id,
      patientMedicationId: context.medication.id,
      conversationId: context.conversation.id,
      actionType: "read_refill_request_status",
      outcome: request ? "found" : "not_found",
    })

    const responseBody = request
      ? `Your refill request for ${formatMedicationForSms(context.medication)} is currently ${request.status.replaceAll("_", " ")}.`
      : `I don't see an active refill request for ${formatMedicationForSms(context.medication)} yet. Reply YES if you'd like me to help request one.`
    const sms = await sendSms(context.patient.phone, responseBody)
    await storeMessage(supabase, {
      conversationId: context.conversation.id,
      patientId: context.patient.id,
      patientMedicationId: context.medication.id,
      direction: "outbound",
      body: responseBody,
      externalMessageId: sms?.externalMessageId ?? null,
    })
    return { intent, responseBody, status: context.conversation.status, sms }
  }

  if (intent === "refill_approval") {
    if (!context.medication.preferred_pharmacy) {
      return escalate(supabase, context, "missing_preferred_pharmacy", undefined, intent)
    }

    if (context.medication.prescription_status !== "active") {
      return escalate(supabase, context, "inactive_or_expired_prescription", undefined, intent)
    }

    if (context.medication.refill_eligibility_status !== "eligible") {
      return escalate(supabase, context, context.medication.refill_eligibility_status, undefined, intent)
    }

    const { data: refillRequest, error: refillError } = await supabase
      .from("joy_refill_requests")
      .insert({
        conversation_id: context.conversation.id,
        patient_id: context.patient.id,
        patient_medication_id: context.medication.id,
        medication_id: context.medication.internal_medication_id,
        pharmacy_name: context.medication.preferred_pharmacy,
        pharmacy_phone: context.medication.pharmacy_phone,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (refillError || !refillRequest) throw refillError ?? new Error("Failed to create refill request")

    const responseBody = `I've submitted a refill request for ${formatMedicationForSms(context.medication)} to ${context.medication.preferred_pharmacy}. Dr. Miller's office will contact you if anything else is needed.`
    const sms = await sendSms(context.patient.phone, responseBody)

    await storeMessage(supabase, {
      conversationId: context.conversation.id,
      patientId: context.patient.id,
      patientMedicationId: context.medication.id,
      direction: "outbound",
      body: responseBody,
      externalMessageId: sms?.externalMessageId ?? null,
    })

    await supabase
      .from("joy_refill_conversations")
      .update({ status: "refill_requested", last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", context.conversation.id)

    await logAudit(supabase, {
      patientId: context.patient.id,
      patientMedicationId: context.medication.id,
      conversationId: context.conversation.id,
      actionType: "create_refill_request",
      outcome: "success",
      details: { refillRequestId: refillRequest.id, pharmacy: context.medication.preferred_pharmacy },
    })

    return { intent, responseBody, status: "refill_requested", refillRequestId: refillRequest.id, sms }
  }

  const responseBody = `Sorry, I didn't quite understand. Are you asking for help refilling ${formatMedicationForSms(context.medication)}? Reply YES, NO, or STAFF.`
  const sms = await sendSms(context.patient.phone, responseBody)
  await storeMessage(supabase, {
    conversationId: context.conversation.id,
    patientId: context.patient.id,
    patientMedicationId: context.medication.id,
    direction: "outbound",
    body: responseBody,
    externalMessageId: sms?.externalMessageId ?? null,
  })

  return { intent: "unclear", responseBody, status: context.conversation.status, sms }
}
