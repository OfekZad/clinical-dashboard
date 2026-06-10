-- Analytics tracking tables for ROI metrics

-- Time tracking for efficiency metrics
CREATE TABLE IF NOT EXISTS assessment_timings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  survey_id UUID REFERENCES patient_surveys(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('ai', 'survey')),
  processing_time_seconds INTEGER DEFAULT 30, -- Time saved per assessment
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue and capacity tracking
CREATE TABLE IF NOT EXISTS practice_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  patients_seen INTEGER DEFAULT 0,
  assessments_completed INTEGER DEFAULT 0,
  surveys_completed INTEGER DEFAULT 0,
  estimated_time_saved_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- Patient engagement tracking
CREATE TABLE IF NOT EXISTS patient_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  survey_invites_sent INTEGER DEFAULT 0,
  surveys_completed INTEGER DEFAULT 0,
  last_engagement_date TIMESTAMP WITH TIME ZONE,
  streak_days INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(patient_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assessment_timings_created ON assessment_timings(created_at);
CREATE INDEX IF NOT EXISTS idx_practice_metrics_date ON practice_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_patient_engagement_patient ON patient_engagement(patient_id);
