import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { surveyId, scores, totalScore, severityLevel, notes } = body

    const supabase = await createServerClient()

    // Update individual response scores
    for (const [responseId, score] of Object.entries(scores)) {
      if (score !== null) {
        await supabase
          .from("survey_responses")
          .update({ assigned_score: score as number })
          .eq("id", responseId)
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
