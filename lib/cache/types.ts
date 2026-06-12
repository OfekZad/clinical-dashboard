/**
 * Types for the frontend data cache layer.
 *
 * The cache mirrors all Supabase tables the website uses so that pages can
 * read from memory / localStorage instead of hitting the database on every
 * navigation.  A background sync worker periodically checks for changes and
 * performs a minimal diff update.
 */

import type {
  Patient,
  Assessment,
  AssessmentResponse,
  ClinicianNote,
  PatientSurvey,
  SurveyResponse,
  PatientMedication,
} from "@/lib/types"

/**
 * Every table row PLUS its type discriminator so the cache store knows
 * which array to upsert into.
 */
export type CachedRow =
  | { __table: "patients"; data: Patient }
  | { __table: "assessments"; data: Assessment }
  | { __table: "assessment_responses"; data: AssessmentResponse }
  | { __table: "clinician_notes"; data: ClinicianNote }
  | { __table: "patient_surveys"; data: PatientSurvey }
  | { __table: "survey_responses"; data: SurveyResponse }
  | { __table: "patient_medications"; data: PatientMedication }

/**
 * The full in-memory snapshot of the database, split by table.
 * This is what the CacheContext holds and exposes.
 */
export interface DataCache {
  /** ISO-8601 timestamp of the last background sync */
  lastSyncedAt: string | null

  patients: Record<string, Patient>
  assessments: Record<string, Assessment>
  assessment_responses: Record<string, AssessmentResponse>
  clinician_notes: Record<string, ClinicianNote>
  patient_surveys: Record<string, PatientSurvey>
  survey_responses: Record<string, SurveyResponse>
  patient_medications: Record<string, PatientMedication>
}

/**
 * The payload returned by GET /api/cache/init — everything in one shot.
 */
export interface CacheInitPayload {
  patients: Patient[]
  assessments: Assessment[]
  assessment_responses: AssessmentResponse[]
  clinician_notes: ClinicianNote[]
  patient_surveys: PatientSurvey[]
  survey_responses: SurveyResponse[]
  patient_medications: PatientMedication[]
  /** Server-side timestamp for incremental syncing */
  snapshot_at: string
}

/**
 * The payload returned by GET /api/cache/sync?since=<ISO>.
 * Only rows that were created / updated AFTER the given timestamp.
 */
export interface CacheSyncPayload {
  patients: Patient[]
  assessments: Assessment[]
  assessment_responses: AssessmentResponse[]
  clinician_notes: ClinicianNote[]
  patient_surveys: PatientSurvey[]
  survey_responses: SurveyResponse[]
  patient_medications: PatientMedication[]
  deleted_ids: Array<{ __table: string; id: string }>
  snapshot_at: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TABLE_ORDER: (keyof DataCache)[] = [
  "patients",
  "assessments",
  "assessment_responses",
  "clinician_notes",
  "patient_surveys",
  "survey_responses",
  "patient_medications",
]

/** Build an empty cache snapshot. */
export function createEmptyCache(): DataCache {
  return {
    lastSyncedAt: null,
    patients: {},
    assessments: {},
    assessment_responses: {},
    clinician_notes: {},
    patient_surveys: {},
    survey_responses: {},
    patient_medications: {},
  }
}

/** Convert an array of rows into a Record<id, row>. */
export function toRecord<T extends { id: string }>(rows: T[]): Record<string, T> {
  const record: Record<string, T> = {}
  for (const row of rows) {
    record[row.id] = row
  }
  return record
}

/**
 * Merge a sync payload into an existing cache in-place, returning the
 * updated cache.  This handles both new/updated rows and deletions.
 */
export function applySyncToCache(cache: DataCache, payload: CacheSyncPayload): DataCache {
  const tables: Array<{ key: keyof DataCache; rows: any[] }> = [
    { key: "patients", rows: payload.patients },
    { key: "assessments", rows: payload.assessments },
    { key: "assessment_responses", rows: payload.assessment_responses },
    { key: "clinician_notes", rows: payload.clinician_notes },
    { key: "patient_surveys", rows: payload.patient_surveys },
    { key: "survey_responses", rows: payload.survey_responses },
    { key: "patient_medications", rows: payload.patient_medications },
  ]

  // Upsert new/changed rows
  for (const { key, rows } of tables) {
    for (const row of rows) {
      ;(cache[key] as Record<string, any>)[row.id] = row
    }
  }

  // Remove deleted rows
  for (const del of payload.deleted_ids) {
    const tableKey = del.__table as keyof DataCache
    if (tableKey in cache) {
      delete (cache[tableKey] as Record<string, any>)[del.id]
    }
  }

  cache.lastSyncedAt = payload.snapshot_at
  return cache
}
