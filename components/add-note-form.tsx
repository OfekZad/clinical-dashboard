"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useLocale } from "@/components/locale-provider"

export function AddNoteForm({ assessmentId }: { assessmentId: string }) {
  const [noteText, setNoteText] = useState("")
  const [createdBy, setCreatedBy] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { t } = useLocale()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim()) return

    setIsSubmitting(true)
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase.from("clinician_notes").insert({
      assessment_id: assessmentId,
      note_text: noteText.trim(),
      created_by: createdBy.trim() || "Anonymous",
    })

    if (!error) {
      setNoteText("")
      setCreatedBy("")
      router.refresh()
    }

    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Input
          placeholder={t.patient.yourName}
          value={createdBy}
          onChange={(e) => setCreatedBy(e.target.value)}
          className="border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500"
        />
        <Textarea
          placeholder={t.patient.addNotePlaceholder}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="min-h-24 border-zinc-700 bg-zinc-900 text-white placeholder:text-zinc-500"
        />
      </div>
      <Button type="submit" disabled={isSubmitting || !noteText.trim()} className="w-full">
        {isSubmitting ? t.patient.addingNote : t.patient.addNoteButton}
      </Button>
    </form>
  )
}
