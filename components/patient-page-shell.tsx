"use client"

import dynamic from "next/dynamic"

/**
 * Client-side shell that dynamically loads the patient content with SSR disabled.
 * This is needed because `ssr: false` is not allowed in Server Components.
 */
const CachedPatientContent = dynamic(
  () => import("@/components/cached-patient-content").then((m) => ({ default: m.CachedPatientContent })),
  { ssr: false },
)

export function PatientPageShell({ patientId }: { patientId: string }) {
  return <CachedPatientContent patientId={patientId} />
}
