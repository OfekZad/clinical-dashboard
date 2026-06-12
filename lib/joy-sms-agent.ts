import Anthropic from "@anthropic-ai/sdk"
import { sendSMS } from "./dial"
import { getSupabaseAdminClient } from "./supabase/admin"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const JOY_SYSTEM_PROMPT = `You are Joy, Dr. Miller's friendly SMS assistant at an eye care clinic.
Your role is to contact patients who are running low on their dry-eye medication and help them request a refill.

Guidelines:
- Be warm, concise, and professional — this is SMS, so keep messages short (under 160 chars when possible)
- Always identify yourself and the clinic briefly in the first message
- Ask clearly whether the patient wants a refill
- If the patient says yes, confirm you'll submit the refill request to Dr. Miller
- If the patient says no or says they have enough, thank them and close gracefully
- If the patient asks a medical question you can't answer, say Dr. Miller will follow up and escalate
- If the patient's reply is ambiguous or you're unsure, escalate to staff
- Never make clinical decisions or give medical advice
- Respond only with the SMS text — no formatting, no quotes around it`

export interface PatientMedication {
  id: string
  patient_id: string
  medication_name: string
  days_supply: number
  start_date: string | null
  status: string
  patient_name: string
  patient_phone: string | null
}

/**
 * Find active medications that are predicted to run out within the next 7 days.
 */
export async function detectLowMedicinePatients(): Promise<PatientMedication[]> {
  const supabase = getSupabaseAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("patient_medications")
    .select(`
      id,
      patient_id,
      medication_name,
      days_supply,
      start_date,
      status,
      patients!patient_medications_patient_id_fkey (
        name,
        phone
      )
    `)
    .eq("status", "active")
    .not("start_date", "is", null)

  if (error) throw new Error(`Low medicine query failed: ${error.message}`)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const threshold = new Date(today)
  threshold.setDate(threshold.getDate() + 7)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).filter((row: any) => {
    const start = new Date(row.start_date)
    const runOut = new Date(start)
    runOut.setDate(runOut.getDate() + row.days_supply)
    return runOut <= threshold
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).map((row: any) => ({
    id: row.id,
    patient_id: row.patient_id,
    medication_name: row.medication_name,
    days_supply: row.days_supply,
    start_date: row.start_date,
    status: row.status,
    patient_name: row.patients?.name ?? "Patient",
    patient_phone: row.patients?.phone ?? null,
  }))
}

/**
 * Start a new SMS conversation for a patient who is low on medication.
 * Skips the patient if an active conversation already exists for this medication.
 */
export async function startRefillConversation(med: PatientMedication): Promise<string | null> {
  if (!med.patient_phone) return null

  const supabase = getSupabaseAdminClient()

  // Check for an existing active conversation for this patient
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("sms_conversations")
    .select("id")
    .eq("patient_id", med.patient_id)
    .eq("status", "active")
    .limit(1)

  if (existing && existing.length > 0) return null

  // Create conversation record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv, error: convErr } = await (supabase as any)
    .from("sms_conversations")
    .insert({ patient_id: med.patient_id, patient_phone: med.patient_phone })
    .select("id")
    .single()

  if (convErr) throw new Error(`Create conversation failed: ${convErr.message}`)

  const firstName = med.patient_name.split(" ")[0]
  const message = `Hi ${firstName}, this is Joy from Dr. Miller's clinic. Your ${med.medication_name} may be running low. Would you like us to request a refill for you? Reply YES or NO.`

  // Send the SMS
  await sendSMS(med.patient_phone, message)

  // Log the outbound message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("sms_messages").insert({
    conversation_id: conv.id,
    direction: "outbound",
    body: message,
  })

  return conv.id
}

/**
 * Process an inbound SMS reply from a patient.
 * Generates a Joy response using Claude, updates the DB, and handles escalation/completion.
 */
export async function handleInboundMessage(fromPhone: string, body: string): Promise<void> {
  const supabase = getSupabaseAdminClient()

  // Find the active conversation for this phone number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: convRows } = await (supabase as any)
    .from("sms_conversations")
    .select("id, patient_id, patient_phone")
    .eq("patient_phone", fromPhone)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)

  if (!convRows || convRows.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conv = convRows[0] as any

  // Log the inbound message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("sms_messages").insert({
    conversation_id: conv.id,
    direction: "inbound",
    body,
  })

  // Fetch full conversation history for context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await (supabase as any)
    .from("sms_messages")
    .select("direction, body")
    .eq("conversation_id", conv.id)
    .order("sent_at", { ascending: true })

  // Fetch the medication this conversation is about
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: meds } = await (supabase as any)
    .from("patient_medications")
    .select("id, medication_name")
    .eq("patient_id", conv.patient_id)
    .eq("status", "active")
    .limit(1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const med = meds?.[0] as any
  const medicationName = med?.medication_name ?? "your medication"

  // Build message history for Claude
  const claudeMessages: Anthropic.MessageParam[] = (messages || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m: any) => ({
      role: m.direction === "outbound" ? "assistant" : ("user" as const),
      content: m.body,
    })
  )

  // Ask Claude (Joy) to generate the next response
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: JOY_SYSTEM_PROMPT + `\n\nContext: Patient is being asked about refilling ${medicationName}.`,
    messages: claudeMessages,
  })

  const replyText = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("")
    .trim()

  // Detect intent from the reply
  const intent = detectIntent(body)

  if (intent === "yes") {
    // Create refill request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("refill_requests").insert({
      patient_id: conv.patient_id,
      medication_id: med?.id ?? null,
      conversation_id: conv.id,
      medication_name: medicationName,
      status: "pending",
      requested_via: "sms",
    })

    // Mark conversation completed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("sms_conversations")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", conv.id)
  } else if (intent === "no") {
    // Patient doesn't want refill, close conversation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("sms_conversations")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", conv.id)
  } else if (intent === "escalate") {
    // Patient has a question or complex request — escalate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("sms_conversations")
      .update({
        status: "escalated",
        escalation_reason: `Patient replied: "${body}"`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conv.id)
  }

  // Send Joy's reply
  await sendSMS(fromPhone, replyText)

  // Log the outbound reply
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("sms_messages").insert({
    conversation_id: conv.id,
    direction: "outbound",
    body: replyText,
  })
}

/** Classify patient reply intent for post-processing. */
function detectIntent(text: string): "yes" | "no" | "escalate" | "unknown" {
  const lower = text.toLowerCase().trim()
  const yesPatterns = /\b(yes|yeah|yep|sure|please|ok|okay|go ahead|do it|refill|need it|i do)\b/
  const noPatterns = /\b(no|nope|don't|dont|not now|i'm good|have enough|skip|cancel)\b/
  if (yesPatterns.test(lower)) return "yes"
  if (noPatterns.test(lower)) return "no"
  // Anything with a question mark or longer complex message → escalate
  if (lower.includes("?") || lower.split(" ").length > 10) return "escalate"
  return "unknown"
}
