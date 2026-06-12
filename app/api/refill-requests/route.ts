import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export interface RefillRequest {
  id: string
  patient_id: string
  patient_name: string | null
  medication_name: string
  status: "pending" | "approved" | "denied" | "cancelled"
  requested_via: "sms" | "manual"
  conversation_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/refill-requests
 * Returns all refill requests with patient names, newest first.
 * Optional ?status=pending to filter.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const statusFilter = req.nextUrl.searchParams.get("status")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("refill_requests")
      .select(`
        id,
        patient_id,
        medication_name,
        status,
        requested_via,
        conversation_id,
        notes,
        created_at,
        updated_at,
        patients!refill_requests_patient_id_fkey (
          name
        )
      `)
      .order("created_at", { ascending: false })

    if (statusFilter) {
      query = query.eq("status", statusFilter)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requests: RefillRequest[] = (data || []).map((row: any) => ({
      id: row.id,
      patient_id: row.patient_id,
      patient_name: row.patients?.name ?? null,
      medication_name: row.medication_name,
      status: row.status,
      requested_via: row.requested_via,
      conversation_id: row.conversation_id,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }))

    return NextResponse.json(requests)
  } catch (err) {
    console.error("[Refill Requests GET] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * PATCH /api/refill-requests
 * Update the status of a refill request.
 * Body: { id: string, status: "approved" | "denied" | "cancelled", notes?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const body = await req.json()
    const { id, status, notes } = body

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 })
    }

    const allowedStatuses = ["approved", "denied", "cancelled"]
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("refill_requests")
      .update({ status, notes: notes ?? null, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Refill Requests PATCH] Error:", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
