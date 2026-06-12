import { NextResponse } from "next/server"
import { handleJoyInboundSms } from "@/lib/joy-refill-assistant"
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase/server"

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Joy requires a configured Supabase database connection" },
      { status: 503 },
    )
  }

  try {
    const body = (await request.json()) as {
      conversationId?: string
      body?: string
      message?: string
      externalMessageId?: string | null
    }
    const messageBody = body.body ?? body.message

    if (!body.conversationId || !messageBody) {
      return NextResponse.json(
        { success: false, error: "conversationId and body are required" },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()
    const result = await handleJoyInboundSms(supabase, {
      conversationId: body.conversationId,
      body: messageBody,
      externalMessageId: body.externalMessageId,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("Joy inbound SMS error:", error)
    return NextResponse.json({ success: false, error: "Failed to process Joy SMS" }, { status: 500 })
  }
}
