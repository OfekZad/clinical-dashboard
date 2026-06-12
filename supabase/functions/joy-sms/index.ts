// joy-sms — Supabase Edge Function (Deno)
//
// Primary inbound-SMS webhook for Joy's refill assistant.
// Dial POSTs here whenever a patient replies to an outbound SMS from Joy.
//
// Auth: X-Dial-Signature = t=<unix>,v1=hex(HMAC-SHA256(secret, "<t>.<from>"))
//       secret = Supabase Vault → "dial_signing_secret"
//
// Conversation flow:
//   1. Dial POSTs { from, to, body, id }
//   2. Look up the active sms_conversation for that phone number
//   3. Log the inbound message
//   4. Classify intent (yes/no/escalate) + ask Claude for the reply text
//   5. If yes → create refill_request, mark conversation completed
//      If no  → mark conversation completed
//      If escalate → mark conversation escalated
//   6. Send reply SMS via Dial, log it

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DIAL_BASE_URL = "https://getdial.ai";
const SIGNATURE_MAX_AGE_S = 300;
const MODEL = "claude-haiku-4-5-20251001";

// ---------- Vault ----------

const secretCache = new Map<string, Promise<string>>();
function getSecret(name: string): Promise<string> {
  let p = secretCache.get(name);
  if (!p) {
    p = (sb(`rpc/get_secret`, {
      method: "POST",
      body: JSON.stringify({ secret_name: name }),
    }) as Promise<string>).then((v) => {
      if (!v) throw new Error(`Vault secret missing: ${name}`);
      return String(v);
    });
    p.catch(() => secretCache.delete(name));
    secretCache.set(name, p);
  }
  return p;
}
// Warm at cold start
getSecret("dial_signing_secret").catch(() => {});
getSecret("anthropic_api_key").catch(() => {});
getSecret("dial_api_key").catch(() => {});
getSecret("dial_phone_number_id").catch(() => {});

// ---------- Supabase helpers ----------

// deno-lint-ignore no-explicit-any
async function sb(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ---------- Dial helpers ----------

async function sendSMS(to: string, body: string): Promise<void> {
  const [apiKey, phoneNumberId] = await Promise.all([
    getSecret("dial_api_key"),
    getSecret("dial_phone_number_id"),
  ]);
  const res = await fetch(`${DIAL_BASE_URL}/api/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, body, fromNumberId: phoneNumberId }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Dial sendSMS ${res.status}: ${t}`);
  }
}

// ---------- Signature verification (same as joy-voice) ----------

