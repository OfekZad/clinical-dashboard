-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_of_birth DATE,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create assessments table
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
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

-- Create assessment_responses table (question-level detail)
CREATE TABLE IF NOT EXISTS assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  patient_response INTEGER NOT NULL CHECK (patient_response BETWEEN 0 AND 4),
  patient_quote TEXT,
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create clinician_notes table
CREATE TABLE IF NOT EXISTS clinician_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assessments_patient_id ON assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_assessments_date ON assessments(assessment_date DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment_id ON assessment_responses(assessment_id);
CREATE INDEX IF NOT EXISTS idx_clinician_notes_assessment_id ON clinician_notes(assessment_id);
