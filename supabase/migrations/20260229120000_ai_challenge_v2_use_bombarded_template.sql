-- Set "AI Challenge v2 (private domain)" sequence steps to use the "I know you're getting bombarded" template content.
UPDATE crm_sequence_steps s
SET
  subject = t.subject,
  body = t.body
FROM crm_email_templates t,
     crm_sequences seq
WHERE t.name = 'I know you''re getting bombarded'
  AND seq.name ILIKE '%AI Challenge v2%private domain%'
  AND s.sequence_id = seq.id;
