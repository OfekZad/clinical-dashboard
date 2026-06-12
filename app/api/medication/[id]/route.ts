import { NextResponse } from "next/server"
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { JOY_LOW_MEDICATION_THRESHOLD } from "@/lib/joy-constants"

function parseRemainingQuantity(value: unknown): number | null | undefined {
  if (value === null || value === "") return null
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }
  return undefined
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, medication: null })
  }

  try {
    const body = (await request.json()) as { remainingQuantity?: unknown; patientId?: string }
    const remainingQuantity = parseRemainingQuantity(body.remainingQuantity)

    if (remainingQuantity === undefined) {
      return NextResponse.json(
        { success: false, error: "remainingQuantity must be a non-negative number or null" },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const lowMedicationFlag = remainingQuantity !== null && remainingQuantity <= JOY_LOW_MEDICATION_THRESHOLD

    const supabase = await createServerClient()
    let updateQuery = supabase
      .from("patient_medications")
      .update({
        remaining_quantity: remainingQuantity,
        low_medication_flag: lowMedicationFlag,
        low_medication_detected_at: lowMedicationFlag ? now : null,
        updated_at: now,
      })
      .eq("id", id)

    if (body.patientId) {
      updateQuery = updateQuery.eq("patient_id", body.patientId)
    }

    const { data: medication, error } = await updateQuery.select().single()

    if (error || !medication) {
      console.error("Error updating medication remaining quantity:", error)
      return NextResponse.json({ success: false, error: "Failed to update medication" }, { status: 500 })
    }

    await supabase.from("joy_audit_logs").insert({
      patient_id: medication.patient_id,
      patient_medication_id: medication.id,
      conversation_id: null,
      action_type: "update_medication_remaining_quantity",
      outcome: "success",
      details: {
        remainingQuantity,
        lowMedicationFlag,
        threshold: JOY_LOW_MEDICATION_THRESHOLD,
      },
    })

    return NextResponse.json({ success: true, medication })
  } catch (error) {
    console.error("Medication update error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
