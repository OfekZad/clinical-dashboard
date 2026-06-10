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
