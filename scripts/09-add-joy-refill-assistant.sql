-- Joy SMS Refill Assistant schema
-- Adds structured medication identity fields, refill workflow tables,
-- conversation memory, staff escalation tasks, and audit logging.

ALTER TABLE patient_medications
  ADD COLUMN IF NOT EXISTS internal_medication_id TEXT,
  ADD COLUMN IF NOT EXISTS generic_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS dosage_strength TEXT,
  ADD COLUMN IF NOT EXISTS dosage_form TEXT,
  ADD COLUMN IF NOT EXISTS prescribed_instructions TEXT,
  ADD COLUMN IF NOT EXISTS quantity_prescribed NUMERIC,
  ADD COLUMN IF NOT EXISTS remaining_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_supply_days INTEGER,
  ADD COLUMN IF NOT EXISTS refill_eligibility_status TEXT NOT NULL DEFAULT 'staff_review'
    CHECK (refill_eligibility_status IN ('eligible', 'provider_approval_required', 'staff_review', 'not_eligible')),
  ADD COLUMN IF NOT EXISTS prescription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (prescription_status IN ('active', 'expired', 'cancelled', 'completed', 'unknown')),
  ADD COLUMN IF NOT EXISTS prescribing_provider TEXT,
  ADD COLUMN IF NOT EXISTS preferred_pharmacy TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_phone TEXT,
  ADD COLUMN IF NOT EXISTS pharmacy_system_id TEXT,
  ADD COLUMN IF NOT EXISTS last_refill_date DATE,
  ADD COLUMN IF NOT EXISTS next_expected_refill_date DATE,
  ADD COLUMN IF NOT EXISTS rxnorm_code TEXT,
  ADD COLUMN IF NOT EXISTS ndc_code TEXT,
  ADD COLUMN IF NOT EXISTS external_medication_identifiers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS low_medication_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS low_medication_detected_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_patient_medications_low_flag ON patient_medications(low_medication_flag);
CREATE INDEX IF NOT EXISTS idx_patient_medications_refill_eligibility ON patient_medications(refill_eligibility_status);
CREATE INDEX IF NOT EXISTS idx_patient_medications_identity ON patient_medications(patient_id, internal_medication_id);

CREATE TABLE IF NOT EXISTS joy_refill_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  patient_medication_id UUID REFERENCES patient_medications(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'waiting_for_patient', 'refill_requested', 'escalated', 'closed')),
  last_detected_intent TEXT,
  escalation_reason TEXT,
  sms_from TEXT,
  sms_to TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_joy_refill_conversations_patient ON joy_refill_conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_joy_refill_conversations_medication ON joy_refill_conversations(patient_medication_id);
CREATE INDEX IF NOT EXISTS idx_joy_refill_conversations_status ON joy_refill_conversations(status);

CREATE TABLE IF NOT EXISTS joy_sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES joy_refill_conversations(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  patient_medication_id UUID REFERENCES patient_medications(id) ON DELETE CASCADE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  interpreted_intent TEXT,
  external_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_joy_sms_messages_conversation ON joy_sms_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_joy_sms_messages_patient ON joy_sms_messages(patient_id);

CREATE TABLE IF NOT EXISTS joy_refill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES joy_refill_conversations(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  patient_medication_id UUID REFERENCES patient_medications(id) ON DELETE CASCADE NOT NULL,
  medication_id TEXT,
  pharmacy_name TEXT,
  pharmacy_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'provider_review', 'staff_review', 'approved', 'denied', 'cancelled')),
  requested_by TEXT NOT NULL DEFAULT 'joy_sms',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  outcome_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_joy_refill_requests_patient ON joy_refill_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_joy_refill_requests_medication ON joy_refill_requests(patient_medication_id);
CREATE INDEX IF NOT EXISTS idx_joy_refill_requests_status ON joy_refill_requests(status);

CREATE TABLE IF NOT EXISTS joy_staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES joy_refill_conversations(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  patient_medication_id UUID REFERENCES patient_medications(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL DEFAULT 'refill_follow_up',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to TEXT,
  created_by TEXT NOT NULL DEFAULT 'joy_sms',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_joy_staff_tasks_patient ON joy_staff_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_joy_staff_tasks_status ON joy_staff_tasks(status);

CREATE TABLE IF NOT EXISTS joy_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  patient_medication_id UUID REFERENCES patient_medications(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES joy_refill_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_joy_audit_logs_patient ON joy_audit_logs(patient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_joy_audit_logs_medication ON joy_audit_logs(patient_medication_id, created_at);
CREATE INDEX IF NOT EXISTS idx_joy_audit_logs_action ON joy_audit_logs(action_type, created_at);
