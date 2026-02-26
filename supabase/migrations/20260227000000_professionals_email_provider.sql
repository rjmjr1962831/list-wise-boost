-- Add email_provider to professionals: gmail, outlook, or private (unknown/custom).
-- Backfill from email domain. Active agents = those with email and in our system (we report on active = true).

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS email_provider TEXT;

COMMENT ON COLUMN professionals.email_provider IS 'Derived from email domain: gmail, outlook, or private (unknown/custom/other).';

-- Backfill: derive from email domain (lowercase, after @)
UPDATE professionals
SET email_provider = CASE
  WHEN email IS NULL OR TRIM(email) = '' THEN 'private'
  WHEN LOWER(TRIM(SPLIT_PART(TRIM(email), '@', 2))) IN ('gmail.com', 'googlemail.com') THEN 'gmail'
  WHEN LOWER(TRIM(SPLIT_PART(TRIM(email), '@', 2))) IN (
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'passport.com',
    'hotmail.co.uk', 'live.co.uk', 'outlook.co.uk', 'outlook.fr', 'outlook.de',
    'outlook.es', 'outlook.it', 'outlook.jp', 'outlook.kr', 'outlook.com.au',
    'outlook.at', 'outlook.be', 'outlook.cl', 'outlook.dk', 'outlook.gr',
    'outlook.ie', 'outlook.in', 'outlook.nl', 'outlook.pt', 'outlook.sa',
    'outlook.se', 'outlook.sg', 'outlook.tw', 'outlook.my', 'outlook.co.th',
    'outlook.ph', 'outlook.vn', 'outlook.co.id', 'outlook.co.nz', 'outlook.hu',
    'outlook.rs', 'outlook.sk', 'outlook.co.za', 'outlook.ae', 'outlook.eg',
    'outlook.com.br', 'outlook.com.mx', 'outlook.com.ar', 'outlook.com.pe',
    'outlook.com.co', 'outlook.com.ve', 'outlook.qa', 'outlook.pk', 'outlook.bg',
    'outlook.hr', 'outlook.lv', 'outlook.lt', 'outlook.ee', 'outlook.si',
    'outlook.ro', 'outlook.by', 'outlook.az', 'outlook.ge', 'outlook.kz',
    'outlook.ua', 'outlook.uz', 'outlook.tm', 'outlook.tj', 'outlook.kg',
    'outlook.am', 'outlook.md'
  ) THEN 'outlook'
  WHEN LOWER(TRIM(SPLIT_PART(TRIM(email), '@', 2))) LIKE 'outlook.%'
    OR LOWER(TRIM(SPLIT_PART(TRIM(email), '@', 2))) LIKE 'hotmail.%'
    OR LOWER(TRIM(SPLIT_PART(TRIM(email), '@', 2))) LIKE 'live.%'
  THEN 'outlook'
  ELSE 'private'
END
WHERE email IS NOT NULL AND TRIM(email) != '';

-- Rows with no email or empty email stay NULL (or set to private for consistency)
UPDATE professionals
SET email_provider = 'private'
WHERE (email IS NULL OR TRIM(email) = '') AND email_provider IS NULL;
