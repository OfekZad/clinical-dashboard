"use client"

import { XIcon, MessageSquareQuoteIcon, BrainIcon, ListChecksIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { AssessmentResponse, SurveyResponse } from "@/lib/types"
import type { Locale, Strings, FrequencyKey } from "@/lib/i18n"

function getScoreColor(score: number) {
  if (score === 0) return "bg-success/10 text-success border-success/20"
  if (score <= 1) return "bg-info/10 text-info border-info/20"
  if (score <= 2) return "bg-warning/10 text-warning border-warning/20"
  return "bg-destructive/10 text-destructive border-destructive/20"
}

function getScoreLabel(score: number, locale: Locale): string {
  const labels: Record<Locale, Record<number, string>> = {
    en: { 0: "None", 1: "Mild", 2: "Moderate", 3: "Severe", 4: "Very Severe" },
    he: { 0: "\u05dc\u05dc\u05d0", 1: "\u05e7\u05dc", 2: "\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9", 3: "\u05d7\u05de\u05d5\u05e8", 4: "\u05d7\u05de\u05d5\u05e8 \u05de\u05d0\u05d5\u05d3" },
  }
  return labels[locale]?.[score] ?? `${score}`
}

const frequencyLabels: Record<FrequencyKey, { en: string; he: string }> = {
  none: { en: "Never", he: "\u05d0\u05e3 \u05e4\u05e2\u05dd" },
  sometimes: { en: "Sometimes", he: "\u05dc\u05e4\u05e2\u05de\u05d9\u05dd" },
  half: { en: "About half", he: "\u05db\u05de\u05d7\u05e6\u05d9\u05ea" },
  most: { en: "Most of the time", he: "\u05e8\u05d5\u05d1 \u05d4\u05d6\u05de\u05df" },
  all: { en: "All the time", he: "\u05db\u05dc \u05d4\u05d6\u05de\u05df" },
  not_applicable: { en: "N/A", he: "\u05dc\u05d0 \u05e8\u05dc\u05d5\u05d5\u05e0\u05d8\u05d9" },
}

interface AssessmentSidebarProps {
  responses: AssessmentResponse[]
  surveyResponses: SurveyResponse[]
  assessmentType: "ai" | "survey"
  locale: Locale
  t: Pick<Strings["patient"], "questionByQuestion" | "patientResponsesTitle" | "assessments">
  onClose: () => void
}


export function AssessmentSidebar({
  responses,
  surveyResponses,
  assessmentType,
  locale,
  t,
  onClose,
}: AssessmentSidebarProps) {
  const showAiResponses = assessmentType === "ai" && responses.length > 0
  const showSurveyResponses = assessmentType === "survey" && surveyResponses.length > 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ListChecksIcon className="text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            {showAiResponses ? t.questionByQuestion : t.patientResponsesTitle}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <XIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
          {showAiResponses && responses.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-accent/20 p-3 transition-all hover:bg-accent/40">
              <div className="flex items-start gap-3">
                <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-bold text-xs">
                  {r.question_number}
                </div>
                <div className="flex flex-1 min-w-0 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-foreground">{r.question_text}</h4>
                    <Badge className={`shrink-0 text-[10px] px-2 py-0.5 ${getScoreColor(r.patient_response)}`}>
                      {r.patient_response} · {getScoreLabel(r.patient_response, locale)}
                    </Badge>
                  </div>
                  {r.patient_quote && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground italic">
                      <MessageSquareQuoteIcon className="mt-0.5 shrink-0 opacity-60" />
                      <span>&ldquo;{r.patient_quote}&rdquo;</span>
                    </div>
                  )}
                  {r.reasoning && (
                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80">
                      <BrainIcon className="mt-0.5 shrink-0 opacity-60" />
                      <span>{r.reasoning}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {showSurveyResponses && surveyResponses.map((sr) => {
            const freqLabel = frequencyLabels[sr.frequency as FrequencyKey]
            return (
              <div key={sr.id} className="rounded-lg border border-border bg-accent/20 p-3 transition-all hover:bg-accent/40">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-bold text-xs">
                    {sr.question_number}
                  </div>
                  <div className="flex flex-1 min-w-0 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-normal">
                        {freqLabel ? freqLabel[locale] : sr.frequency}
                      </Badge>
                      {sr.assigned_score !== null && (
                        <Badge className={`shrink-0 text-[10px] px-2 py-0.5 ${getScoreColor(sr.assigned_score)}`}>
                          {sr.assigned_score} · {getScoreLabel(sr.assigned_score, locale)}
                        </Badge>
                      )}
                    </div>
                    {sr.free_text && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground italic">
                        <MessageSquareQuoteIcon className="mt-0.5 shrink-0 opacity-60" />
                        <span>&ldquo;{sr.free_text}&rdquo;</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
