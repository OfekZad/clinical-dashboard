"use client"

import type { PatientWithLatestAssessment } from "@/lib/types"
import { TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { InlineText, InlineNumber, InlineSelect, InlineDate } from "@/components/inline-edit"
import {
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  MonitorIcon,
  MoonIcon,
  WindIcon,
  DropletIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "lucide-react"
import { getSeverityLabel, localeTag, type Locale } from "@/lib/i18n"
import Link from "next/link"

function getSeverityColor(severity: string) {
  switch (severity) {
    case "Normal":
      return "bg-success/10 text-success border-success/20"
    case "Mild":
      return "bg-info/10 text-info border-info/20"
    case "Moderate":
      return "bg-warning/10 text-warning border-warning/20"
    case "Severe":
      return "bg-destructive/10 text-destructive border-destructive/20"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

const severityOptions = [
  { value: "Normal", label: "Normal", colorClass: "bg-success/10 text-success border-success/20" },
  { value: "Mild", label: "Mild", colorClass: "bg-info/10 text-info border-info/20" },
  { value: "Moderate", label: "Moderate", colorClass: "bg-warning/10 text-warning border-warning/20" },
  { value: "Severe", label: "Severe", colorClass: "bg-destructive/10 text-destructive border-destructive/20" },
]

const statusOptions = [
  { value: "true", label: "Reviewed", colorClass: "bg-success/10 text-success border-success/20" },
  { value: "false", label: "Needs Review", colorClass: "bg-warning/10 text-warning border-warning/20" },
]

// ── Individual cell components ──────────────────────────────────────────

function DashboardPatientCell({
  patient,
}: {
  patient: PatientWithLatestAssessment
}) {
  const dobDisplay = patient.date_of_birth
    ? new Date(patient.date_of_birth).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null
  return (
    <TableCell>
      <Link href={`/patient/${patient.id}`} className="block">
        <div className="space-y-0.5">
          <div className="font-medium transition-colors group-hover:text-primary">
            {patient.name}
          </div>
          {dobDisplay && (
            <div className="text-xs text-muted-foreground">
              {dobDisplay}
            </div>
          )}
        </div>
      </Link>
    </TableCell>
  )
}

function DashboardScoreCell({ assessment }: { assessment: PatientWithLatestAssessment["latest_assessment"] }) {
  const canEdit = assessment && assessment.id
  return (
    <TableCell>
      {canEdit ? (
        <div className="flex items-center gap-0">
          <InlineNumber
            value={assessment.total_score}
            min={0}
            max={100}
            suffix="/ 100"
            className="font-mono text-2xl font-bold"
            onSave={async (val) => {
              await fetch(`/api/assessment/${assessment.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ total_score: parseInt(val, 10) }),
              })
            }}
          />
        </div>
      ) : assessment ? (
        <div className="flex items-center gap-0">
          <span className="font-mono text-2xl font-bold">{assessment.total_score}</span>
          <span className="text-xs text-muted-foreground ml-0.5">/ 100</span>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </TableCell>
  )
}

function DashboardSeverityCell({
  assessment,
  locale,
}: {
  assessment: PatientWithLatestAssessment["latest_assessment"]
  locale: Locale
}) {
  const canEdit = assessment && assessment.id
  return (
    <TableCell>
      {canEdit ? (
        <InlineSelect
          value={assessment.severity_level}
          options={severityOptions}
          renderDisplay={(val) => (
            <Badge variant="outline" className={getSeverityColor(val || "")}>
              {getSeverityLabel(val || "", locale)}
            </Badge>
          )}
          onSave={async (val) => {
            await fetch(`/api/assessment/${assessment.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ severity_level: val }),
            })
          }}
        />
      ) : assessment ? (
        <Badge variant="outline" className={getSeverityColor(assessment.severity_level)}>
          {getSeverityLabel(assessment.severity_level, locale)}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </TableCell>
  )
}

function DashboardTrendCell({
  assessment,
  previousScore,
}: {
  assessment: PatientWithLatestAssessment["latest_assessment"]
  previousScore?: number
}) {
  return (
    <TableCell>
      {assessment ? (
        previousScore !== undefined ? (
          assessment.total_score < previousScore ? (
            <div className="flex items-center gap-1 text-success">
              <TrendingDownIcon className="size-4" />
              <span className="text-xs font-medium">-{previousScore - assessment.total_score}</span>
            </div>
          ) : assessment.total_score > previousScore ? (
            <div className="flex items-center gap-1 text-destructive">
              <TrendingUpIcon className="size-4" />
              <span className="text-xs font-medium">+{assessment.total_score - previousScore}</span>
            </div>
          ) : (
            <MinusIcon className="size-4 text-muted-foreground" />
          )
        ) : (
          <MinusIcon className="size-4 text-muted-foreground" />
        )
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </TableCell>
  )
}

function DashboardSymptomsCell({
  assessment,
}: {
  assessment: PatientWithLatestAssessment["latest_assessment"]
}) {
  return (
    <TableCell>
      <div className="flex gap-2">
        {assessment?.has_screen_intolerance && (
          <div className="rounded-md bg-warning/10 p-1.5">
            <MonitorIcon className="size-4 text-warning" />
          </div>
        )}
        {assessment?.has_night_driving_issues && (
          <div className="rounded-md bg-info/10 p-1.5">
            <MoonIcon className="size-4 text-info" />
          </div>
        )}
        {assessment?.has_wind_sensitivity && (
          <div className="rounded-md bg-primary/10 p-1.5">
            <WindIcon className="size-4 text-primary" />
          </div>
        )}
        {assessment?.has_low_humidity_issues && (
          <div className="rounded-md bg-chart-2/10 p-1.5">
            <DropletIcon className="size-4 text-chart-2" />
          </div>
        )}
      </div>
    </TableCell>
  )
}

function DashboardDateCell({
  assessment,
}: {
  assessment: PatientWithLatestAssessment["latest_assessment"]
}) {
  const canEdit = assessment && assessment.id
  const displayValue = assessment?.assessment_date
    ? new Date(assessment.assessment_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—"
  return (
    <TableCell className="text-muted-foreground">
      {canEdit ? (
        <InlineDate
          value={assessment.assessment_date}
          onSave={async (val) => {
            await fetch(`/api/assessment/${assessment.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assessment_date: val }),
            })
          }}
        />
      ) : (
        <span className="text-muted-foreground">{displayValue}</span>
      )}
    </TableCell>
  )
}

function DashboardStatusCell({
  assessment,
}: {
  assessment: PatientWithLatestAssessment["latest_assessment"]
}) {
  const canEdit = assessment && assessment.id
  return (
    <TableCell>
      {canEdit ? (
        <InlineSelect
          value={String(assessment.reviewed)}
          options={statusOptions}
          renderDisplay={(val) =>
            val === "true" ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircleIcon className="mr-1 size-3" />
                Reviewed
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                <AlertCircleIcon className="mr-1 size-3" />
                Needs Review
              </Badge>
            )
          }
          onSave={async (val) => {
            await fetch(`/api/assessment/${assessment.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reviewed: val === "true" }),
            })
          }}
        />
      ) : assessment ? (
        assessment.reviewed ? (
          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
            <CheckCircleIcon className="mr-1 size-3" />
            Reviewed
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            <AlertCircleIcon className="mr-1 size-3" />
            Needs Review
          </Badge>
        )
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </TableCell>
  )
}

// ── Main exported component ─────────────────────────────────────────────

interface DashboardTableClientProps {
  patients: PatientWithLatestAssessment[]
  locale: Locale
  t: {
    noPatients: string
  }
}

export function DashboardTableClient({ patients, locale, t }: DashboardTableClientProps) {
  return (
    <TableBody>
      {patients.length === 0 ? (
        <TableRow>
          <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
            {t.noPatients}
          </TableCell>
        </TableRow>
      ) : (
        patients.map((patient) => {
          const assessment = patient.latest_assessment
          const previousScore = patient.previous_assessment?.total_score

          return (
            <TableRow
              key={patient.id}
              className="group border-border transition-colors hover:bg-accent/50"
            >
              <DashboardPatientCell patient={patient} />
              <DashboardScoreCell assessment={assessment} />
              <DashboardSeverityCell assessment={assessment} locale={locale} />
              <DashboardTrendCell assessment={assessment} previousScore={previousScore} />
              <DashboardSymptomsCell assessment={assessment} />
              <DashboardDateCell assessment={assessment} />
              <DashboardStatusCell assessment={assessment} />
            </TableRow>
          )
        })
      )}
    </TableBody>
  )
}