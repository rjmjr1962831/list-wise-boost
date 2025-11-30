-- Fix corrupted profile_link values by reconstructing them from verification_token
UPDATE public.professionals
SET profile_link = 'https://top10lists.us/profile/' || verification_token
WHERE verification_token IS NOT NULL
  AND (
    profile_link IS NULL 
    OR profile_link NOT LIKE 'https://top10lists.us/profile/%'
  );