# Database Skill — Dry Eye Clinical Dashboard

## MCP Server

This project uses the **`dry-eye-supabase-db`** MCP server to interact with the Supabase PostgreSQL database.  
All database operations (queries, migrations, schema inspection, edge functions) go through this MCP.

Key tools:
- `mcp__dry-eye-supabase-db__execute_sql` — run raw SELECT / DML queries
- `mcp__dry-eye-supabase-db__apply_migration` — apply DDL changes (use for schema changes, NOT execute_sql)
- `mcp__dry-eye-supabase-db__list_tables` — inspect tables and columns
- `mcp__dry-eye-supabase-db__get_logs` — fetch service logs (postgres, api, auth, edge-function, etc.)
- `mcp__dry-eye-supabase-db__get_advisors` — check security/performance advisories
- `mcp__dry-eye-supabase-db__generate_typescript_types` — regenerate DB types after schema changes
- `mcp__dry-eye-supabase-db__get_project_url` — get the Supabase API URL

> ⚠️ RLS is currently disabled on all tables. Do not expose the anon key publicly until RLS policies are added.

---

## Schema

### `patients`
Core patient record.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | text | |
| date_of_birth | date | nullable |
| email | text | nullable |
| phone | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

---

### `assessments`
AI-generated dry eye assessments linked to a patient.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | FK → patients.id |
| assessment_date | timestamptz | default now() |
| total_score | integer | |
| severity_level | text | CHECK: Normal / Mild / Moderate / Severe |
| has_screen_intolerance | boolean | default false |
| has_night_driving_issues | boolean | default false |
| has_wind_sensitivity | boolean | default false |
| has_low_humidity_issues | boolean | default false |
| reviewed | boolean | default false |
| created_at | timestamptz | default now() |

---

### `assessment_responses`
Individual question/answer pairs for an assessment.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| assessment_id | uuid | FK → assessments.id |
| question_number | integer | |
| question_text | text | |
| patient_response | integer | CHECK: 0–4 |
| patient_quote | text | nullable — verbatim patient statement |
| reasoning | text | nullable — AI reasoning |
| created_at | timestamptz | default now() |

---

### `clinician_notes`
Free-text notes written by a clinician for a given assessment.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| assessment_id | uuid | FK → assessments.id |
| note_text | text | |
| created_by | text | nullable |
| created_at | timestamptz | default now() |

---

### `patient_surveys`
Patient-facing OSDI-style surveys (12 questions).
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | nullable FK → patients.id |
| patient_name | text | nullable |
| patient_email | text | nullable |
| patient_phone | text | nullable |
| survey_date | timestamptz | default now() |
| status | text | CHECK: pending / scored / archived |
| total_score | integer | nullable |
| severity_level | text | nullable, CHECK: Normal / Mild / Moderate / Severe |
| clinician_notes | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

---

### `survey_responses`
Individual responses to each of the 12 survey questions.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| survey_id | uuid | FK → patient_surveys.id |
| question_number | integer | CHECK: 1–12 |
| frequency | text | CHECK: none / sometimes / half / most / all / not_applicable |
| free_text | text | nullable |
| assigned_score | integer | nullable, CHECK: 0–4 |
| created_at | timestamptz | default now() |

---

### `patient_medications`
Medications associated with a patient, optionally linked to a survey.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | FK → patients.id |
| survey_id | uuid | nullable FK → patient_surveys.id |
| medication_name | text | |
| dosage | text | nullable |
| frequency | text | nullable |
| status | text | CHECK: active / stopped / new |
| start_date | date | nullable |
| stop_date | date | nullable |
| notes | text | nullable |
| created_at / updated_at | timestamptz | default now() |

---

### `assessment_timings`
Tracks processing time for assessments and surveys.
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| assessment_id | uuid | nullable FK → assessments.id |
| survey_id | uuid | nullable FK → patient_surveys.id |
| source_type | text | CHECK: ai / survey |
| processing_time_seconds | integer | default 30 |
| created_at | timestamptz | default now() |

---

### `practice_metrics`
Daily aggregate metrics for the practice (one row per day).
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| metric_date | date | UNIQUE, default CURRENT_DATE |
| patients_seen | integer | default 0 |
| assessments_completed | integer | default 0 |
| surveys_completed | integer | default 0 |
| estimated_time_saved_minutes | integer | default 0 |
| created_at | timestamptz | default now() |

---

### `patient_engagement`
Per-patient engagement tracking (one row per patient).
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | UNIQUE FK → patients.id |
| survey_invites_sent | integer | default 0 |
| surveys_completed | integer | default 0 |
| last_engagement_date | timestamptz | nullable |
| streak_days | integer | default 0 |
| created_at / updated_at | timestamptz | default now() |

---

## Key Relationships

```
patients
  ├── assessments (patient_id)
  │     ├── assessment_responses (assessment_id)
  │     ├── clinician_notes (assessment_id)
  │     └── assessment_timings (assessment_id)
  ├── patient_surveys (patient_id)
  │     ├── survey_responses (survey_id)
  │     ├── patient_medications (survey_id)
  │     └── assessment_timings (survey_id)
  ├── patient_medications (patient_id)
  └── patient_engagement (patient_id)
```
