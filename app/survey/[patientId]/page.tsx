"use client"

import type React from "react"
import { use, useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { CheckCircleIcon, EyeIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react"
import { useLocale } from "@/components/locale-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import type { MedicationUpdate } from "@/lib/types"

type FrequencyValue = "none" | "sometimes" | "half" | "most" | "all" | "not_applicable"

type SurveyFormData = {
  responses: {
    [key: number]: {
      frequency: FrequencyValue
      freeText: string
    }
  }
  medicationChanges: boolean
  newMedications: MedicationUpdate[]
  stoppedMedications: MedicationUpdate[]
  continuingMedications: MedicationUpdate[]
}

type PatientInfo = {
  id: string
  name: string
}

export default function PatientSurveyPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params)
  const { t } = useLocale()
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<SurveyFormData>({
    responses: {},
    medicationChanges: false,
    newMedications: [],
    stoppedMedications: [],
    continuingMedications: [],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPatient() {
      try {
        const response = await fetch(`/api/patient/${patientId}`)
        if (response.ok) {
          const data = await response.json()
          setPatient(data.patient)
        }
      } catch (err) {
        console.error("Failed to fetch patient:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchPatient()
  }, [patientId])

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

  const addMedication = (type: "new" | "stopped" | "continuing") => {
    const newMed: MedicationUpdate = {
      medication_name: "",
      dosage: "",
      frequency: "",
      status: type === "stopped" ? "stopped" : type === "new" ? "new" : "active",
      notes: "",
    }

    setFormData((prev) => ({
      ...prev,
      [`${type}Medications`]: [...(prev[`${type}Medications` as keyof typeof prev] as MedicationUpdate[]), newMed],
    }))
  }

  const removeMedication = (type: "new" | "stopped" | "continuing", index: number) => {
    setFormData((prev) => ({
      ...prev,
      [`${type}Medications`]: (prev[`${type}Medications` as keyof typeof prev] as MedicationUpdate[]).filter(
        (_: MedicationUpdate, i: number) => i !== index,
      ),
    }))
  }

  const updateMedication = (
    type: "new" | "stopped" | "continuing",
    index: number,
    field: keyof MedicationUpdate,
    value: string,
  ) => {
    setFormData((prev) => {
      const meds = [...(prev[`${type}Medications` as keyof typeof prev] as MedicationUpdate[])]
      meds[index] = { ...meds[index], [field]: value }
      return { ...prev, [`${type}Medications`]: meds }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          name: patient?.name,
          responses: formData.responses,
          medications: {
            new: formData.newMedications.filter((m) => m.medication_name.trim()),
            stopped: formData.stoppedMedications.filter((m) => m.medication_name.trim()),
            continuing: formData.continuingMedications.filter((m) => m.medication_name.trim()),
          },
        }),
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2Icon className="size-8 animate-spin text-primary" />
      </div>
    )
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
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <EyeIcon className="text-primary" />
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

        {patient && (
          <Card>
            <CardContent className="p-4">
              <p className="text-lg">
                {t.survey.greetingPrefix} <span className="font-bold">{patient.name}</span>
                {t.survey.greetingSuffix}
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardDescription className="text-base">{t.survey.instructions}</CardDescription>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.survey.questionsSection}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-8">
              {questions.map((question) => (
                <div key={question.number} className="flex flex-col gap-4 border-b border-border pb-6 last:border-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {question.number}
                    </span>
                    <p className="text-lg font-medium leading-relaxed">{question.text}</p>
                  </div>

                  <div className="ml-11 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm text-muted-foreground">{t.survey.frequencyLabel}</Label>
                      <RadioGroup
                        value={formData.responses[question.number]?.frequency || ""}
                        onValueChange={(value) => handleFrequencyChange(question.number, value as FrequencyValue)}
                        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                      >
                        {frequencyOptions.map((option) => (
                          <div key={option.value} className="flex items-center gap-2">
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

                    <div className="flex flex-col gap-2">
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

          <Card>
            <CardHeader>
              <CardTitle>{t.survey.medicationSection}</CardTitle>
              <CardDescription>{t.survey.medicationInstructions}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <Label className="text-base font-medium">{t.survey.anyMedicationChanges}</Label>
                <RadioGroup
                  value={formData.medicationChanges ? "yes" : "no"}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, medicationChanges: value === "yes" }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="med-changes-yes" />
                    <Label htmlFor="med-changes-yes" className="cursor-pointer font-normal">
                      {t.survey.yes}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="med-changes-no" />
                    <Label htmlFor="med-changes-no" className="cursor-pointer font-normal">
                      {t.survey.no}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.medicationChanges && (
                <div className="flex flex-col gap-6 border-t pt-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">{t.survey.newMedications}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addMedication("new")}
                      >
                        <PlusIcon data-icon="inline-start" />
                        {t.survey.addMedication}
                      </Button>
                    </div>
                    {formData.newMedications.map((med, index) => (
                      <MedicationForm
                        key={index}
                        medication={med}
                        onUpdate={(field, value) => updateMedication("new", index, field, value)}
                        onRemove={() => removeMedication("new", index)}
                        showStartDate
                      />
                    ))}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">{t.survey.stoppedMedications}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addMedication("stopped")}
                      >
                        <PlusIcon data-icon="inline-start" />
                        {t.survey.addMedication}
                      </Button>
                    </div>
                    {formData.stoppedMedications.map((med, index) => (
                      <MedicationForm
                        key={index}
                        medication={med}
                        onUpdate={(field, value) => updateMedication("stopped", index, field, value)}
                        onRemove={() => removeMedication("stopped", index)}
                        showStopDate
                      />
                    ))}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-medium">{t.survey.continuingMedications}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addMedication("continuing")}
                      >
                        <PlusIcon data-icon="inline-start" />
                        {t.survey.addMedication}
                      </Button>
                    </div>
                    {formData.continuingMedications.map((med, index) => (
                      <MedicationForm
                        key={index}
                        medication={med}
                        onUpdate={(field, value) => updateMedication("continuing", index, field, value)}
                        onRemove={() => removeMedication("continuing", index)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-4">
                <p className="text-center text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t.survey.submitting : t.survey.submit}
          </Button>
        </form>
      </div>
    </div>
  )
}

function MedicationForm({
  medication,
  onUpdate,
  onRemove,
  showStartDate = false,
  showStopDate = false,
}: {
  medication: MedicationUpdate
  onUpdate: (field: keyof MedicationUpdate, value: string) => void
  onRemove: () => void
  showStartDate?: boolean
  showStopDate?: boolean
}) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 flex-col gap-3">
          <Input
            placeholder={t.survey.medicationNamePlaceholder}
            value={medication.medication_name}
            onChange={(e) => onUpdate("medication_name", e.target.value)}
            className="text-right"
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder={t.survey.dosagePlaceholder}
              value={medication.dosage || ""}
              onChange={(e) => onUpdate("dosage", e.target.value)}
              className="text-right"
            />
            <Input
              placeholder={t.survey.frequencyPlaceholder}
              value={medication.frequency || ""}
              onChange={(e) => onUpdate("frequency", e.target.value)}
              className="text-right"
            />
          </div>
          {(showStartDate || showStopDate) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {showStartDate && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">{t.survey.startDateLabel}</Label>
                  <Input
                    type="date"
                    value={medication.start_date || ""}
                    onChange={(e) => onUpdate("start_date", e.target.value)}
                  />
                </div>
              )}
              {showStopDate && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">{t.survey.stopDateLabel}</Label>
                  <Input
                    type="date"
                    value={medication.stop_date || ""}
                    onChange={(e) => onUpdate("stop_date", e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          <Textarea
            placeholder={t.survey.medicationNotesPlaceholder}
            value={medication.notes || ""}
            onChange={(e) => onUpdate("notes", e.target.value)}
            className="min-h-[60px] resize-none text-right"
          />
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="shrink-0 text-destructive">
          <XIcon />
        </Button>
      </div>
    </div>
  )
}
