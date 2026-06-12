export type SmsDeliveryStatus = "sent" | "skipped"

export type SmsDeliveryResult = {
  status: SmsDeliveryStatus
  provider: "twilio" | "not_configured"
  providerMessageId: string | null
  warning?: string
}

export type SmsSendRequest = {
  to: string | null | undefined
  body: string
}

export async function sendJoySms({ to, body }: SmsSendRequest): Promise<SmsDeliveryResult> {
  if (!to) {
    return {
      status: "skipped",
      provider: "not_configured",
      providerMessageId: null,
      warning: "No destination phone number is available for this patient.",
    }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromPhone = process.env.TWILIO_FROM_PHONE
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

  if (!accountSid || !authToken || (!fromPhone && !messagingServiceSid)) {
    return {
      status: "skipped",
      provider: "not_configured",
      providerMessageId: null,
      warning:
        "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_FROM_PHONE or TWILIO_MESSAGING_SERVICE_SID to send live SMS.",
    }
  }

  const form = new URLSearchParams({ To: to, Body: body })
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid)
  } else if (fromPhone) {
    form.set("From", fromPhone)
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  })

  const result = (await response.json()) as { sid?: string; message?: string; code?: number }

  if (!response.ok) {
    throw new Error(`Twilio SMS send failed${result.code ? ` (${result.code})` : ""}: ${result.message ?? response.statusText}`)
  }

  return {
    status: "sent",
    provider: "twilio",
    providerMessageId: result.sid ?? null,
  }
}
