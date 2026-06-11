import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { CacheInitPayload } from "@/lib/cache/types"

/**
 * GET /api/cache/init
 *
 * Returns ALL rows from every table the website uses, in a single response.
 * The frontend calls this once on first visit and stores the result in
 * memory + localStorage so that subsequent page navigations can read from
 * the cache instead of hitting the database.
 *
 * Background:  after init, the frontend calls /api/cache/sync?since=… to
 * pull only the rows that changed.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    )
  }

  try {
    const supabase = await createServerClient()

    const [
      { data: patients },
      { data: assessments },
      { data: assessment_responses },
      { data: clinician_notes },
      { data: patient_surveys },
      { data: survey_responses },
      { data: patient_medications },
    ] = await Promise.all([
      supabase.from("patients").select("*"),
      supabase.from("assessments").select("*"),
      supabase.from("assessment_responses").select("*"),
      supabase.from("clinician_notes").select("*"),
      supabase.from("patient_surveys").select("*"),
      supabase.from("survey_responses").select("*"),
      supabase.from("patient_medications").select("*"),
    ])

    const snapshot_at = new Date().toISOString()

    const payload: CacheInitPayload = {
      patients: patients || [],
      assessments: assessments || [],
      assessment_responses: assessment_responses || [],
      clinician_notes: clinician_notes || [],
      patient_surveys: patient_surveys || [],
      survey_responses: survey_responses || [],
      patient_medications: patient_medications || [],
      snapshot_at,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error("[cache/init] Error loading all data:", error)
    return NextResponse.json({ error: "Failed to load cache data" }, { status: 500 })
  }
}
