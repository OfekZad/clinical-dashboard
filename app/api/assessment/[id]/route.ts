import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!isSupabaseConfigured()) {
    // Seed data mode — just echo success
    return NextResponse.json({ success: true, assessment: null })
  }

  try {
    const supabase = await createServerClient()
    const body = await request.json()

    // Validate that at least one updatable field is present
    const allowedFields = ["total_score", "severity_level", "assessment_date", "reviewed"]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: assessment, error } = await supabase
      .from("assessments")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      console.error("Error updating assessment:", error)
      return NextResponse.json({ error: "Failed to update assessment" }, { status: 500 })
    }

    return NextResponse.json({ success: true, assessment })
  } catch (error) {
    console.error("Error updating assessment:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
