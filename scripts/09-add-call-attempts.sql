-- One row per outbound voice call (the durable call log: status, transcript,
-- summary, carry-forward items, and medication adherence per call)
CREATE TABLE IF NOT EXISTS call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  call_number INTEGER NOT NULL,
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  dial_call_id TEXT,
  called_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('completed', 'no_answer', 'declined', 'failed', 'cancelled')),
  duration_seconds INTEGER,
  transcript TEXT,
  summary TEXT,
  next_time TEXT,
  medication_adherence TEXT CHECK (medication_adherence IN ('confirmed', 'changed', 'not_discussed')),
  medication_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (patient_id, call_number)
);

CREATE INDEX IF NOT EXISTS idx_call_attempts_patient_id ON call_attempts(patient_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_assessment_id ON call_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_status ON call_attempts(status);
