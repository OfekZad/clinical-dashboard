import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export type JoyCallStatusResponse = {
  status: "idle" | "in_progress" | "escalating" | "sms_active"
  call?: {
    id: string
    caller_name: string | null
    caller_phone: string | null
    started_at: string
  }
  sms?: {
    activeConversations: number
    escalatedConversations: number
    pendingRefills: number
  }
}

/**
 * GET /api/joy/call-status
 *
 * Polled by the JoyIndicator component every 1 second.
 * Only source of truth: a row with status = 'in_progress' in the calls table.
 * No timers, no demo mode — purely DB-driven.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()

    // The `calls` table already exists in Supabase (created by the Dial system).
    // A row with status = 'in_progress' means Joy is currently on a call.
    const { data: rows, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from("calls" as any)
      .select("id, patient_id, call_number, status, called_at")
      .eq("status", "in_progress")
      .order("called_at", { ascending: false })
      .limit(1)

    if (error) {
      console.error("[Joy Call Status] DB error:", error.message)
      return NextResponse.json<JoyCallStatusResponse>({ status: "idle" })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (rows as any[] | null)?.[0]

    // Also check SMS activity in parallel
    const supabase2 = getSupabaseAdminClient()
    const [smsConvResult, refillResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase2 as any)
        .from("sms_conversations")
        .select("status")
        .in("status", ["active", "escalated"]),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase2 as any)
        .from("refill_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const smsRows: any[] = smsConvResult.data || []
    const activeConversations = smsRows.filter((r) => r.status === "active").length
    const escalatedConversations = smsRows.filter((r) => r.status === "escalated").length
    const pendingRefills = refillResult.count ?? 0

    const smsData = {
      activeConversations,
      escalatedConversations,
      pendingRefills,
    }

    // Voice call takes priority for the top-level status
    if (call) {
      return NextResponse.json<JoyCallStatusResponse>({
        status: "in_progress",
        call: {
          id: call.id,
          caller_name: call.patient_id ?? null,
          caller_phone: null,
          started_at: call.called_at,
        },
        sms: smsData,
      })
    }

    // Escalated SMS conversation is the next priority
    if (escalatedConversations > 0) {
      return NextResponse.json<JoyCallStatusResponse>({
        status: "escalating",
        sms: smsData,
      })
    }

    // Active SMS conversations show "sms_active"
    if (activeConversations > 0) {
      return NextResponse.json<JoyCallStatusResponse>({
        status: "sms_active",
        sms: smsData,
      })
    }

    return NextResponse.json<JoyCallStatusResponse>({ status: "idle", sms: smsData })
  } catch (err) {
    console.error("[Joy Call Status] Unexpected error:", err)
    return NextResponse.json<JoyCallStatusResponse>({ status: "idle" })
  }
}
