-- Report: Active agents by email provider (Gmail, Outlook, Private).
-- Run in Supabase SQL Editor. Shows current *stored* email_provider only.
--
-- To check MX for private (custom) domains and see Outlook vs Google vs Private:
--   Report only (no DB change):  npm run email-provider:mx:report
--   Resolve and update DB:       npm run email-provider:mx
-- Then re-run this SQL to see updated counts.
--
-- "Active" = active = true and non-empty email.

-- Summary counts
SELECT
  COALESCE(email_provider, 'private') AS email_provider,
  COUNT(*) AS count
FROM professionals
WHERE active = true
  AND email IS NOT NULL
  AND TRIM(email) != ''
GROUP BY COALESCE(email_provider, 'private')
ORDER BY count DESC;

-- Uncomment to list names and emails:
-- SELECT name, email, COALESCE(email_provider, 'private') AS email_provider
-- FROM professionals
-- WHERE active = true AND email IS NOT NULL AND TRIM(email) != ''
-- ORDER BY email_provider, name;
