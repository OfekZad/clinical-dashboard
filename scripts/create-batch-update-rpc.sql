-- 🔥 FIX: Batch update survey scores in a single query instead of N individual ones.
-- Run this in your Supabase SQL Editor to create the RPC function used by
-- /app/api/survey/score/route.ts
--
-- Usage: SELECT * FROM batch_update_survey_scores('[{"id":"uuid-1","assigned_score":3},{"id":"uuid-2","assigned_score":1}]'::jsonb);

CREATE OR REPLACE FUNCTION batch_update_survey_scores(p_updates JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE survey_responses
  SET assigned_score = u.assigned_score::integer
  FROM jsonb_to_recordset(p_updates) AS u(id uuid, assigned_score text)
  WHERE survey_responses.id = u.id;
END;
$$;
