import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export interface SmsConversation {
  id: string
  patient_id: string
  patient_phone: string
  status: "active" | "completed" | "escalated"
  escalation_reason: string | null
  created_at: string
  updated_at: string
  patient_name: string | null
  message_count: number
  last_message: string | null
  last_message_direction: "inbound" | "outbound" | null
}

/**
 * GET /api/joy/sms/conversations
 * Returns all SMS conversations with patient names and last message preview.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("sms_conversations")
      .select(`
        id,
        patient_id,
        patient_phone,
        status,
        escalation_reason,
        created_at,
        updated_at,
        patients!sms_conversations_patient_id_fkey (
          name
        ),
        sms_messages (
          body,
          direction,
          sent_at
        )
      `)
      .order("updated_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conversations: SmsConversation[] = (data || []).map((row: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgs: any[] = row.sms_messages || []
      msgs.sort(
        (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      )
      const last = msgs[0]
      return {
        id: row.id,
        patient_id: row.patient_id,
        patient_phone: row.patient_phone,
        status: row.status,
        escalation_reason: row.escalation_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
        patient_name: row.patients?.name ?? null,
        message_count: msgs.length,
        last_message: last?.body ?? null,
        last_message_direction: last?.direction ?? null,
      }
    })

    return NextResponse.json(conversations)
  } catch (err) {
    console.error("[Joy SMS Conversations] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
