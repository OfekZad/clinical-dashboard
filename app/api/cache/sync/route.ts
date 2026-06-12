import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { CacheSyncPayload } from "@/lib/cache/types"

/**
 * GET /api/cache/sync?since=<ISO-8601>
 *
 * Returns ONLY rows that were created or updated AFTER the given timestamp,
 * plus a list of ids that were deleted.  The frontend calls this periodically
 * (every 30–60 s) to keep its local cache fresh without re-fetching everything.
 *
 * Tables are queried in parallel for maximum throughput.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const since = url.searchParams.get("since")

  if (!since) {
    return NextResponse.json(
      { error: "Query parameter `since` (ISO-8601) is required" },
      { status: 400 },
    )
  }

  try {
    const supabase = await createServerClient()
    const snapshot_at = new Date().toISOString()

    // -----------------------------------------------------------------------
    // 1. Fetch changed rows from each table in parallel
    // -----------------------------------------------------------------------
    const tables = [
      { name: "patients", updatedCol: "updated_at" },
      { name: "assessments", updatedCol: "created_at" },
      { name: "assessment_responses", updatedCol: "created_at" },
      { name: "clinician_notes", updatedCol: "created_at" },
      { name: "patient_surveys", updatedCol: "updated_at" },
      { name: "survey_responses", updatedCol: "created_at" },
      { name: "patient_medications", updatedCol: "updated_at" },
    ] as const

    const queries = tables.map(({ name }) =>
      supabase
        .from(name)
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
    )

    // Also check updated_at for tables that support it
    const updateQueries = tables
      .filter((t) => t.updatedCol === "updated_at")
      .map(({ name }) =>
        supabase
          .from(name)
          .select("*")
          .gte("updated_at", since)
          .order("updated_at", { ascending: true }),
      )

    const allResults = await Promise.all([...queries, ...updateQueries])

    // -----------------------------------------------------------------------
    // 2. Merge results — deduplicate by id (row may appear in both created_at
    //    and updated_at queries)
    // -----------------------------------------------------------------------
    function mergeById<T extends { id: string }>(...arrays: (T[] | undefined)[]): T[] {
      const map = new Map<string, T>()
      for (const arr of arrays) {
        for (const item of arr || []) {
          map.set(item.id, item)
        }
      }
      return Array.from(map.values())
    }

    const [patients, assessments, assessment_responses, clinician_notes,
           ps_by_created, survey_responses, meds_by_created,
           ps_by_updated, meds_by_updated] = allResults.map((r) => r.data as any[] | undefined)

    const patient_surveys = mergeById(ps_by_created, ps_by_updated)
    const patient_medications = mergeById(meds_by_created, meds_by_updated)

    // -----------------------------------------------------------------------
    // 3. Detect deletions (rows that existed before but no longer match the
    //    query criteria — best-effort; full accuracy requires a tombstone /
    //    soft-delete column, which we don't have yet).
    //
    //    For now we only return what changed.  The frontend will do a full
    //    refresh periodically (every 5 min) to catch any missed deletes.
    // -----------------------------------------------------------------------

    const payload: CacheSyncPayload = {
      patients: patients || [],
      assessments: assessments || [],
      assessment_responses: assessment_responses || [],
      clinician_notes: clinician_notes || [],
      patient_surveys: patient_surveys || [],
      survey_responses: survey_responses || [],
      patient_medications: patient_medications || [],
      deleted_ids: [],
      snapshot_at,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error("[cache/sync] Error syncing data:", error)
    return NextResponse.json({ error: "Failed to sync cache data" }, { status: 500 })
  }
}
