# Joy Calls — Future Enhancements

This document outlines the planned evolution of the `joy_calls` system beyond the initial demo/ MVP.

## Current State

- A `joy_calls` table exists in Supabase with columns: `id`, `caller_name`, `caller_phone`, `status`, `started_at`, `ended_at`, `created_at`, `updated_at`
- The frontend (`JoyIndicator`) polls `GET /api/joy/call-status` every 1 second
- The endpoint queries the `joy_calls` table for any row where `status = 'in_progress'`
- Currently a **demo cycle** is hardcoded in the API route: 1 minute `in_progress` → 1 minute `idle` → repeat (via actual DB writes)

---

## 1. Replace Demo Cycle With Real Data

### Goal
Remove the hardcoded demo cycle and have Joy reflect actual incoming calls from the telephony system (e.g., Retell AI or Twilio).

### Approach
- The telephony system (Retell AI webhook / Twilio callback) should **create** rows in `joy_calls` when a call arrives:
  ```sql
  INSERT INTO joy_calls (caller_name, caller_phone, status)
  VALUES ('Actual Patient', '+1-555-0123', 'in_progress');
  ```
- A Retell AI webhook endpoint (`POST /api/joy/retell-webhook`) should be created to receive call events and write to the table
- When the call ends, update the row:
  ```sql  UPDATE joy_calls
  SET status = 'completed', ended_at = now(), updated_at = now()
  WHERE id = '...';
  ```
- Remove the demo-timing module-level variables and `setTimeout` calls from `route.ts`

---

## 2. Escalating Status

### Goal
The `escalating` status exists in both the DB CHECK constraint and the frontend `JoyState` type, but is not yet wired to anything.

### When to use
- A call has been flagged (e.g., patient expresses suicidal ideation, severe pain, or the AI confidence drops below a threshold)
- A clinician needs to be notified / take over

### Frontend wiring
In `joy-indicator.tsx`, add a third branch to the poll handler:
```ts
if (data.status === "escalating") {
  setState("escalating")  // shows 🚨 "Escalating" with red styling
}
```

### Backend trigger
Either:
- The Retell AI webhook sends an `escalation` event that updates the row's status
- Or a separate escalation-detection job scans for flagged calls and sets the status

---

## 3. Stats / Metrics

### Goal
Replace the hardcoded mock stats (generated via `generateMockStats()`) with real aggregated data from the `joy_calls` table.

### Example queries

```sql
-- Calls today
SELECT COUNT(*) AS calls_today
FROM joy_calls
WHERE started_at >= CURRENT_DATE;

-- Escalations today
SELECT COUNT(*) AS escalations_today
FROM joy_calls
WHERE status = 'escalating' AND started_at >= CURRENT_DATE;

-- Total call time today
SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60), 0)::int AS total_minutes
FROM joy_calls
WHERE ended_at IS NOT NULL AND started_at >= CURRENT_DATE;
```

### New API endpoint
`GET /api/joy/stats` — returns `JoyStats` (callsToday, osdiReportsToday, escalationsToday, totalCallTimeMinutes)

The `JoyStatsDialog` component already accepts a `JoyStats` prop — just pass real data instead of mock data.

---

## 4. Realtime Updates (WebSocket)

### Goal
Replace the 1-second polling with a push-based model for instant status changes.

### Approach
- Use Supabase Realtime (websockets) via `supabase.channel('joy-calls')`
- Subscribe to INSERT/UPDATE events on the `joy_calls` table
- When an event arrives, update the Joy state immediately without polling
- Fall back to 1-second polling if Realtime disconnects

---

## 5. Table Indexing & Performance

### Current indexes (already created)
- `idx_joy_calls_status` on `status`
- `idx_joy_calls_started_at` on `started_at DESC`

### Future indexes (when data grows)
```sql
-- For dashboard stats (today's calls)
CREATE INDEX idx_joy_calls_date_status ON joy_calls((started_at::date), status);

-- For looking up active calls by phone number (de-duping)
CREATE INDEX idx_joy_calls_caller_phone ON joy_calls(caller_phone);
```

---

## 6. Row Cleanup

### Goal
Prevent unbounded growth of the `joy_calls` table.

### Approach
- Add a Postgres `pg_cron` job or a daily Edge Function to delete rows older than 90 days
- Or add a `cleanup` endpoint that can be called periodically
