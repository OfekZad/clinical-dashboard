const DIAL_BASE_URL = "https://getdial.ai"

function getApiKey() {
  const key = process.env.DIAL_API_KEY
  if (!key) throw new Error("DIAL_API_KEY is not set")
  return key
}

export interface DialMessage {
  id: string
  to: string
  from: string
  body: string
  direction: "outbound" | "inbound"
  createdAt?: string
}

export interface DialEvent {
  type: string
  from?: string
  to?: string
  body?: string
  id?: string
  messageId?: string
}

/**
 * Send an outbound SMS via Dial.
 */
export async function sendSMS(to: string, body: string): Promise<DialMessage> {
  const phoneNumberId = process.env.DIAL_PHONE_NUMBER_ID
  if (!phoneNumberId) throw new Error("DIAL_PHONE_NUMBER_ID is not set")

  const res = await fetch(`${DIAL_BASE_URL}/api/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, body, fromNumberId: phoneNumberId }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Dial sendSMS failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<DialMessage>
}

/**
 * Long-poll Dial for the next inbound event (e.g. an inbound SMS reply).
 * Returns null if the timeout expires with no event.
 */
export async function waitForEvent(timeoutMs = 8000): Promise<DialEvent | null> {
  const res = await fetch(`${DIAL_BASE_URL}/api/v1/events/wait`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    // timeout is in seconds (max 60); eventType is the correct field name
    body: JSON.stringify({ eventType: "inbound_message", timeout: Math.min(Math.floor(timeoutMs / 1000), 60) }),
  })

  if (res.status === 204 || res.status === 408) return null
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Dial waitForEvent failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  // If the response is an empty object or has no type, treat as no event
  if (!data || !data.type) return null
  return data as DialEvent
}
