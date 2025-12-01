-- Standardize all Arizona cities to use 'arizona' as state_slug for consistency
UPDATE cities 
SET state_slug = 'arizona' 
WHERE state = 'Arizona' AND state_slug = 'az';