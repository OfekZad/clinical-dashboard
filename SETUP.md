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

This section documents the current Joy **voice** architecture and its local
operator tooling. It is intentionally scoped to APIs, secrets, CLI setup, and
dependency policy. Do not commit real service keys, Dial auth files, dashboard
env files, or Supabase Vault secret values.

## Repository inspection notes

- This dashboard checkout does **not** currently include a `joy-voice` Edge
  Function source file (`supabase/functions/joy-voice`, `Deno.serve`, and
  `Deno.upgradeWebSocket` were not found in the repo).
- Because the `joy-voice` function source is not present here, no npm runtime
  imports were added for the voice brain.
- The production `joy-voice` function should remain Deno-native. Do not convert
  it to a Node server and do not add Node runtime packages unless a real repo
  file imports them.

## Production architecture

- Dial / getdial.ai handles telephony, STT, TTS, turn-taking, call events,
  transcripts, and self-hosted WebSocket routing.
- Supabase Edge Function `joy-voice` is the voice brain.
- `joy-voice` is Deno code and uses native `fetch` for the Anthropic Messages
  API and Supabase REST API.
- Secrets are loaded from Supabase Vault through the `public.get_secret()` RPC.
- The scheduled task places exactly one call per run using Dial CLI.
- The scheduled task creates or reuses an `in_progress` assessment before
  dialing.
- The voice scorer writes answers in real time to `assessment_responses`.
- Final score/severity is computed by the database trigger when
  `assessments.severity_level` is set to `completed`.
- The old `joy-bridge` MCP path is currently inert while self-hosted mode is on.

## Required CLI

Install Dial CLI globally:

```bash
pnpm add -g @getdial/cli
```

If pnpm global bin is not on `PATH`, run:

```bash
pnpm setup
```

Or use npm, matching the current scheduled-task runner:

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

## Dial CLI commands used by the scheduled task

```bash
dial doctor --json
dial call --to ... --language en-US --idempotency-key ... --outbound-instruction ... --json
dial wait-for call.ended -f callId=<id> -t 40 --json
dial wait-for call.transcribed -f callId=<id> -t 40 --json
dial call get <id> --json
```

The root `package.json` includes convenience wrappers for the commands that do
not require a call id:

```bash
pnpm dial:doctor
pnpm dial:wait-ended
pnpm dial:wait-transcribed
```

## Dial self-hosted WebSocket protocol

Dial connects to:

```text
wss://huodjyassgsrxpvaxkaa.supabase.co/functions/v1/joy-voice/<call_id>
```

Dial authenticates with:

```text
X-Dial-Signature
```

The signature is an HMAC-SHA256 over:

```text
<timestamp>.<call_id>
```

The signing secret is stored in Supabase Vault as:

```text
dial_signing_secret
```

## Supabase Edge Function env

The `joy-voice` function needs these Edge Function runtime variables:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Set them in the Supabase Edge Function runtime environment. Do not commit real
values to git.

## Supabase Vault secrets

Store these in Supabase Vault, not in `.env` files committed to the repo:

```text
anthropic_api_key
dial_signing_secret
```

The function reads them through:

```text
public.get_secret(secret_name text)
```

## Anthropic Messages API

`joy-voice` calls the Anthropic Messages API directly with Deno `fetch`:

```text
https://api.anthropic.com/v1/messages
```

The current live voice model is:

```text
claude-sonnet-4-6
```

with:

```text
output_config.effort = low
```

Streaming is enabled. Do not change the model or latency configuration unless
intentionally updating voice behavior.

## Supabase REST API

`joy-voice` uses the Supabase REST API directly with Deno `fetch`:

```text
${SUPABASE_URL}/rest/v1/...
```

Tables touched by `joy-voice`:

- `assessments`
- `assessment_responses`
- `patient_medications`

The function uses `SUPABASE_SERVICE_ROLE_KEY` inside the Edge Function runtime.

## Supabase DB / MCP for scheduled task

The scheduled task uses MCP server:

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
- marking assessment completed
- writing the `calls` row

## Optional dashboard submission

Only load the optional dashboard env file if it exists:

```bash
$HOME/mnt/Agent Check in/dial/dashboard.env
```

Expected variable:

```bash
DASHBOARD_BASE_URL
```

Optional endpoint:

```text
$DASHBOARD_BASE_URL/api/assessment/submit
```

If the env file is missing, skip dashboard submission silently.

## Runtime dependency warning

`joy-voice` is a Supabase Edge Function running on Deno. It uses native
Deno/browser APIs:

- `Deno.serve`
- `Deno.upgradeWebSocket`
- `fetch`
- Web Crypto `crypto.subtle`
- `TextEncoder`
- `TextDecoder`
- `AbortController`

Do **not** add Node runtime packages for `joy-voice` unless the function is
intentionally rewritten to use them. Avoid these unless a real repo file imports
them:

- `ws`
- `node-fetch`
- `crypto`
- `dotenv`
- `@anthropic-ai/sdk`
- `@supabase/supabase-js`

Note: this dashboard app uses `@supabase/ssr` for the Next.js UI and server
routes. That does not imply the Deno `joy-voice` function should use the
Supabase JS SDK.

## Formatting

A formatting script is provided for local tooling:

```bash
pnpm format
```

It expects Prettier to be available in the development environment. If your npm
registry access allows installing dev-only tooling, add it with:

```bash
pnpm add -D prettier
```
