"use client"

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { CacheInitPayload, CacheSyncPayload, DataCache } from "./types"
import { applySyncToCache, createEmptyCache, toRecord } from "./types"

const STORAGE_KEY = "dial-cache"
const SYNC_INTERVAL_MS = 60_000
const FULL_REFRESH_INTERVAL_MS = 5 * 60 * 1000

interface CacheContextValue {
  cache: DataCache
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  sync: () => Promise<void>
}

const CacheContext = createContext<CacheContextValue | null>(null)

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<DataCache>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as DataCache
        if (parsed && parsed.patients) return parsed
      }
    } catch {
      // localStorage unavailable or corrupt
    }
    return createEmptyCache()
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refs to avoid re-render loops — the interval reads these
  const lastFullRefresh = useRef<number>(0)
  const cacheRef = useRef(cache)
  cacheRef.current = cache

  // Persist to localStorage on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
      } catch {
        // Storage full or unavailable
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [cache])

  // refresh — stable reference (empty deps). Reads/writes through state setters.
  const refresh = useCallback(async () => {
    try {
      setError(null)
      setLoading(true)
      const res = await fetch("/api/cache/init")
      if (!res.ok) throw new Error("Cache init failed")
      const payload: CacheInitPayload = await res.json()
      setCache({
        lastSyncedAt: payload.snapshot_at,
        patients: toRecord(payload.patients),
        assessments: toRecord(payload.assessments),
        assessment_responses: toRecord(payload.assessment_responses),
        clinician_notes: toRecord(payload.clinician_notes),
        patient_surveys: toRecord(payload.patient_surveys),
        survey_responses: toRecord(payload.survey_responses),
        patient_medications: toRecord(payload.patient_medications),
      })
      lastFullRefresh.current = Date.now()
    } catch (e) {
      console.error("[DataCache] Refresh failed:", e)
      setError(e instanceof Error ? e.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [])

  // sync — also stable. Reads the latest `lastSyncedAt` from cacheRef.
  const sync = useCallback(async () => {
    const since = cacheRef.current.lastSyncedAt
    if (!since) {
      refresh()
      return
    }
    try {
      const res = await fetch("/api/cache/sync?since=" + encodeURIComponent(since))
      if (!res.ok) {
        if (res.status === 400) { refresh(); return }
        throw new Error("Cache sync failed")
      }
      const payload: CacheSyncPayload = await res.json()
      setCache((prev) => ({ ...applySyncToCache({ ...prev }, payload) }))
    } catch (e) {
      console.error("[DataCache] Sync failed:", e)
    }
  }, [refresh])

  // Main lifecycle — runs ONCE on mount. Reads callbacks from refs so that
  // the interval always calls the latest version without re-running the effect.
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  const syncRef = useRef(sync)
  syncRef.current = sync

  useEffect(() => {
    refreshRef.current()

    const id = setInterval(() => {
      if (Date.now() - lastFullRefresh.current > FULL_REFRESH_INTERVAL_MS) {
        refreshRef.current()
      } else {
        syncRef.current()
      }
    }, SYNC_INTERVAL_MS)

    return () => clearInterval(id)
  }, []) // ◀── EMPTY deps — runs only once; the interval always calls latest refs

  return (
    <CacheContext.Provider value={{ cache, loading, error, refresh, sync }}>
      {children}
    </CacheContext.Provider>
  )
}

export function useDataCache(): CacheContextValue {
  const ctx = useContext(CacheContext)
  if (!ctx) {
    throw new Error("useDataCache must be used within a <DataCacheProvider>")
  }
  return ctx
}
