-- Add covering indexes for foreign keys that were previously unindexed.
-- These were flagged by the Supabase performance advisor (lint 0001_unindexed_foreign_keys)
-- after the production restore. Indexing FK columns avoids sequential scans on
-- joins and on cascade deletes.

CREATE INDEX IF NOT EXISTS idx_assessment_timings_assessment_id ON public.assessment_timings(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_timings_survey_id ON public.assessment_timings(survey_id);
CREATE INDEX IF NOT EXISTS idx_patient_surveys_patient_id ON public.patient_surveys(patient_id);
