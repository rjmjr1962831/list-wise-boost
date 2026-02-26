-- Migrate Arizona active not-sent enrollments from AZ Listed - Challenge and AZ Listed - AI Challenge v2
-- into "Getting Named by AI". Preserve robert@/hello@ split; normalize top10lists.us -> toptenlists.us.

-- 1. Ensure "Getting Named by AI" sequence and step exist
INSERT INTO crm_sequences (name, from_account, status)
SELECT 'Getting Named by AI', 'robert@toptenlists.us', 'active'
WHERE NOT EXISTS (SELECT 1 FROM crm_sequences WHERE name ILIKE '%Getting Named by AI%');

INSERT INTO crm_sequence_steps (sequence_id, step_number, delay_days, subject, body)
SELECT s.id, 1, 0, 'Getting named by AI', t.body
FROM crm_sequences s
CROSS JOIN crm_email_templates t
WHERE s.name ILIKE '%Getting Named by AI%'
  AND t.name = 'I know you''re getting bombarded'
  AND NOT EXISTS (SELECT 1 FROM crm_sequence_steps st WHERE st.sequence_id = s.id)
LIMIT 1;

-- 2. Mark old enrollments as migrated and insert new ones
WITH target_seq AS (
  SELECT id FROM crm_sequences WHERE name ILIKE '%Getting Named by AI%' LIMIT 1
),
sent_in_sequence AS (
  SELECT DISTINCT professional_id, sequence_id
  FROM crm_emails
  WHERE direction = 'outbound' AND sequence_id IS NOT NULL
),
to_migrate AS (
  SELECT e.id, e.professional_id, e.email, e.first_name, e.last_name, e.assigned_account
  FROM crm_sequence_enrollments e
  JOIN crm_sequences s ON s.id = e.sequence_id
  JOIN professionals p ON p.id = e.professional_id AND p.state_slug = 'arizona'
  CROSS JOIN target_seq ts
  WHERE e.sequence_id != ts.id
    AND (s.name ILIKE '%AZ Listed - Challenge%' OR s.name ILIKE '%AI Challenge v2%private domain%')
    AND e.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM sent_in_sequence sis
      WHERE sis.professional_id = e.professional_id AND sis.sequence_id = e.sequence_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM crm_sequence_enrollments e2
      JOIN target_seq ts2 ON ts2.id = e2.sequence_id
      WHERE e2.email = e.email AND e2.status = 'active'
    )
),
updated AS (
  UPDATE crm_sequence_enrollments e
  SET status = 'migrated',
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('migrated_at', NOW(), 'migrated_to', 'Getting Named by AI')
  FROM to_migrate m
  WHERE e.id = m.id
  RETURNING e.id
)
INSERT INTO crm_sequence_enrollments (sequence_id, professional_id, email, first_name, last_name, status, current_step, next_send_at, assigned_account)
SELECT
  ts.id,
  m.professional_id,
  m.email,
  m.first_name,
  m.last_name,
  'active',
  0,
  NOW(),
  CASE
    WHEN m.assigned_account ILIKE 'robert@%' THEN 'robert@toptenlists.us'
    WHEN m.assigned_account ILIKE 'hello@%' THEN 'hello@toptenlists.us'
    ELSE 'robert@toptenlists.us'
  END
FROM to_migrate m
CROSS JOIN target_seq ts
ON CONFLICT (sequence_id, email) DO NOTHING;
