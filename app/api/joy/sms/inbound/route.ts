import { NextRequest, NextResponse } from "next/server"
import { handleInboundMessage } from "@/lib/joy-sms-agent"

/**
 * POST /api/joy/sms/inbound
 *
 * Webhook called by Dial when a patient replies to an SMS.
 * Payload expected: { from: string, to: string, body: string, id?: string }
 *
 * For the self-hosted voice architecture we use a Supabase Edge Function
 * (`joy-sms`) as the primary webhook target (it has direct Vault + DB access).
 * This route is a secondary entry point, e.g. for local dev or if the Edge
 * Function is temporarily unavailable.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const from: string | undefined = payload.from
    const body: string | undefined = payload.body ?? payload.text ?? payload.message

    if (!from || !body) {
      return NextResponse.json({ error: "Missing from or body" }, { status: 400 })
    }

    await handleInboundMessage(from, body)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Joy SMS Inbound] Error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
