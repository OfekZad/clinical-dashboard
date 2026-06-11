"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CheckCircleIcon, EyeIcon } from "lucide-react"
import { useLocale } from "@/components/locale-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"

type FrequencyValue = "none" | "sometimes" | "half" | "most" | "all" | "not_applicable"

type SurveyFormData = {
  name: string
  email: string
  phone: string
  responses: {
    [key: number]: {
      frequency: FrequencyValue
      freeText: string
    }
  }
}

export default function SurveyPage() {
  const { t } = useLocale()
  const [formData, setFormData] = useState<SurveyFormData>({
    name: "",
    email: "",
    phone: "",
    responses: {},
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const questions = Object.entries(t.survey.questions).map(([num, text]) => ({
    number: Number.parseInt(num),
    text,
  }))

  const frequencyOptions: { value: FrequencyValue; label: string }[] = [
    { value: "none", label: t.survey.frequency.none },
    { value: "sometimes", label: t.survey.frequency.sometimes },
    { value: "half", label: t.survey.frequency.half },
    { value: "most", label: t.survey.frequency.most },
    { value: "all", label: t.survey.frequency.all },
    { value: "not_applicable", label: t.survey.frequency.not_applicable },
  ]

  const handleFrequencyChange = (questionNumber: number, frequency: FrequencyValue) => {
    setFormData((prev) => ({
      ...prev,
      responses: {
        ...prev.responses,
        [questionNumber]: {
          ...prev.responses[questionNumber],
          frequency,
          freeText: prev.responses[questionNumber]?.freeText || "",
        },
      },
    }))
  }

  const handleFreeTextChange = (questionNumber: number, freeText: string) => {
    setFormData((prev) => ({
      ...prev,
      responses: {
        ...prev.responses,
        [questionNumber]: {
          ...prev.responses[questionNumber],
          frequency: prev.responses[questionNumber]?.frequency || "none",
          freeText,
        },
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error("Failed to submit survey")
      }

      setIsSubmitted(true)
    } catch (err) {
      setError(t.survey.errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <Card className="border-success/20 bg-success/5">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="rounded-full bg-success/10 p-4">
                <CheckCircleIcon className="size-12 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-success">{t.survey.successTitle}</h2>
              <p className="text-muted-foreground">{t.survey.successMessage}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <EyeIcon className="size-6 text-primary" />
              </div>
              <h1 className="font-sans text-3xl font-bold tracking-tight">{t.survey.title}</h1>
            </div>
            <p className="text-muted-foreground">{t.survey.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Toggle — hidden, English is default */}
            {/* <LanguageToggle /> */}
            <ThemeToggle />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardDescription className="text-base">{t.survey.instructions}</CardDescription>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t.survey.patientInfo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t.survey.name} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder={t.survey.namePlaceholder}
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  className="text-right"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">{t.survey.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t.survey.emailPlaceholder}
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.survey.phone}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={t.survey.phonePlaceholder}
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Questions */}
          <Card>
            <CardHeader>
              <CardTitle>{t.survey.questionsSection}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {questions.map((question) => (
                <div key={question.number} className="space-y-4 border-b border-border pb-6 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {question.number}
                    </span>
                    <p className="text-lg font-medium leading-relaxed">{question.text}</p>
                  </div>

                  <div className="mr-11 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">{t.survey.frequencyLabel}</Label>
                      <RadioGroup
                        value={formData.responses[question.number]?.frequency || ""}
                        onValueChange={(value) => handleFrequencyChange(question.number, value as FrequencyValue)}
                        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                      >
                        {frequencyOptions.map((option) => (
                          <div key={option.value} className="flex items-center space-x-2 space-x-reverse">
                            <RadioGroupItem value={option.value} id={`q${question.number}-${option.value}`} />
                            <Label
                              htmlFor={`q${question.number}-${option.value}`}
                              className="cursor-pointer text-sm font-normal"
                            >
                              {option.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">{t.survey.describeExperience}</Label>
                      <Textarea
                        placeholder={t.survey.descriptionPlaceholder}
                        value={formData.responses[question.number]?.freeText || ""}
                        onChange={(e) => handleFreeTextChange(question.number, e.target.value)}
                        className="min-h-[80px] resize-none text-right"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
                <p className="text-center text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !formData.name}>
            {isSubmitting ? t.survey.submitting : t.survey.submit}
          </Button>
        </form>
      </div>
    </div>
  )
}
