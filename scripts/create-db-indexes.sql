-- 🔥 OPTIMIZATION: Database indexes to eliminate sequential scans
-- on all frequently-queried columns. Run this in your Supabase SQL Editor.
--
-- Without these indexes, every query does a full table scan, which gets
-- exponentially slower as the dataset grows.

-- Patients: lookup by id (usually has PK index, but be explicit)
CREATE INDEX IF NOT EXISTS idx_patients_id ON patients(id);

-- Assessments: filter by patient_id (used in dashboard + patient detail)
CREATE INDEX IF NOT EXISTS idx_assessments_patient_id ON assessments(patient_id);
-- Assessments: sort order for latest assessment queries
CREATE INDEX IF NOT EXISTS idx_assessments_patient_date ON assessments(patient_id, assessment_date DESC);

-- Patient surveys: filter by patient_id + status (used in dashboard)
CREATE INDEX IF NOT EXISTS idx_patient_surveys_patient_status ON patient_surveys(patient_id, status);
-- Patient surveys: sort order for latest survey queries
CREATE INDEX IF NOT EXISTS idx_patient_surveys_date ON patient_surveys(survey_date DESC);

-- Assessment responses: filter by assessment_id (used in patient detail)
CREATE INDEX IF NOT EXISTS idx_assessment_responses_assessment ON assessment_responses(assessment_id);

-- Survey responses: filter by survey_id (used in surveys scoring)
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);

-- Clinician notes: filter by assessment_id (used in patient detail)
CREATE INDEX IF NOT EXISTS idx_clinician_notes_assessment ON clinician_notes(assessment_id);
-- Clinician notes: sort by created_at
CREATE INDEX IF NOT EXISTS idx_clinician_notes_assessment_date ON clinician_notes(assessment_id, created_at DESC);

-- Patient medications: filter by patient_id (used in patient detail)
CREATE INDEX IF NOT EXISTS idx_patient_medications_patient ON patient_medications(patient_id);
