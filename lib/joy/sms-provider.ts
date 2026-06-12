export type SmsDeliveryStatus = "sent" | "skipped"

export type SmsDeliveryProvider = "zernio" | "twilio" | "not_configured"

export type SmsDeliveryResult = {
  status: SmsDeliveryStatus
  provider: SmsDeliveryProvider
  providerMessageId: string | null
  conversationId?: string | null
  warning?: string
}

export type SmsSendRequest = {
  to: string | null | undefined
  body: string
}

type ZernioCreateConversationResponse = {
  success?: boolean
  data?: {
    id?: string
    conversationId?: string
    messageId?: string
    platformMessageId?: string
  }
  conversation?: {
    id?: string
  }
  message?: {
    id?: string
    platformMessageId?: string
  }
  error?: string
  code?: string
}

type TwilioMessageResponse = {
  sid?: string
  message?: string
  code?: number
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

  if (isZernioConfigured()) {
    return sendZernioMessage({ to, body })
  }

  if (isTwilioConfigured()) {
    return sendTwilioMessage({ to, body })
  }

  return {
    status: "skipped",
    provider: "not_configured",
    providerMessageId: null,
    warning:
      "SMS is not configured. Set ZERNIO_API_KEY and ZERNIO_ACCOUNT_ID, or set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either TWILIO_FROM_PHONE or TWILIO_MESSAGING_SERVICE_SID.",
  }
}

function isZernioConfigured() {
  return Boolean(process.env.ZERNIO_API_KEY && process.env.ZERNIO_ACCOUNT_ID)
}

function isTwilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM_PHONE || process.env.TWILIO_MESSAGING_SERVICE_SID),
  )
}

async function sendZernioMessage({ to, body }: { to: string; body: string }): Promise<SmsDeliveryResult> {
  const apiKey = process.env.ZERNIO_API_KEY
  const accountId = process.env.ZERNIO_ACCOUNT_ID

  if (!apiKey || !accountId) {
    return {
      status: "skipped",
      provider: "not_configured",
      providerMessageId: null,
      warning: "Zernio is not configured. Set ZERNIO_API_KEY and ZERNIO_ACCOUNT_ID to send live messages.",
    }
  }

  const requestBody: Record<string, unknown> = {
    accountId,
    participantId: normalizePhoneForZernio(to),
    message: body,
  }

  if (process.env.ZERNIO_TEMPLATE_NAME) {
    requestBody.templateName = process.env.ZERNIO_TEMPLATE_NAME
    requestBody.templateLanguage = process.env.ZERNIO_TEMPLATE_LANGUAGE ?? "en_US"
    requestBody.templateParams = parseTemplateParams(body)
    delete requestBody.message
  }

  const response = await fetch("https://zernio.com/api/v1/inbox/conversations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  const result = (await response.json()) as ZernioCreateConversationResponse

  if (!response.ok) {
    throw new Error(`Zernio message send failed${result.code ? ` (${result.code})` : ""}: ${result.error ?? response.statusText}`)
  }

  const providerMessageId = result.data?.messageId ?? result.data?.platformMessageId ?? result.message?.id ?? result.message?.platformMessageId ?? null
  const conversationId = result.data?.conversationId ?? result.data?.id ?? result.conversation?.id ?? null

  return {
    status: "sent",
    provider: "zernio",
    providerMessageId,
    conversationId,
  }
}

async function sendTwilioMessage({ to, body }: { to: string; body: string }): Promise<SmsDeliveryResult> {
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

  const result = (await response.json()) as TwilioMessageResponse

  if (!response.ok) {
    throw new Error(`Twilio SMS send failed${result.code ? ` (${result.code})` : ""}: ${result.message ?? response.statusText}`)
  }

  return {
    status: "sent",
    provider: "twilio",
    providerMessageId: result.sid ?? null,
  }
}

function normalizePhoneForZernio(phone: string) {
  return phone.replace(/^\+/, "")
}

function parseTemplateParams(fallbackBody: string) {
  const rawParams = process.env.ZERNIO_TEMPLATE_PARAMS
  if (!rawParams) return [fallbackBody]

  try {
    const parsed = JSON.parse(rawParams) as unknown
    if (Array.isArray(parsed) && parsed.every((param) => typeof param === "string")) return parsed
  } catch {
    // Fall through to comma-separated parsing.
  }

  return rawParams
    .split(",")
    .map((param) => param.trim())
    .filter(Boolean)
}
