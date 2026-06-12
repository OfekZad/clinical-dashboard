import { NextResponse } from "next/server"
import {
  detectLowMedicinePatients,
  startRefillConversation,
} from "@/lib/joy-sms-agent"

/**
 * POST /api/joy/sms/trigger
 *
 * Scans for patients whose active medications are running out within 7 days
 * and initiates SMS refill conversations for those who don't already have one.
 *
 * Intended to be called by a Vercel Cron job or manually by staff.
 */
export async function POST() {
  try {
    const candidates = await detectLowMedicinePatients()

    const results: { patientId: string; medicationName: string; conversationId: string | null; skipped: boolean }[] = []

    for (const med of candidates) {
      if (!med.patient_phone) {
        results.push({ patientId: med.patient_id, medicationName: med.medication_name, conversationId: null, skipped: true })
        continue
      }

      const conversationId = await startRefillConversation(med)
      results.push({
        patientId: med.patient_id,
        medicationName: med.medication_name,
        conversationId,
        skipped: conversationId === null,
      })
    }

    const initiated = results.filter((r) => r.conversationId !== null).length
    const skipped = results.filter((r) => r.skipped).length

    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      initiated,
      skipped,
      results,
    })
  } catch (err) {
    console.error("[Joy SMS Trigger] Error:", err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
