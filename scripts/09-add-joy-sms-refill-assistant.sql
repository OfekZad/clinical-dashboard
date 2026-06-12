-- Joy SMS refill assistant schema
-- Adds durable medication identity, refill workflow records, SMS history,
-- staff escalation tasks, and audit logs for Joy's refill conversations.

CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  dosage_strength TEXT,
  dosage_form TEXT,
  rxnorm_code TEXT,
  ndc_code TEXT,
  pharmacy_medication_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (name, dosage_strength, dosage_form, rxnorm_code, ndc_code, pharmacy_medication_id)
);

ALTER TABLE patient_medications
  ADD COLUMN IF NOT EXISTS medication_id UUID REFERENCES medications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dosage_strength TEXT,
  ADD COLUMN IF NOT EXISTS dosage_form TEXT,
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS quantity_remaining INTEGER CHECK (quantity_remaining IS NULL OR quantity_remaining >= 0),
  ADD COLUMN IF NOT EXISTS estimated_days_remaining INTEGER CHECK (estimated_days_remaining IS NULL OR estimated_days_remaining >= 0),
  ADD COLUMN IF NOT EXISTS refill_eligible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prescription_status TEXT NOT NULL DEFAULT 'unknown' CHECK (prescription_status IN ('active', 'expired', 'cancelled', 'unknown')),
  ADD COLUMN IF NOT EXISTS preferred_pharmacy TEXT,
  ADD COLUMN IF NOT EXISTS last_refill_date DATE,
  ADD COLUMN IF NOT EXISTS rxnorm_code TEXT,
  ADD COLUMN IF NOT EXISTS ndc_code TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_medication_id TEXT,
  ADD COLUMN IF NOT EXISTS low_on_medicine BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_patient_medications_medication_id ON patient_medications(medication_id);
CREATE INDEX IF NOT EXISTS idx_patient_medications_low_on_medicine ON patient_medications(low_on_medicine) WHERE low_on_medicine = true;
CREATE INDEX IF NOT EXISTS idx_patient_medications_refill_eligible ON patient_medications(refill_eligible);

CREATE TABLE IF NOT EXISTS joy_sms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_medication_id UUID NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('outreach_sent', 'patient_replied', 'needs_patient_reply', 'refill_requested', 'escalated', 'closed_declined')),
  started_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_joy_sms_conversations_patient_id ON joy_sms_conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_joy_sms_conversations_patient_medication_id ON joy_sms_conversations(patient_medication_id);
CREATE INDEX IF NOT EXISTS idx_joy_sms_conversations_status ON joy_sms_conversations(status);

CREATE TABLE IF NOT EXISTS joy_sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES joy_sms_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  message_type TEXT NOT NULL,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_joy_sms_messages_conversation_id ON joy_sms_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_joy_sms_messages_created_at ON joy_sms_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS refill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_medication_id UUID NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES medications(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES joy_sms_conversations(id) ON DELETE SET NULL,
  preferred_pharmacy TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'sent_to_pharmacy', 'completed', 'denied', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'joy_sms',
  requested_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refill_requests_patient_id ON refill_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_refill_requests_patient_medication_id ON refill_requests(patient_medication_id);
CREATE INDEX IF NOT EXISTS idx_refill_requests_status ON refill_requests(status);

CREATE TABLE IF NOT EXISTS staff_follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_medication_id UUID REFERENCES patient_medications(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES joy_sms_conversations(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
  reason TEXT NOT NULL CHECK (reason IN ('clinical_advice_or_symptoms', 'not_refillable_automatically', 'missing_required_data', 'patient_requested_staff', 'low_confidence')),
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_follow_up_tasks_patient_id ON staff_follow_up_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_staff_follow_up_tasks_status ON staff_follow_up_tasks(status);
CREATE INDEX IF NOT EXISTS idx_staff_follow_up_tasks_reason ON staff_follow_up_tasks(reason);

CREATE TABLE IF NOT EXISTS joy_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_medication_id UUID REFERENCES patient_medications(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES joy_sms_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_joy_action_logs_patient_id ON joy_action_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_joy_action_logs_conversation_id ON joy_action_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_joy_action_logs_created_at ON joy_action_logs(created_at DESC);
