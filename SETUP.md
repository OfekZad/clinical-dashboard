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

---

# Joy Voice System setup

This section documents the current Joy Voice System integration points and local
operator setup. Joy's production voice path is Deno-native: Dial handles
telephony/STT/TTS/turn-taking/call events/transcripts and routes calls to the
Supabase Edge Function `joy-voice`, which acts as the voice brain.

## Repository inspection result

This dashboard checkout does **not** currently contain a `joy-voice` Edge
Function source file (for example, `supabase/functions/joy-voice/index.ts`). A
repo search for `joy-voice`, `Deno.serve`, `Deno.upgradeWebSocket`, Anthropic
model references, and Vault secret names did not find an Edge Function in this
working tree. Because there is no `joy-voice` file here, no npm runtime imports
were added for it.

If the Edge Function source is added to this repo later, keep it Deno-native and
avoid Node runtime packages unless a real import in that file requires them.

## Required CLI

Install the Dial CLI globally:

```bash
pnpm add -g @getdial/cli
```

If pnpm's global bin directory is not on `PATH`, run:

```bash
pnpm setup
```

Or use npm, matching the current scheduled-task runner behavior:

```bash
npm config set prefix "$HOME/.npm-global"
npm install -g @getdial/cli
export PATH="$HOME/.npm-global/bin:$PATH"
```

Check Dial auth:

```bash
dial doctor --json
```

The scheduled task expects the Dial auth backup at:

```bash
$HOME/mnt/Agent Check in/dial/auth.v1.json
```

and copies it to:

```bash
~/.local/share/dial/auth.v1.json
```

Do not commit either auth file.

## Dial CLI commands used by the scheduled task

The scheduled task places exactly one call per run. It creates or reuses an
`in_progress` assessment before dialing, then uses Dial CLI commands in this
shape:

```bash
dial doctor --json
dial call --to ... --language en-US --idempotency-key ... --outbound-instruction ... --json
dial wait-for call.ended -f callId=<id> -t 40 --json
dial wait-for call.transcribed -f callId=<id> -t 40 --json
dial call get <id> --json
```

Convenience package scripts are available for local checks:

```bash
pnpm dial:doctor
pnpm dial:wait-ended -- -f callId=<id>
pnpm dial:wait-transcribed -- -f callId=<id>
```

## Dial self-hosted WebSocket protocol

Dial connects to the Edge Function over WebSocket:

```text
wss://huodjyassgsrxpvaxkaa.supabase.co/functions/v1/joy-voice/<call_id>
```

Dial authenticates with:

```text
X-Dial-Signature
```

The signature is HMAC-SHA256 over:

```text
<timestamp>.<call_id>
```

The HMAC secret is stored in Supabase Vault as:

```text
dial_signing_secret
```

## Supabase Edge Function runtime

The `joy-voice` function needs these runtime environment variables:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` must only be available inside trusted server/Edge
Function runtime. Never expose it to browser code and never commit it.

The function runtime is Deno and should use native APIs:

- `Deno.serve`
- `Deno.upgradeWebSocket`
- native `fetch`
- native Web Crypto `crypto.subtle`
- native `TextEncoder`
- native `TextDecoder`
- native `AbortController`

## Supabase Vault secrets

Store these in Supabase Vault, not in `.env`, source files, package scripts, or
git history:

```text
anthropic_api_key
dial_signing_secret
```

The function reads them through the Vault RPC:

```text
public.get_secret(secret_name text)
```

via:

```text
rpc/get_secret
```

## Anthropic Messages API

`joy-voice` calls the Anthropic Messages API directly with Deno/native `fetch`:

```text
https://api.anthropic.com/v1/messages
```

Current live model/config:

```text
model = claude-sonnet-4-6
output_config.effort = low
streaming = enabled
```

Do not change this unless intentionally updating voice latency/model behavior.
The API key secret name is:

```text
anthropic_api_key
```

## Supabase REST API and tables

`joy-voice` uses Supabase REST directly with native `fetch`:

```text
${SUPABASE_URL}/rest/v1/...
```

Tables touched by `joy-voice`:

- `assessments`
- `assessment_responses`
- `patient_medications`

The voice scorer writes answers in real time to `assessment_responses`. Final
score/severity is computed by the database trigger when
`assessments.severity_level` is set to `completed`.

## Supabase DB / MCP for the scheduled task

The scheduled task uses the MCP server:

```text
dry-eye-supabase-db
```

Main tool:

```text
mcp__dry-eye-supabase-db__execute_sql
```

It is used for:

- assessment setup
- reading previous responses
- reading medications
- reading call history
- reconciliation after transcript
- marking assessments completed
- writing a `calls` row

## Optional dashboard submission

If this file exists:

```bash
$HOME/mnt/Agent Check in/dial/dashboard.env
```

then the scheduled task may read:

```bash
DASHBOARD_BASE_URL
```

and submit to:

```text
$DASHBOARD_BASE_URL/api/assessment/submit
```

If the env file is missing, skip dashboard submission silently.

## Runtime dependency warning

`joy-voice` is a Supabase Edge Function running on Deno. Do **not** convert it
to Node and do **not** add Node runtime packages unless a real repo file imports
them for an intentional rewrite.

Do not add these packages for `joy-voice` as currently designed:

- `ws`
- `node-fetch`
- `crypto`
- `dotenv`
- `@anthropic-ai/sdk`
- `@supabase/supabase-js`

This dashboard app already uses `@supabase/supabase-js`/`@supabase/ssr` for its
Next.js code, but the Deno Edge Function should continue using REST/fetch.

## Local tooling dependencies

The root `package.json` is for this Next.js dashboard plus local operator
scripts. No new runtime package is required for `joy-voice` in this checkout.

Formatting can be run with:

```bash
pnpm format
```

If Prettier is not installed in the local environment, add it as a dev-only tool
before formatting:

```bash
pnpm add -D prettier
```
