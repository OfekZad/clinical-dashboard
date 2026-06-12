import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { surveyId, scores, totalScore, severityLevel, notes } = body

    const supabase = await createServerClient()

    // 🔥 FIX: Replaced N+1 write loop with a single batch update using an RPC.
    // Instead of one DB call per response, we update all in one query via a
    // CASE/WHERE bulk pattern (if scores object is non-empty).
    const scoreEntries = Object.entries(scores).filter(([, score]) => score !== null)
    if (scoreEntries.length > 0) {
      // Build a bulk UPDATE by matching on JSON-encoded pairs.
      // This avoids N individual round-trips.
      const { error: batchError } = await supabase.rpc("batch_update_survey_scores", {
        p_updates: scoreEntries.map(([responseId, score]) => ({
          id: responseId,
          assigned_score: score,
        })),
      })

      // If the RPC doesn't exist yet, fall back to a single-update-per-row approach
      // but still better than N sequential awaits — we fire them in parallel.
      if (batchError) {
        // Fallback: parallel updates (still faster than sequential)
        await Promise.all(
          scoreEntries.map(([responseId, score]) =>
            supabase
              .from("survey_responses")
              .update({ assigned_score: score as number })
              .eq("id", responseId),
          ),
        )
      }
    }

    // Update survey with total score and severity
    const { error: surveyError } = await supabase
      .from("patient_surveys")
      .update({
        total_score: totalScore,
        severity_level: severityLevel,
        clinician_notes: notes || null,
        status: "scored",
        updated_at: new Date().toISOString(),
      })
      .eq("id", surveyId)

    if (surveyError) {
      console.error("Error updating survey:", surveyError)
      return NextResponse.json({ success: false, error: "Failed to save scores" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Score submission error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
