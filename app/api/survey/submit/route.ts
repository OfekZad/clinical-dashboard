import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { MedicationUpdate } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { patientId, name, email, phone, responses, medications } = body

    if (!patientId && !name) {
      return NextResponse.json({ success: false, error: "Patient ID or name is required" }, { status: 400 })
    }

    const supabase = await createServerClient()

    let patient_id = patientId || null
    let patient_name = name

    if (patientId) {
      // Fetch patient name from database
      const { data: patient } = await supabase.from("patients").select("id, name").eq("id", patientId).single()

      if (patient) {
        patient_name = patient.name
        patient_id = patient.id
      }
    }

    const frequencyToScore: Record<string, number> = {
      none: 0,
      sometimes: 1,
      half: 2,
      most: 3,
      all: 4,
      not_applicable: 0, // Not applicable doesn't count
    }

    let totalScore = 0
    let scoredQuestions = 0

    const surveyResponses = Object.entries(responses).map(([questionNumber, data]) => {
      const frequency = (data as { frequency: string; freeText: string }).frequency
      const score = frequencyToScore[frequency] || 0

      // Only count questions that are not "not_applicable"
      if (frequency !== "not_applicable") {
        totalScore += score
        scoredQuestions++
      }

      return {
        survey_id: "", // Will be set after survey creation
        question_number: Number.parseInt(questionNumber),
        frequency,
        free_text: (data as { frequency: string; freeText: string }).freeText || null,
        assigned_score: score,
      }
    })

    // Calculate OSDI score (same formula as AI assessments)
    const osdiScore = scoredQuestions > 0 ? Math.round((totalScore / scoredQuestions) * 25) : 0

    // Determine severity
    let severityLevel = "Normal"
    if (osdiScore <= 12) severityLevel = "Normal"
    else if (osdiScore <= 22) severityLevel = "Mild"
    else if (osdiScore <= 32) severityLevel = "Moderate"
    else severityLevel = "Severe"

    // Create the survey record with calculated score
    const { data: survey, error: surveyError } = await supabase
      .from("patient_surveys")
      .insert({
        patient_id,
        patient_name,
        patient_email: email || null,
        patient_phone: phone || null,
        status: "scored", // Automatically scored
        total_score: osdiScore,
        severity_level: severityLevel,
      })
      .select()
      .single()

    if (surveyError) {
      console.error("Error creating survey:", surveyError)
      return NextResponse.json({ success: false, error: "Failed to create survey" }, { status: 500 })
    }

    // Update survey_id in responses
    surveyResponses.forEach((response) => {
      response.survey_id = survey.id
    })

    // Insert all survey responses
    if (surveyResponses.length > 0) {
      const { error: responsesError } = await supabase.from("survey_responses").insert(surveyResponses)

      if (responsesError) {
        console.error("Error creating survey responses:", responsesError)
        return NextResponse.json({ success: false, error: "Failed to save responses" }, { status: 500 })
      }
    }

    if (medications && patient_id) {
      const medicationRecords = [
        ...(medications.new || []).map((med: MedicationUpdate) => ({
          ...med,
          patient_id,
          survey_id: survey.id,
          status: "new",
        })),
        ...(medications.stopped || []).map((med: MedicationUpdate) => ({
          ...med,
          patient_id,
          survey_id: survey.id,
          status: "stopped",
        })),
        ...(medications.continuing || []).map((med: MedicationUpdate) => ({
          ...med,
          patient_id,
          survey_id: survey.id,
          status: "active",
        })),
      ]

      if (medicationRecords.length > 0) {
        const { error: medError } = await supabase.from("patient_medications").insert(medicationRecords)

        if (medError) {
          console.error("Error saving medications:", medError)
          // Don't fail the request, just log the error
        }
      }
    }

    return NextResponse.json({ success: true, surveyId: survey.id, score: osdiScore, severity: severityLevel })
  } catch (error) {
    console.error("Survey submission error:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