async function verifySignature(
  header: string | null,
  from: string,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const m = header.match(/t=(\d+),v1=([0-9a-f]+)/);
  if (!m) return false;
  const [, t, sig] = m;
  if (Math.abs(Date.now() / 1000 - Number(t)) > SIGNATURE_MAX_AGE_S) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${t}.${from}`),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

// ---------- Intent detection ----------

function detectIntent(text: string): "yes" | "no" | "escalate" | "unknown" {
  const lower = text.toLowerCase().trim();
  const yesRe = /\b(yes|yeah|yep|sure|please|ok|okay|go ahead|do it|refill|need it|i do)\b/;
  const noRe = /\b(no|nope|don't|dont|not now|i'm good|i have enough|skip|cancel)\b/;
  if (yesRe.test(lower)) return "yes";
  if (noRe.test(lower)) return "no";
  if (lower.includes("?") || lower.split(" ").length > 10) return "escalate";
  return "unknown";
}

// ---------- Claude reply generation ----------

async function generateReply(
  medicationName: string,
  // deno-lint-ignore no-explicit-any
  messageHistory: any[],
  intent: "yes" | "no" | "escalate" | "unknown",
): Promise<string> {
  const apiKey = await getSecret("anthropic_api_key");

  const system =
    `You are Joy, Dr. Miller's friendly SMS assistant at an eye clinic. ` +
    `You contacted this patient because their ${medicationName} may be running low. ` +
    `Keep replies short (under 160 chars when possible). Be warm and professional. ` +
    `Do not give medical advice. If the patient wants a refill, confirm it's been submitted. ` +
    `If they don't want one, thank them. If they asked a question, say Dr. Miller will follow up. ` +
    `Respond with only the SMS text — no quotes, no formatting.`;

  const messages = messageHistory.map(
    // deno-lint-ignore no-explicit-any
    (m: any) => ({
      role: m.direction === "outbound" ? "assistant" : "user",
      content: m.body,
    }),
  );

  // Add intent context so Claude knows the outcome without re-classifying
  let intentHint = "";
  if (intent === "yes") intentHint = " [Patient confirmed they want the refill — acknowledge and close warmly.]";
  else if (intent === "no") intentHint = " [Patient declined the refill — thank them and close warmly.]";
  else if (intent === "escalate") intentHint = " [Patient has a question or concern — tell them Dr. Miller will follow up and close warmly.]";

  if (intentHint && messages.length > 0) {
    const last = messages[messages.length - 1];
    messages[messages.length - 1] = { ...last, content: last.content + intentHint };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 150,
      system,
      messages,
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  // deno-lint-ignore no-explicit-any
  const data = await res.json() as any;
  return (data.content?.[0]?.text ?? "Thank you! We'll be in touch.").trim();
}

// ---------- Main handler ----------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true, service: "joy-sms" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const from: string = payload.from ?? payload.from_number ?? "";
  const body: string = payload.body ?? payload.text ?? payload.message ?? "";

  if (!from || !body) {
    return new Response(JSON.stringify({ error: "Missing from or body" }), { status: 400 });
  }

  // Verify Dial signature (best-effort — log but don't block if secret unavailable)
  try {
    const secret = await getSecret("dial_signing_secret");
    const sig = req.headers.get("x-dial-signature");
    const valid = await verifySignature(sig, from, secret);
    if (!valid) {
      console.warn(`[joy-sms] Invalid signature from ${from}`);
      return new Response("Unauthorized", { status: 401 });
    }
  } catch (e) {
    console.error("[joy-sms] Signature check failed (proceeding):", e);
  }

  try {
    // Find active conversation for this phone number
    const convRows = await sb(
      `sms_conversations?patient_phone=eq.${encodeURIComponent(from)}&status=eq.active&order=created_at.desc&limit=1`,
    );

    if (!convRows || convRows.length === 0) {
      console.log(`[joy-sms] No active conversation for ${from} — ignoring`);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    const conv = convRows[0] as any;

    // Log inbound message
    await sb("sms_messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        conversation_id: conv.id,
        direction: "inbound",
        body,
      }),
    });

    // Fetch conversation history
    const messages = await sb(
      `sms_messages?conversation_id=eq.${conv.id}&order=sent_at.asc`,
    );

    // Fetch the medication being discussed
    const meds = await sb(
      `patient_medications?patient_id=eq.${conv.patient_id}&status=eq.active&limit=1`,
    );
    // deno-lint-ignore no-explicit-any
    const med = (meds as any[])?.[0];
    const medicationName = med?.medication_name ?? "your medication";

    // Classify intent
    const intent = detectIntent(body);

    // Generate Joy's reply
    const replyText = await generateReply(medicationName, messages || [], intent);

    // Act on intent
    if (intent === "yes") {
      await sb("refill_requests", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          patient_id: conv.patient_id,
          medication_id: med?.id ?? null,
          conversation_id: conv.id,
          medication_name: medicationName,
          status: "pending",
          requested_via: "sms",
        }),
      });
      await sb(`sms_conversations?id=eq.${conv.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", updated_at: new Date().toISOString() }),
      });
    } else if (intent === "no") {
      await sb(`sms_conversations?id=eq.${conv.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", updated_at: new Date().toISOString() }),
      });
    } else if (intent === "escalate") {
      await sb(`sms_conversations?id=eq.${conv.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          status: "escalated",
          escalation_reason: `Patient replied: "${body.slice(0, 200)}"`,
          updated_at: new Date().toISOString(),
        }),
      });
    }

    // Send Joy's reply
    await sendSMS(from, replyText);

    // Log outbound reply
    await sb("sms_messages", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        conversation_id: conv.id,
        direction: "outbound",
        body: replyText,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[joy-sms] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
