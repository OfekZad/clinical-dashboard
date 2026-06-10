-- Clinical-dashboard data restore (clinical tables only)
--
-- Generated from the project backup (db_cluster dump), limited to the
-- clinical-dashboard tables. Excludes Supabase-managed roles/schemas and the
-- unrelated trading-bot tables (arbitrage_events, trade_logs, worker_status,
-- system_config).
--
-- Idempotent: tables use CREATE TABLE IF NOT EXISTS and rows use
-- ON CONFLICT (id) DO NOTHING, so it is safe to run more than once.
-- Run it in the target project's Supabase SQL Editor (or via psql).
--
-- NOTE: RLS is left disabled to match the original project (the app reads/writes
-- with the anon key). Supabase will flag this in advisors; add RLS policies if
-- you want row-level protection.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_of_birth DATE,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  assessment_date TIMESTAMPTZ DEFAULT now(),
  total_score INTEGER NOT NULL,
  severity_level TEXT NOT NULL CHECK (severity_level IN ('Normal', 'Mild', 'Moderate', 'Severe')),
  has_screen_intolerance BOOLEAN DEFAULT false,
  has_night_driving_issues BOOLEAN DEFAULT false,
  has_wind_sensitivity BOOLEAN DEFAULT false,
  has_low_humidity_issues BOOLEAN DEFAULT false,
  reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  patient_response INTEGER NOT NULL CHECK (patient_response BETWEEN 0 AND 4),
  patient_quote TEXT,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clinician_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  patient_email TEXT,
  patient_phone TEXT,
  survey_date TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scored', 'archived')),
  total_score INTEGER,
  severity_level TEXT CHECK (severity_level IN ('Normal', 'Mild', 'Moderate', 'Severe')),
  clinician_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.patient_surveys(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL CHECK (question_number BETWEEN 1 AND 12),
  frequency TEXT NOT NULL CHECK (frequency IN ('none', 'sometimes', 'half', 'most', 'all', 'not_applicable')),
  free_text TEXT,
  assigned_score INTEGER CHECK (assigned_score BETWEEN 0 AND 4),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  survey_id UUID REFERENCES public.patient_surveys(id) ON DELETE SET NULL,
  medication_name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'stopped', 'new')),
  start_date DATE,
  stop_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_timings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
  survey_id UUID REFERENCES public.patient_surveys(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('ai', 'survey')),
  processing_time_seconds INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.practice_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  patients_seen INTEGER DEFAULT 0,
  assessments_completed INTEGER DEFAULT 0,
  surveys_completed INTEGER DEFAULT 0,
  estimated_time_saved_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (metric_date)
);

CREATE TABLE IF NOT EXISTS public.patient_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  survey_invites_sent INTEGER DEFAULT 0,
  surveys_completed INTEGER DEFAULT 0,
  last_engagement_date TIMESTAMPTZ,
  streak_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (patient_id)
);

CREATE INDEX IF NOT EXISTS idx_assessments_patient_id ON public.assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment_id ON public.assessment_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_clinician_notes_assessment_id ON public.clinician_notes(assessment_id);
CREATE INDEX IF NOT EXISTS idx_patient_surveys_status ON public.patient_surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON public.survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id ON public.patient_medications(patient_id);

-- ---------------------------------------------------------------------------
-- Data (from backup)
-- ---------------------------------------------------------------------------

