# Joy Voice System setup

This document records the required APIs, secrets, CLI tools, and local tooling for the current Joy Voice System architecture.

## Repository inspection notes

- The `joy-voice` Supabase Edge Function source is not present in this dashboard checkout. No `supabase/functions/joy-voice`, `Deno.serve`, `Deno.upgradeWebSocket`, `deno.json`, or `deno.lock` file was found here during inspection.
- Because no `joy-voice` Deno source file is present in this checkout, no npm imports were found for that function and no Node runtime packages were added for it.
- The dashboard app already imports `@supabase/supabase-js` through `lib/supabase/client.ts` and `lib/supabase/server.ts`; that dependency is for the Next.js dashboard, not for the Deno Edge Function runtime.

## Production architecture

- Dial / getdial.ai handles telephony, STT, TTS, turn-taking, call events, transcripts, and self-hosted WebSocket routing.
- Supabase Edge Function `joy-voice` is the voice brain.
- `joy-voice` is Deno code, not Node server code.
- `joy-voice` uses Anthropic Messages API directly with native `fetch`.
- `joy-voice` uses Supabase REST API directly with native `fetch`.
- Secrets are loaded from Supabase Vault through the `public.get_secret(secret_name text)` RPC.
- The scheduled task places exactly one call per run using Dial CLI.
- The scheduled task creates or reuses an `in_progress` assessment before dialing.
- The voice scorer writes answers in real time to `assessment_responses`.
- Final score/severity is computed by the DB trigger when `assessments.severity_level` is set to `completed`.
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

Do not commit Dial auth files.

## Dial CLI commands used by scheduled task

```bash
dial doctor --json
dial call --to ... --language en-US --idempotency-key ... --outbound-instruction ... --json
dial wait-for call.ended -f callId=<id> -t 40 --json
dial wait-for call.transcribed -f callId=<id> -t 40 --json
dial call get <id> --json
```

Convenience package scripts in this repo:

```bash
pnpm dial:doctor
pnpm dial:call -- --to <phone> --idempotency-key <key> --outbound-instruction <text>
pnpm dial:call:get -- <id>
pnpm dial:wait-ended -- -f callId=<id>
pnpm dial:wait-transcribed -- -f callId=<id>
```

## Dial self-hosted WebSocket protocol

Dial connects to:

```text
wss://huodjyassgsrxpvaxkaa.supabase.co/functions/v1/joy-voice/<call_id>
```

Authentication:

- Header: `X-Dial-Signature`
- Signature: HMAC-SHA256 over `<timestamp>.<call_id>`
- Vault secret name: `dial_signing_secret`

## Supabase Edge Function env

The `joy-voice` function needs these runtime variables:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## Supabase Vault secrets

Store these in Supabase Vault, not in git or local committed env files:

```text
anthropic_api_key
dial_signing_secret
```

The function reads them through:

```text
public.get_secret(secret_name text)
```

## Anthropic Messages API

Endpoint:

```text
https://api.anthropic.com/v1/messages
```

Current live voice model:

```text
claude-sonnet-4-6
```

Current model config:

```text
output_config.effort = low
streaming = enabled
```

Do not change this unless intentionally updating voice latency/model behavior.

## Supabase REST API

The Deno Edge Function uses native `fetch` against:

```text
${SUPABASE_URL}/rest/v1/...
```

Tables touched by `joy-voice`:

- `assessments`
- `assessment_responses`
- `patient_medications`

Use `SUPABASE_SERVICE_ROLE_KEY` inside the Edge Function runtime.

## Supabase DB / MCP for scheduled task

MCP server:

```text
dry-eye-supabase-db
```

Main tool:

```text
mcp__dry-eye-supabase-db__execute_sql
```

Scheduled-task DB responsibilities:

- assessment setup
- reading previous responses
- reading meds
- reading call history
- reconciliation after transcript
- marking assessment completed
- writing `calls` row

## Optional dashboard submission

Only use the dashboard submission path when this file exists:

```bash
$HOME/mnt/Agent Check in/dial/dashboard.env
```

Expected variable:

```bash
DASHBOARD_BASE_URL=
```

Endpoint:

```text
$DASHBOARD_BASE_URL/api/assessment/submit
```

If the env file is missing, skip dashboard submission silently.

## Deno runtime dependency warning

`joy-voice` is a Supabase Edge Function running on Deno.

It should use native Deno/browser APIs:

- `Deno.serve`
- `Deno.upgradeWebSocket`
- `fetch`
- `crypto.subtle`
- `TextEncoder`
- `TextDecoder`
- `AbortController`

Do not add Node runtime packages for `joy-voice` unless a real repo file intentionally imports them. In particular, do not add:

- `ws`
- `node-fetch`
- `crypto`
- `dotenv`
- `@anthropic-ai/sdk`
- `@supabase/supabase-js`

## Local tooling dependencies

This checkout keeps runtime dependencies scoped to files that actually import them. The Dial CLI is a global tool and is not added as an application runtime dependency.

Local package scripts added for operator convenience:

- `dial:doctor`
- `dial:call`
- `dial:call:get`
- `dial:wait-ended`
- `dial:wait-transcribed`
- `format`

The `format` script uses `pnpm dlx prettier@^3.0.0 --write .` so Prettier is a dev-time formatter, not a shipped runtime dependency.

## Secret handling checklist

- Commit `.env.example` placeholders only.
- Do not commit `.env`, `.env.local`, `*.env`, `dashboard.env`, `auth.v1.json`, service-role keys, Vault secret values, or Dial auth JSON.
- Rotate any live key that was pasted into chat or logs.
