import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export type JoyCallStatusResponse = {
  status: "idle" | "in_progress" | "escalating"
  call?: {
    id: string
    caller_name: string | null
    caller_phone: string | null
    started_at: string
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
    if (call) {
      return NextResponse.json<JoyCallStatusResponse>({
        status: "in_progress",
        call: {
          id: call.id,
          caller_name: call.patient_id ?? null,
          caller_phone: null,
          started_at: call.called_at,
        },
      })
    }

    return NextResponse.json<JoyCallStatusResponse>({ status: "idle" })
  } catch (err) {
    console.error("[Joy Call Status] Unexpected error:", err)
    return NextResponse.json<JoyCallStatusResponse>({ status: "idle" })
  }
}
