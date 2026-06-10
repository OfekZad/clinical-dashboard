-- Migration: Add patient_surveys table for self-reported assessments
-- These are filled by patients directly and scored manually by Dr. Elad

CREATE TABLE IF NOT EXISTS patient_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT, -- For anonymous surveys without patient record
  patient_email TEXT,
  patient_phone TEXT,
  survey_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scored', 'archived')),
  total_score INTEGER, -- Calculated by Dr. Elad after review
  severity_level TEXT CHECK (severity_level IN ('Normal', 'Mild', 'Moderate', 'Severe')),
  clinician_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES patient_surveys(id) ON DELETE CASCADE NOT NULL,
  question_number INTEGER NOT NULL CHECK (question_number BETWEEN 1 AND 12),
  frequency TEXT NOT NULL CHECK (frequency IN ('none', 'sometimes', 'half', 'most', 'all', 'not_applicable')),
  free_text TEXT,
  assigned_score INTEGER CHECK (assigned_score BETWEEN 0 AND 4), -- Set by Dr. Elad
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patient_surveys_status ON patient_surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
