"use client"

import type { Patient, Assessment } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { InlineText, InlineNumber, InlineSelect, InlineDate } from "@/components/inline-edit"
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react"
import { getSeverityLabel, type Locale } from "@/lib/i18n"

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

interface PatientInfoClientProps {
  patient: Patient
  assessment: Assessment | null
  previousScore: number | null
  locale: Locale
  t: {
    dateOfBirth: string
    osdiScore: string
    severityLevel: string
    latestAssessment: string
    previousAssessment: string
    worsening: string
    improving: string
    stable: string
  }
  children?: React.ReactNode
}

export function PatientInfoClient({
  patient,
  assessment,
  previousScore,
  locale,
  t,
  children,
}: PatientInfoClientProps) {
  const trend = assessment && previousScore !== null
    ? (() => {
        const diff = assessment.total_score - previousScore
        if (diff > 5) return { icon: TrendingUpIcon, label: t.worsening, color: "text-destructive" }
        if (diff < -5) return { icon: TrendingDownIcon, label: t.improving, color: "text-success" }
        return { icon: MinusIcon, label: t.stable, color: "text-muted-foreground" }
      })()
    : null

  return (
    <>
      {/* Patient Info Header Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl font-bold">
                <InlineText
                  value={patient.name}
                  onSave={async (val) => {
                    await fetch(`/api/patient/${patient.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: val }),
                    })
                  }}
                />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {patient.date_of_birth && (
                  <span>
                    {t.dateOfBirth}: <InlineDate
                      value={patient.date_of_birth}
                      onSave={async (val) => {
                        await fetch(`/api/patient/${patient.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ date_of_birth: val }),
                        })
                      }}
                    />
                  </span>
                )}
                {patient.email && (
                  <span>
                    <InlineText
                      value={patient.email}
                      onSave={async (val) => {
                        await fetch(`/api/patient/${patient.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: val }),
                        })
                      }}
                    />
                  </span>
                )}
                {patient.phone && (
                  <span>
                    <InlineText
                      value={patient.phone}
                      onSave={async (val) => {
                        await fetch(`/api/patient/${patient.id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ phone: val }),
                        })
                      }}
                    />
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {children}
            </div>
          </div>
        </div>
      </div>

      {assessment && (
        <div className="grid gap-3 sm:grid-cols-3">
          {/* OSDI Score */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-accent/30 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <InlineNumber
                value={assessment.total_score}
                min={0}
                max={100}
                className="text-2xl font-bold text-foreground"
                onSave={async (val) => {
                  await fetch(`/api/assessment/${assessment.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ total_score: parseInt(val, 10) }),
                  })
                }}
              />
              {trend && (
                <div className={`flex items-center gap-0.5 ${trend.color}`}>
                  <trend.icon className="text-current" />
                  <span className="text-[10px] font-medium">{trend.label}</span>
                </div>
              )}
            </div>
            <div className="border-l border-border/50 pl-3">
              <div className="text-[11px] font-medium text-muted-foreground">{t.osdiScore}</div>
              {previousScore !== null && (
                <div className="text-[10px] text-muted-foreground">
                  {t.previousAssessment}: {previousScore}
                </div>
              )}
            </div>
          </div>

          {/* Severity */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-accent/30 px-4 py-3 shadow-sm">
            <InlineSelect
              value={assessment.severity_level}
              options={severityOptions}
              renderDisplay={(val) => (
                <Badge className={`text-sm font-semibold ${getSeverityColor(val || "")}`}>
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
            <div className="text-[11px] font-medium text-muted-foreground">{t.severityLevel}</div>
          </div>

          {/* Last Visit */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-accent/30 px-4 py-3 shadow-sm">
            <CalendarIcon className="text-muted-foreground" />
            <div>
              <div className="text-xs font-semibold text-foreground">
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
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">{t.latestAssessment}</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
