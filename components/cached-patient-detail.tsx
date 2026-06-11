"use client"

import { useEffect, useState } from "react"
import { useDataCache, useCachedPatient, useCachedAssessments } from "@/lib/cache"
import type { Patient } from "@/lib/types"
import type { Locale } from "@/lib/i18n"

interface CachedPatientWrapperProps {
  patientId: string
  serverPatient: Patient | null
  children: (patient: Patient) => React.ReactNode
  fallback: React.ReactNode
}

/**
 * Client component that provides cached patient data after hydration.
 * Falls back to server-provided data until cache is ready.
 *
 * Usage: wrap the patient detail page content that depends on patient data.
 */
export function CachedPatientWrapper({
  patientId,
  serverPatient,
  children,
  fallback,
}: CachedPatientWrapperProps) {
  const { loading } = useDataCache()
  const cachedPatient = useCachedPatient(patientId)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!loading && cachedPatient) {
      setReady(true)
    }
  }, [loading, cachedPatient])

  const patient = ready && cachedPatient ? cachedPatient : serverPatient

  if (!patient) return <>{fallback}</>
  return <>{children(patient)}</>
}
