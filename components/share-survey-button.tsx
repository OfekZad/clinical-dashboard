"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Share2Icon, CheckIcon, CopyIcon } from "lucide-react"
import { useLocale } from "@/components/locale-provider"

interface ShareSurveyButtonProps {
  patientId?: string
  patientName?: string
}

export function ShareSurveyButton({ patientId, patientName }: ShareSurveyButtonProps) {
  const [copied, setCopied] = useState(false)
  const { t } = useLocale()

  const surveyUrl =
    typeof window !== "undefined"
      ? patientId
        ? `${window.location.origin}/survey/${patientId}`
        : `${window.location.origin}/survey`
      : patientId
        ? `/survey/${patientId}`
        : "/survey"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(surveyUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2Icon data-icon="inline-start" />
          {t.survey.shareLink}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.survey.shareLink}</DialogTitle>
          <DialogDescription>
            {patientName
              ? `${t.survey.shareInstructionPrefix}${patientName}${t.survey.shareInstructionSuffix}`
              : t.survey.subtitle}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={surveyUrl} readOnly dir="ltr" className="text-left font-mono text-sm" />
          <Button onClick={handleCopy} variant="outline" size="icon">
            {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
          </Button>
        </div>
        {copied && <p className="text-sm text-success">{t.survey.copiedLink}</p>}
      </DialogContent>
    </Dialog>
  )
}
