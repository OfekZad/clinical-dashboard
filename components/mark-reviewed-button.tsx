"use client"

import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { CheckCircleIcon } from "lucide-react"
import { useState } from "react"

export function MarkReviewedButton({ assessmentId }: { assessmentId: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleMarkReviewed = async () => {
    setIsLoading(true)
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase.from("assessments").update({ reviewed: true }).eq("id", assessmentId)

    if (!error) {
      router.refresh()
    }

    setIsLoading(false)
  }

  return (
    <Button onClick={handleMarkReviewed} disabled={isLoading}>
      <CheckCircleIcon />
      {isLoading ? "מסמן..." : "סמן כנבדק"}
    </Button>
  )
}
