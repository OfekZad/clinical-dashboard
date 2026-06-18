import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import type { VoiceAgentAssessmentPayload } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const payload: VoiceAgentAssessmentPayload = await request.json()

    console.log("[v0] Received payload:", JSON.stringify(payload, null, 2))

    // Validate required fields
    if (!payload.patient?.name) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required field: patient.name",
          received: payload,
        },
        { status: 400 },
      )
    }

    if (!payload.responses || !Array.isArray(payload.responses)) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing or invalid responses array",
        },
        { status: 400 },
      )
    }

    if (payload.responses.length !== 12) {
      return NextResponse.json(
        {
          success: false,
          message: `Expected 12 responses, received ${payload.responses.length}`,
        },
        { status: 400 },
      )
    }

    if (!payload.summary?.chief_complaint || !payload.summary?.key_observations) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required summary fields",
        },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()
    const patientName = payload.patient.name.trim()

    const { data: existingPatient } = await supabase.from("patients").select("id").eq("name", patientName).single()

    let patientId: string

    if (existingPatient) {
      patientId = existingPatient.id

      // Update optional fields if provided
      if (payload.patient.date_of_birth || payload.patient.phone || payload.patient.email) {
        await supabase
          .from("patients")
          .update({
            date_of_birth: payload.patient.date_of_birth || null,
            phone: payload.patient.phone || null,
            email: payload.patient.email || null,
          })
          .eq("id", patientId)
      }
    } else {
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          name: patientName,
          date_of_birth: payload.patient.date_of_birth || null,
          phone: payload.patient.phone || null,
          email: payload.patient.email || null,
        })
        .select("id")
        .single()

      if (patientError) {
        console.error("[v0] Error creating patient:", patientError)
        throw new Error(`Failed to create patient: ${patientError.message}`)
      }
      patientId = newPatient.id
    }

    const totalScore = payload.responses.reduce((sum, r) => sum + r.score, 0)
    const osdiScore = Math.round((totalScore * 100) / (12 * 4))

    let severityLevel: "Normal" | "Mild" | "Moderate" | "Severe"
    if (osdiScore <= 12) severityLevel = "Normal"
    else if (osdiScore <= 22) severityLevel = "Mild"
    else if (osdiScore <= 32) severityLevel = "Moderate"
    else severityLevel = "Severe"

    const hasScreenIntolerance = payload.responses.some((r) => r.question_number === 8 && r.score >= 3)
    const hasNightDrivingIssues = payload.responses.some((r) => r.question_number === 7 && r.score >= 3)
    const hasWindSensitivity = payload.responses.some((r) => r.question_number === 10 && r.score >= 3)
    const hasLowHumidityIssues = payload.responses.some(
      (r) => (r.question_number === 11 || r.question_number === 12) && r.score >= 3,
    )

    const { data: assessment, error: assessmentError } = await supabase
      .from("assessments")
      .insert({
        patient_id: patientId,
        assessment_date: new Date().toISOString(),
        total_score: osdiScore,
        severity_level: severityLevel,
        has_screen_intolerance: hasScreenIntolerance,
        has_night_driving_issues: hasNightDrivingIssues,
        has_wind_sensitivity: hasWindSensitivity,
        has_low_humidity_issues: hasLowHumidityIssues,
        reviewed: false,
      })
      .select("id")
      .single()

    if (assessmentError) {
      console.error("[v0] Error creating assessment:", assessmentError)
      throw new Error(`Failed to create assessment: ${assessmentError.message}`)
    }

    const responses = payload.responses.map((r) => ({
      assessment_id: assessment.id,
      question_number: r.question_number,
      question_text: getQuestionText(r.question_number),
      patient_response: r.score,
      patient_quote: r.quote,
      reasoning: r.reasoning,
    }))

    const { error: responsesError } = await supabase.from("assessment_responses").insert(responses)

    if (responsesError) {
      console.error("[v0] Error storing responses:", responsesError)
      throw new Error(`Failed to store responses: ${responsesError.message}`)
    }

    const noteText = [
      `Chief Complaint: ${payload.summary.chief_complaint}`,
      "",
      "Key Observations:",
      ...payload.summary.key_observations.map((o) => `- ${o}`),
    ].join("\n")

    const { error: noteError } = await supabase.from("clinician_notes").insert({
      assessment_id: assessment.id,
      note_text: noteText,
      created_by: "AI Assistant",
    })

    if (noteError) {
      console.error("[v0] Error creating note:", noteError)
      // Don't fail the whole request if note creation fails
    }

    console.log("[v0] Assessment submitted successfully:", {
      patient_id: patientId,
      assessment_id: assessment.id,
      osdi_score: osdiScore,
      severity_level: severityLevel,
    })

    return NextResponse.json(
      {
        success: true,
        message: "Assessment submitted successfully",
        data: {
          patient_id: patientId,
          assessment_id: assessment.id,
          osdi_score: osdiScore,
          severity_level: severityLevel,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("[v0] Error in assessment submission:", error)

    return NextResponse.json(
      {
        success: false,
        message: "Failed to submit assessment",
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}

function getQuestionText(questionNumber: number): string {
  const questions: Record<number, string> = {
    1: "Eyes sensitive to light?",
    2: "Eyes feel gritty?",
    3: "Painful or sore eyes?",
    4: "Blurred vision?",
    5: "Poor vision?",
    6: "Reading?",
    7: "Driving at night?",
    8: "Working with computer or bank machine?",
    9: "Watching TV?",
    10: "Windy conditions?",
    11: "Places or areas with low humidity?",
    12: "Areas that are air conditioned?",
  }

  return questions[questionNumber] || `Question ${questionNumber}`
}
