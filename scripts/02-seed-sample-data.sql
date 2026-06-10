-- Insert sample patients
INSERT INTO patients (id, name, date_of_birth, email, phone) VALUES
('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Sarah Johnson', '1978-05-15', 'sarah.j@email.com', '555-0101'),
('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Michael Chen', '1965-09-22', 'mchen@email.com', '555-0102'),
('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Emily Rodriguez', '1982-12-08', 'emily.r@email.com', '555-0103'),
('d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'Robert Williams', '1955-03-30', 'rwilliams@email.com', '555-0104'),
('e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', 'Jennifer Taylor', '1990-07-19', 'jtaylor@email.com', '555-0105')
ON CONFLICT (id) DO NOTHING;

-- Insert sample assessments
INSERT INTO assessments (id, patient_id, assessment_date, total_score, severity_level, has_screen_intolerance, has_night_driving_issues, has_wind_sensitivity, has_low_humidity_issues, reviewed) VALUES
('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', now() - interval '2 days', 82, 'Severe', true, true, false, true, false),
('a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', now() - interval '32 days', 28, 'Moderate', true, false, false, true, true),
('b8c9d0e1-f2a3-4b5c-5d6e-7f8a9b0c1d2e', 'b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', now() - interval '1 day', 38, 'Severe', false, true, true, false, false),
('c9d0e1f2-a3b4-4c5d-6e7f-8a9b0c1d2e3f', 'c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', now() - interval '5 days', 18, 'Mild', false, false, false, false, true),
('d0e1f2a3-b4c5-4d5e-7f8a-9b0c1d2e3f4a', 'd4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', now() - interval '1 hour', 68, 'Severe', true, true, true, true, false),
('e1f2a3b4-c5d6-4e5f-8a9b-0c1d2e3f4a5b', 'e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', now() - interval '3 days', 8, 'Normal', false, false, false, false, true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample assessment responses for Sarah Johnson's recent assessment
INSERT INTO assessment_responses (assessment_id, question_number, question_text, patient_response, patient_quote, reasoning) VALUES
('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 1, 'Eyes sensitive to light?', 4, 'I can barely look at my computer screen without pain', 'Patient reports severe photophobia affecting daily work'),
('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 2, 'Eyes feel gritty?', 3, 'It feels like sand in my eyes all the time', 'Persistent foreign body sensation indicates significant dry eye'),
('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 3, 'Painful or sore eyes?', 4, 'The burning pain is constant throughout the day', 'Severe ocular pain requiring intervention'),
('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 4, 'Blurred vision?', 3, 'Vision clears after blinking but gets blurry quickly', 'Tear film instability affecting visual acuity'),
('f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c', 5, 'Poor vision?', 2, 'Only when working on computer for extended periods', 'Screen time exacerbates symptoms')
ON CONFLICT DO NOTHING;

-- Insert sample clinician note
INSERT INTO clinician_notes (assessment_id, note_text, created_by) VALUES
('a7b8c9d0-e1f2-4a5b-4c5d-6e7f8a9b0c1d', 'Patient showing improvement with current treatment regimen. Prescribed punctal plugs and cyclosporine drops. Follow up in 6 weeks.', 'Dr. Elad')
ON CONFLICT DO NOTHING;
