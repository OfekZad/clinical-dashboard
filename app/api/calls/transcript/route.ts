import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/**
 * GET /api/calls/transcript?patient_id=<uuid>[&call_number=<number>]
 *
 * Fetches the transcript for a specific call from the `calls` table.
 * If call_number is omitted, returns the most recent call with a transcript.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const url = new URL(request.url)
  const patientId = url.searchParams.get("patient_id")
  const callNumberStr = url.searchParams.get("call_number")

  if (!patientId) {
    return NextResponse.json(
      { error: "Query parameter `patient_id` is required" },
      { status: 400 },
    )
  }

  try {
    const supabase = await createServerClient()

    if (callNumberStr) {
      const callNumber = parseInt(callNumberStr, 10)
      if (isNaN(callNumber)) {
        return NextResponse.json({ error: "`call_number` must be a number" }, { status: 400 })
      }

      const { data, error } = await supabase
        .from("calls")
        .select("id, patient_id, call_number, called_at, duration_seconds, transcript")
        .eq("patient_id", patientId)
        .eq("call_number", callNumber)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          return NextResponse.json({ transcript: null }, { status: 404 })
        }
        console.error("[calls/transcript] DB error:", error.message)
        return NextResponse.json({ error: "Failed to fetch transcript" }, { status: 500 })
      }

      return NextResponse.json({
        id: data.id,
        patient_id: data.patient_id,
        call_number: data.call_number,
        called_at: data.called_at,
        duration_seconds: data.duration_seconds,
        transcript: data.transcript,
      })
    }

    // No call_number specified — return the most recent call with a transcript
    const { data, error } = await supabase
      .from("calls")
      .select("id, patient_id, call_number, called_at, duration_seconds, transcript")
      .eq("patient_id", patientId)
      .not("transcript", "is", null)
      .order("call_number", { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ transcript: null }, { status: 404 })
      }
      console.error("[calls/transcript] DB error:", error.message)
      return NextResponse.json({ error: "Failed to fetch transcript" }, { status: 500 })
    }

    return NextResponse.json({
      id: data.id,
      patient_id: data.patient_id,
      call_number: data.call_number,
      called_at: data.called_at,
      duration_seconds: data.duration_seconds,
      transcript: data.transcript,
    })
  } catch (error) {
    console.error("[calls/transcript] Unexpected error:", error)
    return NextResponse.json({ error: "Failed to fetch transcript" }, { status: 500 })
  }
}
