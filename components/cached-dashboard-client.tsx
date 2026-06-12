"use client"

import { useEffect, useState } from "react"
import { useCachedDashboardPatients } from "@/lib/cache"
import { useDataCache } from "@/lib/cache"
import type { PatientWithLatestAssessment } from "@/lib/types"
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ActivityIcon,
  UsersIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "lucide-react"
import { DashboardTableClient } from "@/components/dashboard-table-client"
import { getStrings, type Locale } from "@/lib/i18n"

interface Props {
  /** Initial data from the server — used as fallback until cache is ready */
  serverPatients: PatientWithLatestAssessment[]
  serverPendingSurveys: number
  locale: Locale
}

/**
 * Dashboard client component that reads from the DataCache after hydration.
 * Falls back to server-provided data until the cache finishes initialising.
 */
export function CachedDashboardClient({ serverPatients, serverPendingSurveys, locale }: Props) {
  const { loading } = useDataCache()
  const cachedPatients = useCachedDashboardPatients()
  const [ready, setReady] = useState(false)

  // After the first render with cache data, switch over
  useEffect(() => {
    if (!loading && cachedPatients.length > 0) {
      setReady(true)
    }
  }, [loading, cachedPatients])

  // Use cache data if ready and non-empty, otherwise use server data
  const patients = ready && cachedPatients.length > 0 ? cachedPatients : serverPatients
  const t = getStrings(locale)

  const totalPatients = patients.length
  const needsReview = patients.filter((p) => p.latest_assessment && !p.latest_assessment.reviewed).length
  const severeCases = patients.filter((p) => p.latest_assessment?.severity_level === "Severe").length
  const improving = patients.filter(
    (p) =>
      p.latest_assessment &&
      p.previous_assessment &&
      p.latest_assessment.total_score < p.previous_assessment.total_score,
  ).length

  return (
    <>
      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 justify-center">
        <Card className="border-border bg-card transition-all hover:border-primary/50 py-2">
          <CardContent className="flex items-start justify-between px-4 py-1.5">
            <div className="space-y-0">
              <p className="text-xs font-medium text-muted-foreground">{t.dashboard.totalPatients}</p>
              <p className="font-mono text-2xl font-bold tracking-tight">{totalPatients}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-1.5">
              <UsersIcon className="text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card transition-all hover:border-warning/50 py-2">
          <CardContent className="flex items-start justify-between px-4 py-1.5">
            <div className="space-y-0">
              <p className="text-xs font-medium text-muted-foreground">{t.dashboard.needsReview}</p>
              <p className="font-mono text-2xl font-bold tracking-tight text-warning">{needsReview}</p>
            </div>
            <div className="rounded-lg bg-warning/10 p-1.5">
              <AlertCircleIcon className="text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card transition-all hover:border-destructive/50 py-2">
          <CardContent className="flex items-start justify-between px-4 py-1.5">
            <div className="space-y-0">
              <p className="text-xs font-medium text-muted-foreground">{t.dashboard.severeCases}</p>
              <p className="font-mono text-2xl font-bold tracking-tight text-destructive">{severeCases}</p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-1.5">
              <ActivityIcon className="text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card transition-all hover:border-success/50 py-2">
          <CardContent className="flex items-start justify-between px-4 py-1.5">
            <div className="space-y-0">
              <p className="text-xs font-medium text-muted-foreground">{t.dashboard.improving}</p>
              <p className="font-mono text-2xl font-bold tracking-tight text-success">{improving}</p>
            </div>
            <div className="rounded-lg bg-success/10 p-1.5">
              <CheckCircleIcon className="text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patients Table */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-col gap-1 pb-4">
          <CardTitle className="text-2xl">{t.dashboard.patientOverview}</CardTitle>
          <CardDescription>{t.dashboard.quickTriageView}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-semibold text-foreground">{t.dashboard.patient}</TableHead>
                  <TableHead className="font-semibold text-foreground">{t.dashboard.osdiScore}</TableHead>
                  <TableHead className="font-semibold text-foreground">{t.dashboard.severity}</TableHead>
                  <TableHead className="font-semibold text-foreground">{t.dashboard.trend}</TableHead>
                  <TableHead className="font-semibold text-foreground">{t.dashboard.symptoms}</TableHead>
                  <TableHead className="font-semibold text-foreground">{t.dashboard.lastVisit}</TableHead>
                  <TableHead className="font-semibold text-foreground">{t.dashboard.status}</TableHead>
                </TableRow>
              </TableHeader>
              <DashboardTableClient patients={patients} locale={locale} t={{ noPatients: t.dashboard.noPatients }} />
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
