-- Trigger: keep email_provider in sync when professionals.email is inserted or updated.
-- Optional: run after 20260227000000_professionals_email_provider.sql if you want automatic updates.

CREATE OR REPLACE FUNCTION professionals_set_email_provider()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  dom text;
BEGIN
  IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
    NEW.email_provider := 'private';
    RETURN NEW;
  END IF;
  dom := LOWER(TRIM(SPLIT_PART(TRIM(NEW.email), '@', 2)));
  IF dom IN ('gmail.com', 'googlemail.com') THEN
    NEW.email_provider := 'gmail';
  ELSIF dom IN (
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
  ) OR dom LIKE 'outlook.%' OR dom LIKE 'hotmail.%' OR dom LIKE 'live.%' THEN
    NEW.email_provider := 'outlook';
  ELSE
    NEW.email_provider := 'private';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS professionals_email_provider_trigger ON professionals;
CREATE TRIGGER professionals_email_provider_trigger
  BEFORE INSERT OR UPDATE OF email ON professionals
  FOR EACH ROW
  EXECUTE FUNCTION professionals_set_email_provider();

COMMENT ON FUNCTION professionals_set_email_provider() IS 'Sets email_provider from email domain (gmail, outlook, private). Used by trigger on professionals.';
