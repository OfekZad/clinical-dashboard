import { NextResponse, type NextRequest } from "next/server"
import { processJoySmsReply, startJoyRefillOutreach } from "@/lib/joy/refill-assistant"
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import type { JoySmsPayload } from "@/lib/types"

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Supabase is not configured" }, { status: 503 })
  }

  try {
    const payload = (await request.json()) as JoySmsPayload

    if (!payload.message?.trim()) {
      return NextResponse.json({ success: false, error: "Missing required field: message" }, { status: 400 })
    }

    const supabase = await createServerClient()
    const result = await processJoySmsReply(supabase, payload)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Joy refill SMS processing failed", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Joy refill SMS error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Supabase is not configured" }, { status: 503 })
  }

  try {
    const { patient_medication_id: patientMedicationId, to_phone: toPhone } = (await request.json()) as {
      patient_medication_id?: string
      to_phone?: string
    }

    if (!patientMedicationId) {
      return NextResponse.json({ success: false, error: "Missing required field: patient_medication_id" }, { status: 400 })
    }

    const supabase = await createServerClient()
    const result = await startJoyRefillOutreach(supabase, patientMedicationId, toPhone)

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error("Joy refill outreach failed", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown Joy refill outreach error",
      },
      { status: 500 },
    )
  }
}
