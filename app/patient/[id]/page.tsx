import { PatientPageShell } from "@/components/patient-page-shell"

/**
 * Patient detail page — server shell only.
 *
 * The heavy content (data fetching from cache, full render) happens entirely
 * client-side via the dynamic import in PatientPageShell.
 * This keeps the server RSC payload lightweight and makes client-side
 * navigation instantaneous.
 */
export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PatientPageShell patientId={id} />
}
