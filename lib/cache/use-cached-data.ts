/**
 * Convenience hooks that read from the cache and return data shaped exactly
 * like the server-side Supabase queries so pages can switch with minimal
 * changes.
 *
 * These hooks are meant for client components that need to render cached
 * data reactively.
 */

import { useMemo } from "react"
import { useDataCache } from "./cache-context"
import type {
  Assessment,
  AssessmentResponse,
  ClinicianNote,
  Patient,
  PatientMedication,
  PatientSurvey,
  PatientWithLatestAssessment,
  SurveyResponse,
} from "@/lib/types"

export function useCachedPatients(): Patient[] {
  const { cache } = useDataCache()
  return useMemo(() => Object.values(cache.patients), [cache.patients])
}

export function useCachedPatient(id: string): Patient | undefined {
  const { cache } = useDataCache()
  return useMemo(() => cache.patients[id], [cache.patients, id])
}

export function useCachedAssessments(patientId?: string): Assessment[] {
  const { cache } = useDataCache()
  return useMemo(() => {
    const all = Object.values(cache.assessments)
    if (patientId) return all.filter((a) => a.patient_id === patientId)
    return all
  }, [cache.assessments, patientId])
}

export function useCachedAssessmentResponses(assessmentId: string): AssessmentResponse[] {
  const { cache } = useDataCache()
  return useMemo(
    () => Object.values(cache.assessment_responses).filter((r) => r.assessment_id === assessmentId),
    [cache.assessment_responses, assessmentId],
  )
}

export function useCachedClinicianNotes(assessmentId: string): ClinicianNote[] {
  const { cache } = useDataCache()
  return useMemo(
    () => Object.values(cache.clinician_notes).filter((n) => n.assessment_id === assessmentId),
    [cache.clinician_notes, assessmentId],
  )
}

export function useCachedSurveys(patientId?: string): PatientSurvey[] {
  const { cache } = useDataCache()
  return useMemo(() => {
    const all = Object.values(cache.patient_surveys)
    if (patientId) return all.filter((s) => s.patient_id === patientId)
    return all
  }, [cache.patient_surveys, patientId])
}

export function useCachedSurveyResponses(surveyId: string): SurveyResponse[] {
  const { cache } = useDataCache()
  return useMemo(
    () => Object.values(cache.survey_responses).filter((r) => r.survey_id === surveyId),
    [cache.survey_responses, surveyId],
  )
}

export function useCachedMedications(patientId: string): PatientMedication[] {
  const { cache } = useDataCache()
  return useMemo(
    () => Object.values(cache.patient_medications).filter((m) => m.patient_id === patientId),
    [cache.patient_medications, patientId],
  )
}

/**
 * Returns all patients with their latest and previous assessments/surveys
 * combined — exactly like the server-side getPatientDashboardData().
 */
export function useCachedDashboardPatients(): PatientWithLatestAssessment[] {
  const { cache } = useDataCache()

  return useMemo(() => {
    const patients = Object.values(cache.patients)
    const assessments = Object.values(cache.assessments)
    const surveys = Object.values(cache.patient_surveys).filter((s) => s.status === "scored" && s.total_score !== null)

    // Group by patient_id
    const byPatient: Record<string, Array<{ date: Date; score: number; severity: string; reviewed: boolean; data: any }>> = {}

    for (const a of assessments) {
      if (!byPatient[a.patient_id]) byPatient[a.patient_id] = []
      byPatient[a.patient_id].push({
        date: new Date(a.assessment_date),
        score: a.total_score,
        severity: a.severity_level,
        reviewed: a.reviewed,
        data: a,
      })
    }

    for (const s of surveys) {
      if (s.patient_id && !byPatient[s.patient_id]) byPatient[s.patient_id] = []
      if (s.patient_id) {
        byPatient[s.patient_id].push({
          date: new Date(s.survey_date),
          score: s.total_score!,
          severity: s.severity_level!,
          reviewed: true,
          data: s,
        })
      }
    }

    // Sort each patient's scores newest-first
    for (const pid of Object.keys(byPatient)) {
      byPatient[pid].sort((a, b) => b.date.getTime() - a.date.getTime())
    }

    return patients.map((p) => {
      const scores = byPatient[p.id] || []
      const latest = scores[0] || null
      const previous = scores[1] || null

      return {
        ...p,
        latest_assessment: latest
          ? {
              id: latest.data.id,
              total_score: latest.score,
              severity_level: latest.severity,
              reviewed: latest.reviewed,
              assessment_date: latest.date.toISOString(),
              has_screen_intolerance: latest.data.has_screen_intolerance ?? false,
              has_night_driving_issues: latest.data.has_night_driving_issues ?? false,
              has_wind_sensitivity: latest.data.has_wind_sensitivity ?? false,
              has_low_humidity_issues: latest.data.has_low_humidity_issues ?? false,
            }
          : null,
        previous_assessment: previous
          ? { total_score: previous.score }
          : null,
      }
    })
  }, [cache.patients, cache.assessments, cache.patient_surveys])
}
