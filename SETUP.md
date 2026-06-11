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
3. `scripts/09-add-call-attempts.sql` — adds the `call_attempts` table used by
   the outbound voice agent ("Joy") as its durable per-patient call log.

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
| `call_attempts` | Outbound voice-agent call log: one row per call with status, transcript, summary, carry-forward items, and medication adherence |

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
