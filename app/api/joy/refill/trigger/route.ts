import { NextResponse } from "next/server"
import { JoyRefillThresholdError, startJoyRefillConversation } from "@/lib/joy-refill-assistant"
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Joy requires a configured Supabase database connection" },
      { status: 503 },
    )
  }

  try {
    const body = (await request.json()) as {
      patientId?: string
      patientMedicationId?: string
      smsTo?: string | null
    }

    if (!body.patientId || !body.patientMedicationId) {
      return NextResponse.json(
        { success: false, error: "patientId and patientMedicationId are required" },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()
    const result = await startJoyRefillConversation(supabase, {
      patientId: body.patientId,
      patientMedicationId: body.patientMedicationId,
      smsTo: body.smsTo,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof JoyRefillThresholdError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 })
    }

    console.error("Joy refill trigger error:", error)
    return NextResponse.json({ success: false, error: "Failed to start Joy refill conversation" }, { status: 500 })
  }
}
