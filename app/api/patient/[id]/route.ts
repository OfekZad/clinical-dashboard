import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { getSeedPatientById } from "@/lib/seed-data"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Fall back to seed data when Supabase is not configured
  if (!isSupabaseConfigured()) {
    const patient = getSeedPatientById(id)
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }
    return NextResponse.json({ patient })
  }

  try {
    const supabase = await createServerClient()

    const { data: patient, error } = await supabase
      .from("patients")
      .select("id, name, email, phone")
      .eq("id", id)
      .single()

    if (error || !patient) {
      const seed = getSeedPatientById(id)
      if (seed) {
        return NextResponse.json({ patient: seed })
      }
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    return NextResponse.json({ patient })
  } catch (error) {
    console.error("Error fetching patient:", error)
    const seed = getSeedPatientById(id)
    if (seed) {
      return NextResponse.json({ patient: seed })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!isSupabaseConfigured()) {
    // Seed data mode — just echo success
    return NextResponse.json({ success: true, patient: null })
  }

  try {
    const supabase = await createServerClient()
    const body = await request.json()

    // Validate that at least one updatable field is present
    const allowedFields = ["name", "date_of_birth", "email", "phone"]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: patient, error } = await supabase
      .from("patients")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating patient:", error)
      return NextResponse.json({ error: "Failed to update patient" }, { status: 500 })
    }

    return NextResponse.json({ success: true, patient })
  } catch (error) {
    console.error("Error updating patient:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