-- patients: 6 rows
INSERT INTO public.patients (id, date_of_birth, email, phone, created_at, updated_at, name) VALUES
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', '1978-05-15', 'sarah.j@email.com', '555-0101', '2025-12-25 17:14:20.342751+00', '2025-12-25 17:14:20.342751+00', 'Sarah Johnson'),
  ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', '1965-09-22', 'mchen@email.com', '555-0102', '2025-12-25 17:14:20.342751+00', '2025-12-25 17:14:20.342751+00', 'Michael Chen'),
  ('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', '1982-12-08', 'emily.r@email.com', '555-0103', '2025-12-25 17:14:20.342751+00', '2025-12-25 17:14:20.342751+00', 'Emily Rodriguez'),
  ('d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', '1955-03-30', 'rwilliams@email.com', '555-0104', '2025-12-25 17:14:20.342751+00', '2025-12-25 17:14:20.342751+00', 'Robert Williams'),
  ('e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '1990-07-19', 'jtaylor@email.com', '555-0105', '2025-12-25 17:14:20.342751+00', '2025-12-25 17:14:20.342751+00', 'Jennifer Taylor'),
  ('3b4d796f-e3c4-4651-b2fb-8d07c414610c', NULL, NULL, NULL, '2025-12-25 18:06:39.037786+00', '2025-12-25 18:06:39.037786+00', 'Ofek')
ON CONFLICT (id) DO NOTHING;

-- patient_surveys: 5 rows
INSERT INTO public.patient_surveys (id, patient_id, patient_name, patient_email, patient_phone, survey_date, status, total_score, severity_level, clinician_notes, created_at, updated_at) VALUES
  ('e10ee576-830c-4565-afba-32d8ed422ad6', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', 'Ofek', NULL, NULL, '2026-01-02 06:39:01.793492+00', 'scored', '44', 'Severe', NULL, '2026-01-02 06:39:01.793492+00', '2026-01-02 06:42:52.1+00'),
  ('242acb65-b98e-4359-840d-11c62e4ee5b0', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', 'Ofek', NULL, NULL, '2026-01-02 06:35:01.546163+00', 'scored', '0', 'Normal', NULL, '2026-01-02 06:35:01.546163+00', '2026-01-02 06:43:00.486+00'),
  ('8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', 'Ofek', NULL, NULL, '2026-01-02 06:47:40.570349+00', 'scored', '52', 'Severe', NULL, '2026-01-02 06:47:40.570349+00', '2026-01-02 06:47:40.570349+00'),
  ('5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', 'Ofek', NULL, NULL, '2026-01-02 08:15:40.081458+00', 'scored', '40', 'Severe', NULL, '2026-01-02 08:15:40.081458+00', '2026-01-02 08:15:40.081458+00'),
  ('13adb3e3-62fe-456b-88f5-0caaa9e449b4', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', 'Ofek', NULL, NULL, '2026-01-02 09:28:27.185728+00', 'scored', '53', 'Severe', NULL, '2026-01-02 09:28:27.185728+00', '2026-01-02 09:28:27.185728+00')
ON CONFLICT (id) DO NOTHING;

-- assessments: 11 rows
INSERT INTO public.assessments (id, patient_id, assessment_date, total_score, severity_level, has_screen_intolerance, has_night_driving_issues, has_wind_sensitivity, has_low_humidity_issues, reviewed, created_at) VALUES
  ('a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', '2025-11-23 17:14:20.342751+00', '54', 'Moderate', 't', 'f', 'f', 't', 't', '2025-12-25 17:14:20.342751+00'),
  ('c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f', 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', '2025-12-20 17:14:20.342751+00', '18', 'Mild', 'f', 'f', 'f', 'f', 't', '2025-12-25 17:14:20.342751+00'),
  ('e1f2a3b4-c5d6-4e5f-8a9b-0c1d2e3f4a5b', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', '2025-12-22 17:14:20.342751+00', '8', 'Normal', 'f', 'f', 'f', 'f', 't', '2025-12-25 17:14:20.342751+00'),
  ('b8c9d0e1-f2a3-4b5c-5d6e-7f8a9b0c1d2e', 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', '2025-12-24 17:14:20.342751+00', '35', 'Moderate', 'f', 't', 't', 'f', 't', '2025-12-25 17:14:20.342751+00'),
  ('d0e1f2a3-b4c5-4d5e-7f8a-9b0c1d2e3f4a', 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', '2025-12-25 16:14:20.342751+00', '82', 'Severe', 't', 't', 't', 't', 't', '2025-12-25 17:14:20.342751+00'),
  ('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', '2025-12-23 17:14:20.342751+00', '68', 'Severe', 't', 't', 'f', 't', 't', '2025-12-25 17:14:20.342751+00'),
  ('5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', '2025-12-25 18:06:39.075+00', '27', 'Moderate', 'f', 'f', 't', 'f', 't', '2025-12-25 18:06:39.119377+00'),
  ('cf11bb6b-8c12-4352-afee-887407fceced', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', '2025-12-25 18:18:19.472+00', '25', 'Moderate', 'f', 'f', 'f', 'f', 'f', '2025-12-25 18:18:19.534704+00'),
  ('a83d8390-dac5-480e-ad7f-0b71ff849ac5', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', '2025-12-27 20:30:28.287+00', '35', 'Severe', 'f', 't', 't', 'f', 't', '2025-12-27 20:30:28.366085+00'),
  ('2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', '2026-01-01 16:18:51.754+00', '2', 'Normal', 'f', 'f', 'f', 'f', 'f', '2026-01-01 16:18:51.826147+00'),
  ('0015ded8-d0fa-44ba-8405-f35f164937a6', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', '2026-01-03 19:21:34.24+00', '23', 'Moderate', 'f', 'f', 't', 'f', 'f', '2026-01-03 19:21:34.32588+00')
ON CONFLICT (id) DO NOTHING;

-- assessment_responses: 70 rows
INSERT INTO public.assessment_responses (id, assessment_id, question_number, question_text, patient_response, patient_quote, reasoning, created_at) VALUES
  ('60c1451b-0ebc-4741-a835-76b57583af75', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '1', 'Eyes sensitive to light?', '4', 'I can barely look at my computer screen without pain', 'Patient reports severe photophobia affecting daily work', '2025-12-25 17:14:20.342751+00'),
  ('9e88f38e-d9ef-4406-b0fc-60d34a3df9af', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '2', 'Eyes feel gritty?', '3', 'It feels like sand in my eyes all the time', 'Persistent foreign body sensation indicates significant dry eye', '2025-12-25 17:14:20.342751+00'),
  ('89be9d45-d0ec-438e-8ccc-bcf01a034d6b', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '3', 'Painful or sore eyes?', '4', 'The burning pain is constant throughout the day', 'Severe ocular pain requiring intervention', '2025-12-25 17:14:20.342751+00'),
  ('c78950ee-4102-4aee-a135-6dd4a204c5e4', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '4', 'Blurred vision?', '3', 'Vision clears after blinking but gets blurry quickly', 'Tear film instability affecting visual acuity', '2025-12-25 17:14:20.342751+00'),
  ('d033fca3-d464-4245-9b91-620860f7b3ef', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '5', 'Poor vision?', '2', 'Only when working on computer for extended periods', 'Screen time exacerbates symptoms', '2025-12-25 17:14:20.342751+00'),
  ('039216ba-8332-4a02-8877-048ad735cce0', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '1', 'Eyes sensitive to light?', '0', 'its ok', 'Patient indicated light doesn''t bother them; light is comfortable and not a concern.', '2025-12-25 18:06:39.177037+00'),
  ('f32acc84-a323-4df6-9110-5eaf9bb8c315', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '2', 'Eyes feel gritty?', '3', 'very bad daily', 'Patient reports scratchy/sandy feeling occurs daily, indicating most days are affected with significant discomfort.', '2025-12-25 18:06:39.177037+00'),
  ('52cb2627-1220-4810-bca8-d7e292294ad8', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '3', 'Painful or sore eyes?', '3', 'daily', 'Patient experiences eye pain or soreness on a daily basis, indicating consistent real soreness most days.', '2025-12-25 18:06:39.177037+00'),
  ('25b90735-3b40-4b37-8d95-d0d552e8838f', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '4', 'Blurred vision?', '4', 'all the time', 'Patient reports blurred vision occurs all the time, indicating vision is almost always blurred.', '2025-12-25 18:06:39.177037+00'),
  ('1932e2e6-fd44-414e-b2ad-067d5b7e86b8', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '5', 'Poor vision?', '0', 'no its ok', 'Patient indicates vision feels normal/okay at baseline, not worse than usual despite other symptoms.', '2025-12-25 18:06:39.177037+00'),
  ('dbd2260a-fd31-458f-9278-6c7c4a1fc9c7', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '6', 'Reading?', '0', 'they are ok', 'Reading does not cause additional discomfort; eyes are comfortable during reading activities.', '2025-12-25 18:06:39.177037+00'),
  ('52b68e4d-9572-4c99-8a87-3c28f2cbde01', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '7', 'Driving at night?', '0', 'they ok', 'Night driving is not problematic; patient experiences no issues with night driving.', '2025-12-25 18:06:39.177037+00'),
  ('a501195d-e767-40e7-9d7e-9119952cc5ef', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '8', 'Working with computer or bank machine?', '0', 'they ok', 'Screen use does not negatively affect the patient''s eyes; screens are well-tolerated.', '2025-12-25 18:06:39.177037+00'),
  ('e038a0fb-9d21-41d2-8796-9ed52b1f1265', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '9', 'Watching TV?', '0', 'they ok', 'Television watching causes no discomfort; patient tolerates TV viewing well.', '2025-12-25 18:06:39.177037+00'),
  ('de423cda-063f-466a-a888-fe33281d12e3', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '10', 'Windy conditions?', '3', 'very bad daily', 'Wind exposure is a significant problem occurring daily, indicating most windy situations are uncomfortable.', '2025-12-25 18:06:39.177037+00'),
  ('5ac30fe3-600b-4bb9-9e88-26da7154238b', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '11', 'Places or areas with low humidity?', '0', 'they ok', 'Dry environments do not negatively affect the patient''s eyes; dry air is well-tolerated.', '2025-12-25 18:06:39.177037+00'),
  ('37883841-7d9a-4c75-a4ba-b69f9a70744c', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', '12', 'Areas that are air conditioned?', '0', 'ok', 'Air-conditioned rooms do not cause discomfort; patient tolerates AC environments well.', '2025-12-25 18:06:39.177037+00'),
  ('cee66dfd-8e76-4b66-8695-cfdb83ae4e2e', 'cf11bb6b-8c12-4352-afee-887407fceced', '1', 'Eyes sensitive to light?', '1', 'I do find it hard to see the sun.', 'The patient mentioned some difficulty with bright light, but the frequency is unclear. Assigning a low score.', '2025-12-25 18:18:19.614797+00'),
  ('702c38ff-b80c-4065-8aee-b8bd1b13ef04', 'cf11bb6b-8c12-4352-afee-887407fceced', '2', 'Eyes feel gritty?', '0', 'No.', 'The patient reported no gritty or sandy feeling at all.', '2025-12-25 18:18:19.614797+00'),
  ('6312b7db-db6c-452b-b93c-fb002a334aca', 'cf11bb6b-8c12-4352-afee-887407fceced', '3', 'Painful or sore eyes?', '0', 'No.', 'The patient reported no pain or soreness.', '2025-12-25 18:18:19.614797+00'),
  ('10d09c78-1b45-400c-b433-4b88b0b98eab', 'cf11bb6b-8c12-4352-afee-887407fceced', '4', 'Blurred vision?', '0', 'Not really.', 'The patient reported that their vision stays clear and does not become blurry.', '2025-12-25 18:18:19.614797+00'),
  ('1d86b38e-cdd1-4533-a939-883370509b15', 'cf11bb6b-8c12-4352-afee-887407fceced', '5', 'Poor vision?', '3', 'Yes, about on a daily basis.', 'The patient indicated that their vision feels worse than usual on a daily basis.', '2025-12-25 18:18:19.614797+00'),
  ('bd6405fb-17e2-4cc1-aae0-ed4502a2303c', 'cf11bb6b-8c12-4352-afee-887407fceced', '6', 'Reading?', '0', 'They are pretty okay.', 'The patient reported no difficulty or discomfort when reading.', '2025-12-25 18:18:19.614797+00'),
  ('7746bc37-a851-4995-a162-6aa0f434768a', 'cf11bb6b-8c12-4352-afee-887407fceced', '7', 'Driving at night?', '2', 'I don''t drive at night often, but when I do I don''t feel really good.', 'The patient mentioned discomfort when driving at night, though they do it infrequently.', '2025-12-25 18:18:19.614797+00'),
  ('4ed6ddc5-a4f7-4074-81bb-4861a9e7d461', 'cf11bb6b-8c12-4352-afee-887407fceced', '8', 'Working with computer or bank machine?', '0', 'I''m okay.', 'The patient reported no discomfort with screen use.', '2025-12-25 18:18:19.614797+00'),
  ('c86661ba-a65d-4024-ae90-5133fe46657f', 'cf11bb6b-8c12-4352-afee-887407fceced', '9', 'Watching TV?', '4', 'Very, very bad.', 'The patient reported significant discomfort when watching TV.', '2025-12-25 18:18:19.614797+00'),
  ('04e07fd2-3ff6-45a6-ae38-9623a208fd17', 'cf11bb6b-8c12-4352-afee-887407fceced', '10', 'Windy conditions?', '0', 'They react to wind very good.', 'The patient reported no discomfort from wind exposure.', '2025-12-25 18:18:19.614797+00'),
  ('0d958a62-39f9-47a7-baab-ee7cb5809838', 'cf11bb6b-8c12-4352-afee-887407fceced', '11', 'Places or areas with low humidity?', '0', 'Very good actually.', 'The patient reported no discomfort in dry environments.', '2025-12-25 18:18:19.614797+00'),
  ('7b68cbcf-fa49-4da7-864d-375a6a5b30d5', 'cf11bb6b-8c12-4352-afee-887407fceced', '12', 'Areas that are air conditioned?', '2', 'They are dry.', 'The patient reported dryness in air-conditioned environments.', '2025-12-25 18:18:19.614797+00'),
  ('bea73cc4-8301-4e88-965d-db43f8f792cf', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '1', 'Eyes sensitive to light?', '1', 'they are pretty good in bright areas, but I don’t see very well when I see monitors and stuff like that.', 'Patient mentioned no issues with bright light generally, but some difficulty with screens. Scored conservatively.', '2025-12-27 20:30:28.436483+00'),
  ('4dec648a-8830-42e7-a7ed-73a0a76d8ac7', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '2', 'Eyes feel gritty?', '0', 'No, they’re pretty okay.', 'Patient reported no scratchy or gritty feeling.', '2025-12-27 20:30:28.436483+00'),
  ('ddca6711-840c-48ba-9d7a-16ecb78b8ab6', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '3', 'Painful or sore eyes?', '1', 'It''s okay generally, but it depends.', 'Patient mentioned occasional soreness depending on the situation, so mild discomfort.', '2025-12-27 20:30:28.436483+00'),
  ('2952a216-9bd3-4a24-9c6d-845a44048770', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '4', 'Blurred vision?', '0', 'Not really.', 'Patient reported no blurry vision.', '2025-12-27 20:30:28.436483+00'),
  ('2172d604-d165-4541-b39d-ec5810b86f54', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '5', 'Poor vision?', '0', 'No, it feels the same.', 'Patient mentioned overall vision feels the same, no worsening.', '2025-12-27 20:30:28.436483+00'),
  ('1c4a990e-cbb4-453b-989b-a1439b2fecc1', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '6', 'Reading?', '1', 'It’s hard for me to read for more than an hour.', 'Patient finds reading difficult after more than an hour, indicating mild discomfort.', '2025-12-27 20:30:28.436483+00'),
  ('23283962-83a4-460b-bae7-cf5cb31d6878', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '7', 'Driving at night?', '3', 'I don’t drive much at night, but when I do, I find it hard.', 'Patient finds night driving difficult when it happens.', '2025-12-27 20:30:28.436483+00'),
  ('a9e3be83-39b1-4e55-89d8-8637b3e635c5', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '8', 'Working with computer or bank machine?', '2', 'They feel scratchy, they don’t feel really good.', 'Patient reported discomfort with screen use fairly often.', '2025-12-27 20:30:28.436483+00'),
  ('d36afeff-4eff-4645-b3d3-8f4284e59715', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '9', 'Watching TV?', '3', 'I find it hard to watch TV for more than 10 minutes.', 'Patient experiences significant discomfort watching TV for longer periods.', '2025-12-27 20:30:28.436483+00'),
  ('3e0c9fc4-ba1c-421e-8b30-25b0d0df7478', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '10', 'Windy conditions?', '4', 'Pretty bad.', 'Patient reported wind exposure is very bad for their eyes.', '2025-12-27 20:30:28.436483+00'),
  ('29b078eb-a0e2-41ff-b5c4-d652ced11bd4', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '11', 'Places or areas with low humidity?', '1', 'I would say regular.', 'Patient mentioned dry environments feel regular, so occasional discomfort at most.', '2025-12-27 20:30:28.436483+00'),
  ('4c2df9b8-87e2-4989-a64b-4284fb1cd6bb', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', '12', 'Areas that are air conditioned?', '1', 'Pretty much the same.', 'Patient reported air-conditioned environments feel the same, so occasional mild dryness if any.', '2025-12-27 20:30:28.436483+00'),
  ('fb5975b3-24a5-4242-bc60-fd5f9eb173b5', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '1', 'Eyes sensitive to light?', '1', 'רק לפעמים, רק לפעמים.', 'המטופל ציין שרק לפעמים יש רגישות לאור חזק.', '2026-01-01 16:18:51.903157+00'),
  ('da12436c-51d2-4b42-9f4a-9cf077eda464', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '2', 'Eyes feel gritty?', '0', 'לא.', 'המטופל ציין שאין תחושת חול בעיניים.', '2026-01-01 16:18:51.903157+00'),
  ('a7a4e568-f79c-45d7-81c8-8796930090ce', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '3', 'Painful or sore eyes?', '0', 'לא.', 'המטופל ציין שאין כאבים או אי נוחות בעיניים.', '2026-01-01 16:18:51.903157+00'),
  ('400fad58-53d6-4c8a-b1e6-93761f295a34', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '4', 'Blurred vision?', '0', 'לא.', 'המטופל ציין שאין טשטוש ראייה.', '2026-01-01 16:18:51.903157+00'),
  ('d3269eeb-330d-4ff7-9964-cdb3ed9627c6', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '5', 'Poor vision?', '0', 'לא.', 'המטופל ציין שהראייה הכללית שלו תקינה.', '2026-01-01 16:18:51.903157+00'),
  ('788f3d82-f5e1-498c-82cc-672f1a4e87f7', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '6', 'Reading?', '0', 'בסדר.', 'המטופל ציין שאין לו בעיה בקריאה ממושכת.', '2026-01-01 16:18:51.903157+00'),
  ('da873e20-6f42-4610-bce0-3494553ad4a3', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '7', 'Driving at night?', '0', 'לא.', 'המטופל לא ציין בעיה בנהיגה בלילה.', '2026-01-01 16:18:51.903157+00'),
  ('98507cb1-4779-4c56-a4e2-44f4813fe698', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '8', 'Working with computer or bank machine?', '0', 'בסדר.', 'המטופל ציין ששימוש במסכים לא גורם לאי נוחות.', '2026-01-01 16:18:51.903157+00'),
  ('deea5ec8-7e58-480f-beb2-e033b41ad1fa', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '9', 'Watching TV?', '0', 'בסדר.', 'המטופל ציין שאין בעיה בצפייה בטלוויזיה.', '2026-01-01 16:18:51.903157+00'),
  ('03b2304e-89b9-47ae-b4d7-6cc910b5d2d2', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '10', 'Windy conditions?', '0', 'לא.', 'המטופל ציין שאין רגישות לרוח.', '2026-01-01 16:18:51.903157+00'),
  ('bbb19b8e-53bd-405d-a392-788488df51d4', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '11', 'Places or areas with low humidity?', '0', 'לא.', 'המטופל ציין שאין רגישות לסביבה יבשה.', '2026-01-01 16:18:51.903157+00'),
  ('1e17b559-b422-4354-aaaf-94a1e1b352c0', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', '12', 'Areas that are air conditioned?', '0', 'בסדר.', 'המטופל ציין שאין אי נוחות במקומות ממוזגים.', '2026-01-01 16:18:51.903157+00'),
  ('f8e85d69-23aa-4952-83d7-2739da23ed0e', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '1', 'Eyes sensitive to light?', '4', 'I can barely look at my computer screen without pain', 'Patient reports severe photophobia affecting daily work', '2026-01-01 16:26:39.10079+00'),
  ('f3edbcc8-cd52-40de-b307-c64b549f8505', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '2', 'Eyes feel gritty?', '3', 'It feels like sand in my eyes all the time', 'Persistent foreign body sensation indicates significant dry eye', '2026-01-01 16:26:39.10079+00'),
  ('39477bf2-b21f-402e-aa79-038e828d1d48', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '3', 'Painful or sore eyes?', '4', 'The burning pain is constant throughout the day', 'Severe ocular pain requiring intervention', '2026-01-01 16:26:39.10079+00'),
  ('a8ac6f7e-99d0-4cee-8c17-827490448b25', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '4', 'Blurred vision?', '3', 'Vision clears after blinking but gets blurry quickly', 'Tear film instability affecting visual acuity', '2026-01-01 16:26:39.10079+00'),
  ('db12b60a-4d84-4ece-be81-a2f412914f70', 'f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', '5', 'Poor vision?', '2', 'Only when working on computer for extended periods', 'Screen time exacerbates symptoms', '2026-01-01 16:26:39.10079+00'),
  ('7a2d0a95-ba88-4d0c-9962-829f47cfe0c3', '0015ded8-d0fa-44ba-8405-f35f164937a6', '1', 'Eyes sensitive to light?', '1', 'יחסית בסדר, טיפה כואב לפעמים.', 'הוא הזכיר שכאב מופיע רק לפעמים, אז ניתן ציון נמוך.', '2026-01-03 19:21:34.480209+00'),
  ('ebf1c974-12bb-4e87-bd06-e441f3d1b8a7', '0015ded8-d0fa-44ba-8405-f35f164937a6', '2', 'Eyes feel gritty?', '0', 'לא.', 'הוא אמר שלא הייתה תחושת גרגרים בכלל.', '2026-01-03 19:21:34.480209+00'),
  ('5035d840-a322-4ed1-afdf-c36283541fbc', '0015ded8-d0fa-44ba-8405-f35f164937a6', '3', 'Painful or sore eyes?', '1', 'הרגשתי מעט, בערך פעמיים.', 'הוא ציין רגישות קלה בערך פעמיים בשבוע.', '2026-01-03 19:21:34.480209+00'),
  ('c3bcb19b-8492-40c7-9daa-5bd1c4bf0352', '0015ded8-d0fa-44ba-8405-f35f164937a6', '4', 'Blurred vision?', '0', 'האמת שלא, האמת שזה בסדר.', 'הוא אמר שהראייה נשארת ברורה.', '2026-01-03 19:21:34.480209+00'),
  ('f62b711e-d7cd-4fd0-8fef-12cac021a8e7', '0015ded8-d0fa-44ba-8405-f35f164937a6', '5', 'Poor vision?', '0', 'לא, אני מרגיש אותה דבר.', 'הוא ציין שהראייה הרגישה רגילה כל השבוע.', '2026-01-03 19:21:34.480209+00'),
  ('e8d064e2-907c-4c46-ae36-6e2d707c8c7e', '0015ded8-d0fa-44ba-8405-f35f164937a6', '6', 'Reading?', '1', 'אחרי שעה וחצי פחות או יותר אני מרגיש קצת כאב ראש.', 'כאב ראש קל אחרי זמן ממושך של קריאה מצביע על אי נוחות קלה.', '2026-01-03 19:21:34.480209+00'),
  ('4e5b14ad-0fa9-40ea-8b87-33654c9dfc5f', '0015ded8-d0fa-44ba-8405-f35f164937a6', '7', 'Driving at night?', '0', 'כרגיל, אין שינוי.', 'אין בעיות בנהיגה בלילה.', '2026-01-03 19:21:34.480209+00'),
  ('c4fe605f-3da7-447a-9d76-a43194675190', '0015ded8-d0fa-44ba-8405-f35f164937a6', '8', 'Working with computer or bank machine?', '0', 'מגיבות בסדר גמור.', 'אין תלונות לגבי שימוש במסכים.', '2026-01-03 19:21:34.480209+00'),
  ('6527163b-9929-4734-be28-5b55c69b746f', '0015ded8-d0fa-44ba-8405-f35f164937a6', '9', 'Watching TV?', '0', 'גם כן, כרגיל.', 'אין אי נוחות בצפייה בטלוויזיה.', '2026-01-03 19:21:34.480209+00'),
  ('b60a4334-c382-4dca-bb93-5f17af0806ea', '0015ded8-d0fa-44ba-8405-f35f164937a6', '10', 'Windy conditions?', '4', 'מאוד מאוד כואבות לי.', 'הוא תיאר כאב משמעותי בעיניים כשיש רוח.', '2026-01-03 19:21:34.480209+00'),
  ('7ac3d757-b333-4786-9b76-886e9d7ef06d', '0015ded8-d0fa-44ba-8405-f35f164937a6', '11', 'Places or areas with low humidity?', '2', 'מאוד מגרדות.', 'הוא ציין גרד במקומות עם אוויר יבש, שזה תדיר.', '2026-01-03 19:21:34.480209+00'),
  ('41c7ea83-5aca-4301-a91b-5d34a8ad46a9', '0015ded8-d0fa-44ba-8405-f35f164937a6', '12', 'Areas that are air conditioned?', '2', 'אני יבשוק.', 'הוא תיאר תחושת יובש בעיניים כשהוא במזגן, שזה קורה לעיתים קרובות.', '2026-01-03 19:21:34.480209+00')
ON CONFLICT (id) DO NOTHING;

-- clinician_notes: 7 rows
INSERT INTO public.clinician_notes (id, assessment_id, note_text, created_by, created_at) VALUES
  ('29d573e2-eece-4c93-ae82-674575071de6', 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', 'Patient showing improvement with current treatment regimen. Prescribed punctal plugs and cyclosporine drops. Follow up in 6 weeks.', 'Dr. Elad', '2025-12-25 17:14:20.342751+00'),
  ('d63f61e7-e5f6-4b38-b3d5-82e672d4dfd2', '5f0cf7a3-2d0e-4475-a81f-41da23c9632d', 'Chief Complaint: Daily eye discomfort with scratchy/sandy sensation, pain, and blurred vision; significant sensitivity to wind exposure

Key Observations:
- Gritty/sandy feeling occurs daily
- Eye pain or soreness experienced daily
- Blurred vision occurs all the time
- Wind exposure is a major trigger occurring daily
- Most environmental and activity-based triggers are well-tolerated
- Light sensitivity is minimal', 'AI Assistant', '2025-12-25 18:06:39.240325+00'),
  ('f28a3105-69e7-4690-858a-89a74365f147', 'cf11bb6b-8c12-4352-afee-887407fceced', 'Chief Complaint: Dry eyes and discomfort in certain conditions.

Key Observations:
- Sensitivity to bright light, though frequency unclear.
- No gritty or sandy feeling in the eyes.
- No pain or soreness reported.
- Vision is generally clear, with no blurring reported.
- Vision feels worse than usual almost daily.
- Reading is comfortable with no issues.
- Night driving is uncomfortable when it happens, though not frequent.
- Screen use does not cause discomfort.
- Watching TV causes significant discomfort and dryness.
- Eyes react well to wind, no discomfort.
- Dry environments are comfortable.
- Air-conditioned environments cause dryness.', 'AI Assistant', '2025-12-25 18:18:19.6821+00'),
  ('e653c64c-bdc4-416d-8485-65ec355b9d40', 'a83d8390-dac5-480e-ad7f-0b71ff849ac5', 'Chief Complaint: Patient reports discomfort especially when using screens and watching TV, and some difficulty with night driving.

Key Observations:
- No sensitivity to light generally, but vision not great with screens.
- No gritty or sandy feeling in the eyes.
- Pain or soreness depends on the situation, not constant.
- No blurry vision reported.
- Overall vision feels the same, not worse than usual.
- Reading for more than an hour is difficult.
- Night driving is hard when it happens.
- Screens make eyes feel scratchy and uncomfortable.
- Watching TV is hard after about 10 minutes.
- Wind exposure is very bad for the eyes.
- Dry environments feel regular, not particularly bothersome.
- Air-conditioned environments feel the same as usual.', 'AI Assistant', '2025-12-27 20:30:28.489938+00'),
  ('024f032a-a2e3-4292-a488-f20846d50c80', '2fc5951e-e8ca-4c60-bd3f-d4abacd446d6', 'Chief Complaint: המטופל מציין שהכול בסדר ואין לו תלונות מיוחדות.

Key Observations:
- המטופל לא דיווח על רגישות לאור חזקה.
- אין תחושת חול בעיניים.
- אין כאבים או אי נוחות בעיניים.
- לא דווחה ראייה מטושטשת.
- הראייה הכללית מרגישה תקינה.
- אין קושי בקריאה ממושכת.
- אין בעיה בנהיגה בלילה (לא דווח אחרת).
- שימוש במסכים אינו גורם לאי נוחות.
- אין בעיה בצפייה בטלוויזיה.
- אין תלונות על רגישות לרוח.
- אין תלונות על רגישות לסביבה יבשה.
- אין תלונות על אי נוחות במקומות ממוזגים.', 'AI Assistant', '2026-01-01 16:18:51.977341+00'),
  ('b2cbeda3-aa91-4040-8cc6-29a1ed72a0ec', 'a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', 'Patient showing improvement with current treatment regimen. Prescribed punctal plugs and cyclosporine drops. Follow up in 6 weeks.', 'Dr. Elad', '2026-01-01 16:26:39.10079+00'),
  ('a721f55e-c1d2-412a-80fc-712ea0df403c', '0015ded8-d0fa-44ba-8405-f35f164937a6', 'Chief Complaint: העיניים מגיבות בכאב ברוח, גרד במקומות יבשים, ויובש במזגן.

Key Observations:
- רגישות קלה לאור חזק לפעמים.
- אין תחושת גרגרים בעיניים.
- רגישות קלה בעיניים בערך פעמיים בשבוע.
- הראייה נשארת ברורה.
- הראייה הרגישה רגילה כל השבוע.
- אחרי חצי שעה של קריאה יש קצת כאב ראש.
- אין בעיה בנהיגה בלילה.
- מסכים לא מפריעים לעיניים.
- גם צפייה בטלוויזיה לא גורמת לאי נוחות.
- כאב משמעותי בעיניים כשיש רוח.
- גרד במקומות עם אוויר יבש.
- תחושת יובש במזגן.', 'AI Assistant', '2026-01-03 19:21:34.590409+00')
ON CONFLICT (id) DO NOTHING;

-- survey_responses: 60 rows
INSERT INTO public.survey_responses (id, survey_id, question_number, frequency, free_text, assigned_score, created_at) VALUES
  ('5835dc8f-bb1f-4831-bbec-6f624759345c', '242acb65-b98e-4359-840d-11c62e4ee5b0', '1', 'half', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('99bf32c4-456a-4a5a-b325-6da9e041590b', '242acb65-b98e-4359-840d-11c62e4ee5b0', '2', 'not_applicable', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('41a062aa-e9fb-42d9-86eb-ecd9dbee59dc', '242acb65-b98e-4359-840d-11c62e4ee5b0', '3', 'not_applicable', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('fdfb51fc-7fa3-4dce-b270-7b642dddc7d1', '242acb65-b98e-4359-840d-11c62e4ee5b0', '4', 'sometimes', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('536b779d-f053-4c52-920a-4108233f8279', '242acb65-b98e-4359-840d-11c62e4ee5b0', '5', 'sometimes', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('d234c7e8-47d2-4bfc-8a3a-5896f29360af', '242acb65-b98e-4359-840d-11c62e4ee5b0', '6', 'sometimes', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('7d6050cc-fbdd-477a-a1cf-ddbcf7376925', '242acb65-b98e-4359-840d-11c62e4ee5b0', '7', 'sometimes', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('102375cf-eb82-435d-9464-e525b67a2ba0', '242acb65-b98e-4359-840d-11c62e4ee5b0', '8', 'all', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('1cf289f6-1104-426a-995c-386243546c18', '242acb65-b98e-4359-840d-11c62e4ee5b0', '9', 'all', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('f35678df-0298-4c88-9082-8c439d9e25fd', '242acb65-b98e-4359-840d-11c62e4ee5b0', '10', 'sometimes', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('29e4a61c-27ab-436f-83a3-117f9f96bd23', '242acb65-b98e-4359-840d-11c62e4ee5b0', '11', 'sometimes', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('9f299c10-48db-453f-bdef-70474ae96e45', '242acb65-b98e-4359-840d-11c62e4ee5b0', '12', 'sometimes', NULL, NULL, '2026-01-02 06:35:01.602591+00'),
  ('ef192fe4-497f-4601-8903-39d8cff3ce69', 'e10ee576-830c-4565-afba-32d8ed422ad6', '1', 'sometimes', NULL, '1', '2026-01-02 06:39:01.898127+00'),
  ('f1e3b839-e4b0-47a8-89e3-ceb0cff62a43', 'e10ee576-830c-4565-afba-32d8ed422ad6', '2', 'all', NULL, '4', '2026-01-02 06:39:01.898127+00'),
  ('8ac60bbe-f71e-42e7-bcbc-c552ade9a214', 'e10ee576-830c-4565-afba-32d8ed422ad6', '3', 'sometimes', NULL, '1', '2026-01-02 06:39:01.898127+00'),
  ('2e0cda3b-0a93-44d3-8dfd-580aeb529d8e', 'e10ee576-830c-4565-afba-32d8ed422ad6', '4', 'sometimes', NULL, '1', '2026-01-02 06:39:01.898127+00'),
  ('498d1d3c-a676-4b4f-a1e4-2f20ca55d3f8', 'e10ee576-830c-4565-afba-32d8ed422ad6', '5', 'all', NULL, '4', '2026-01-02 06:39:01.898127+00'),
  ('9c38cf37-a9f4-46d9-a4df-ee5d55266c9f', 'e10ee576-830c-4565-afba-32d8ed422ad6', '6', 'all', NULL, '4', '2026-01-02 06:39:01.898127+00'),
  ('f463e13e-df38-40d2-9256-b7595b76c059', 'e10ee576-830c-4565-afba-32d8ed422ad6', '7', 'all', NULL, '4', '2026-01-02 06:39:01.898127+00'),
  ('341b510a-4291-4edd-834a-e6c84ff07b87', 'e10ee576-830c-4565-afba-32d8ed422ad6', '8', 'sometimes', NULL, '1', '2026-01-02 06:39:01.898127+00'),
  ('85609e8e-0916-4fc5-a2c2-8292c512ade3', 'e10ee576-830c-4565-afba-32d8ed422ad6', '9', 'sometimes', NULL, '1', '2026-01-02 06:39:01.898127+00'),
  ('1e5681b9-0853-4155-bb5c-416fd2bd7d48', 'e10ee576-830c-4565-afba-32d8ed422ad6', '10', 'none', NULL, '0', '2026-01-02 06:39:01.898127+00'),
  ('14590345-5336-443c-af07-6e4ae6022dbd', 'e10ee576-830c-4565-afba-32d8ed422ad6', '11', 'none', NULL, '0', '2026-01-02 06:39:01.898127+00'),
  ('cb6a1c1d-5b56-4b52-b51f-cf27b4029b90', 'e10ee576-830c-4565-afba-32d8ed422ad6', '12', 'none', NULL, '0', '2026-01-02 06:39:01.898127+00'),
  ('95839e69-0f26-4b45-a323-2221fd3441f5', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '1', 'half', NULL, '2', '2026-01-02 06:47:40.628933+00'),
  ('5947c81f-bb9f-4a13-b55e-ef24a122bd87', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '2', 'sometimes', NULL, '1', '2026-01-02 06:47:40.628933+00'),
  ('12440db8-658c-4e5e-9c1f-9e327d790fcf', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '3', 'most', NULL, '3', '2026-01-02 06:47:40.628933+00'),
  ('a09e0803-6977-4a18-8cdd-0fa8968a13dd', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '4', 'sometimes', NULL, '1', '2026-01-02 06:47:40.628933+00'),
  ('439bb8d3-51db-4210-a1f4-83839a0e4ea6', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '5', 'half', NULL, '2', '2026-01-02 06:47:40.628933+00'),
  ('821785f8-f226-4126-a5ee-200b48c47cbc', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '6', 'half', NULL, '2', '2026-01-02 06:47:40.628933+00'),
  ('ef05c4b2-f9e8-4c85-8102-77eb54899815', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '7', 'half', NULL, '2', '2026-01-02 06:47:40.628933+00'),
  ('164a9691-bd71-4822-ba9f-639a33969c6b', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '8', 'half', NULL, '2', '2026-01-02 06:47:40.628933+00'),
  ('ee21234a-5970-446a-bb1b-06dcad44ab01', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '9', 'sometimes', NULL, '1', '2026-01-02 06:47:40.628933+00'),
  ('8c5503b5-5c53-49a0-9fcc-d4bcd458c453', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '10', 'sometimes', NULL, '1', '2026-01-02 06:47:40.628933+00'),
  ('caa3055d-fcde-400c-b8f1-b3b8f8d33f20', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '11', 'all', NULL, '4', '2026-01-02 06:47:40.628933+00'),
  ('76fdfcd2-0534-42bc-b159-af5b6afe0373', '8f1c70e3-b80c-4127-955b-8bc3b7628ca4', '12', 'all', NULL, '4', '2026-01-02 06:47:40.628933+00'),
  ('98b42198-42d3-4cb2-83e1-5a65671bc8e8', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '1', 'half', NULL, '2', '2026-01-02 08:15:40.155069+00'),
  ('51f27bb6-33d7-41c5-bddb-ac7c1c778dbf', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '2', 'sometimes', NULL, '1', '2026-01-02 08:15:40.155069+00'),
  ('d25e1c29-b479-40c2-aef6-61ef05aa356e', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '3', 'sometimes', NULL, '1', '2026-01-02 08:15:40.155069+00'),
  ('ee6685d8-72a9-4766-ae87-fd8e90c5095a', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '4', 'all', NULL, '4', '2026-01-02 08:15:40.155069+00'),
  ('f6f266e3-2b2b-4cc8-9e8a-dfcd71bb7ad1', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '5', 'sometimes', NULL, '1', '2026-01-02 08:15:40.155069+00'),
  ('39dd763a-f8a1-4f95-be85-13f4461eec52', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '6', 'half', NULL, '2', '2026-01-02 08:15:40.155069+00'),
  ('c752a1c5-67a7-46ed-996f-a264910daba0', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '7', 'half', NULL, '2', '2026-01-02 08:15:40.155069+00'),
  ('dba1ce4b-187c-4b39-afa3-a8a5a92988e4', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '8', 'half', NULL, '2', '2026-01-02 08:15:40.155069+00'),
  ('daa44c61-4265-409d-844a-2a705d6dc05f', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '9', 'sometimes', NULL, '1', '2026-01-02 08:15:40.155069+00'),
  ('f56870ae-876d-4d23-8565-1673f27a7662', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '10', 'sometimes', NULL, '1', '2026-01-02 08:15:40.155069+00'),
  ('e26cb31f-138b-4128-9691-21330a8631d0', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '11', 'none', NULL, '0', '2026-01-02 08:15:40.155069+00'),
  ('6e6dbfba-4a07-4b12-b467-811137ce57a5', '5c4b2147-5286-4ff5-b60a-b1b89efb48f3', '12', 'half', NULL, '2', '2026-01-02 08:15:40.155069+00'),
  ('c11a6d79-ac4c-463b-9088-58390ff7829b', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '1', 'not_applicable', NULL, '0', '2026-01-02 09:28:27.254553+00'),
  ('99a787c2-3e00-4603-bd6f-0d4f0611869c', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '2', 'not_applicable', NULL, '0', '2026-01-02 09:28:27.254553+00'),
  ('3e92d471-53a3-400d-a8e9-1a41844c01ee', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '3', 'most', NULL, '3', '2026-01-02 09:28:27.254553+00'),
  ('c76b8608-c997-4de0-89f1-33ea032aeabb', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '4', 'most', NULL, '3', '2026-01-02 09:28:27.254553+00'),
  ('2fab88b9-2249-4b29-b493-f77ff9f666eb', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '5', 'most', NULL, '3', '2026-01-02 09:28:27.254553+00'),
  ('29674d69-e219-47e5-8326-c41580178312', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '6', 'most', NULL, '3', '2026-01-02 09:28:27.254553+00'),
  ('27a56729-bd55-4166-a6ed-d31cfdb72a69', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '7', 'sometimes', NULL, '1', '2026-01-02 09:28:27.254553+00'),
  ('ac21eaf8-f387-40ec-91a1-40fd2a9dd0a2', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '8', 'sometimes', NULL, '1', '2026-01-02 09:28:27.254553+00'),
  ('60a8ea09-9924-40db-8477-88ce1230520e', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '9', 'all', NULL, '4', '2026-01-02 09:28:27.254553+00'),
  ('c0e8282e-44a9-4020-abfa-984d91308eaf', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '10', 'sometimes', NULL, '1', '2026-01-02 09:28:27.254553+00'),
  ('925d3b75-26ee-419d-a5ea-c58175f2c2a2', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '11', 'none', NULL, '0', '2026-01-02 09:28:27.254553+00'),
  ('5fa66437-7008-4b58-8c61-93e6275230f1', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', '12', 'half', NULL, '2', '2026-01-02 09:28:27.254553+00')
ON CONFLICT (id) DO NOTHING;

-- patient_medications: 2 rows
INSERT INTO public.patient_medications (id, patient_id, survey_id, medication_name, dosage, frequency, status, start_date, stop_date, notes, created_at, updated_at) VALUES
  ('26882cd1-eb22-46ea-9606-ffa28278fa95', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', 'דמעות מלאכותיות', 'טיפה אחת', '3 פעמים ביום', 'new', '2026-01-02', NULL, 'ללא מרשם', '2026-01-02 09:28:27.301281+00', '2026-01-02 09:28:27.301281+00'),
  ('f658f091-c22e-4787-a3de-3cee979d43c6', '3b4d796f-e3c4-4651-b2fb-8d07c414610c', '13adb3e3-62fe-456b-88f5-0caaa9e449b4', 'משחה לעיניים', '', 'פעם ביומיים', 'stopped', NULL, '2025-12-25', '', '2026-01-02 09:28:27.301281+00', '2026-01-02 09:28:27.301281+00')
ON CONFLICT (id) DO NOTHING;

