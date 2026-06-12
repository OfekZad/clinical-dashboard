# Production Setup — Dry Eye Clinical Dashboard

This document describes how the dry-eye OSDI dashboard is wired to its Supabase
backend and how to provision a fresh database from scratch.

## Supabase project

- **Project ref:** `huodjyassgsrxpvaxkaa`
- **API URL:** `https://huodjyassgsrxpvaxkaa.supabase.co`

## Required environment variables

The app (browser + server, via `@supabase/ssr`) reads two variables. Set them
in your deployment platform (e.g. Vercel project settings) and in a local
`.env.local` for development:

```
NEXT_PUBLIC_SUPABASE_URL=https://huodjyassgsrxpvaxkaa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase → Project Settings → API>
```

If both are absent the app falls back to in-memory seed data
(`lib/seed-data.ts`) instead of crashing — see `isSupabaseConfigured()` in
`lib/supabase/server.ts`.

## Provisioning a fresh database

Run the SQL scripts in `scripts/` in order against the target project (Supabase
SQL Editor or `psql`). For a clean restore of the production schema **and** data,
the consolidated script is enough:

1. `scripts/07-restore-clinical-data.sql` — creates all 10 tables, indexes, and
   restores the clinical data. Idempotent (`CREATE TABLE IF NOT EXISTS` +
   `ON CONFLICT (id) DO NOTHING`), safe to re-run.
2. `scripts/08-add-fk-indexes.sql` — adds covering indexes for foreign keys
   flagged by the performance advisor.
3. `scripts/09-add-joy-refill-assistant.sql` — adds Joy SMS refill workflow
   medication identity fields, conversations, refill requests, staff tasks, and
   audit logs.

Scripts `01`–`06` document the incremental schema history; `07` supersedes them
for a fresh setup.

## Schema overview

| Table | Purpose |
|---|---|
| `patients` | Patient records (single `name`, optional DOB/contact) |
| `assessments` | AI/voice-agent OSDI assessments + symptom flags |
| `assessment_responses` | Per-question detail for each assessment (0–4) |
| `clinician_notes` | Free-text notes attached to an assessment |
| `patient_surveys` | Self-reported surveys, scored later by the clinician |
| `survey_responses` | Per-question frequency answers for a survey |
| `patient_medications` | Medication tracking per patient/survey |
| `assessment_timings` | Time-saved metrics (AI vs. survey) |
| `practice_metrics` | Daily practice ROI roll-ups |
| `patient_engagement` | Per-patient engagement / streak tracking |
| `joy_refill_conversations` | Joy SMS refill conversation state |
| `joy_sms_messages` | Inbound/outbound SMS conversation history |
| `joy_refill_requests` | Refill requests created or tracked by Joy |
| `joy_staff_tasks` | Human follow-up tasks for escalation |
| `joy_audit_logs` | Compliance audit trail for Joy database actions |


## Joy SMS refill assistant

Joy starts refill outreach with `POST /api/joy/refill/trigger` using
`patientId`, `patientMedicationId`, and optional `smsTo`. Joy will only send
the initial SMS when the medication's editable remaining number is **7 or
fewer**. Clinic users can edit that number from the patient medication card;
updates are saved to `remaining_quantity`, refresh `low_medication_flag`, and
write a Joy audit log entry. Incoming SMS replies are processed by
`POST /api/joy/sms` using `conversationId`, `body`, and optional
`externalMessageId`.

Set `JOY_SMS_WEBHOOK_URL` to connect a generic approved SMS provider. Joy posts
`{ to, body, from }` to that webhook and stores the returned `messageId` when
available. Set `JOY_SMS_FROM_NUMBER` when the SMS provider requires a sender
number.

For Vapi SMS delivery, set `JOY_SMS_PROVIDER=vapi`, `VAPI_API_KEY`,
`VAPI_PHONE_NUMBER_ID`, and `VAPI_ASSISTANT_ID`. Joy uses Vapi's Chat API SMS
transport with `useLLMGeneratedMessageForOutbound: false` so the refill text is
sent directly instead of rewritten by an LLM. Do not commit live API keys to the
repository. If neither a webhook nor Vapi is configured, the app records the
outbound message and logs delivery details to the server console only.

Joy does not make clinical decisions. Clinical questions, side effects,
medication confusion, pharmacy changes, ineligible medications, missing
pharmacy data, and patient requests for staff create `joy_staff_tasks` and mark
the conversation escalated.

## Retell voice-agent integration

The Retell AI agent submits assessments to `POST /api/assessment/submit`. See
`RETELL_API_DOCUMENTATION.md` for the payload contract.

## Security posture

> **Note:** Row Level Security (RLS) is intentionally **disabled** on all
> `public` tables to match the original project — the app reads and writes with
> the Supabase **anon** key. Because RLS is off, anyone holding the anon key
> (which ships to the browser) can read and write all patient data. Supabase's
> security advisor will flag every table for this reason.
>
> This is acceptable for a single-clinic internal tool but is **not** suitable
> if the dashboard is exposed publicly. To harden it, enable RLS and add an
> authentication layer (Supabase Auth) with policies scoped to authenticated
> clinicians.
