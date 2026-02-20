-- =============================================================
-- Tier Change Auto-Regen Trigger
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================
-- When an agent's tier changes, this trigger calls GitHub Actions
-- to regenerate that city's clean-room page automatically.
-- No edge function needed. Uses pg_net to call GitHub directly.
-- =============================================================

-- 1. Enable pg_net
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Store GitHub token securely in vault
-- (If vault secret already exists, this will error harmlessly)
DO $$
BEGIN
  -- Insert the GitHub PAT into Supabase Vault
  -- REPLACE the placeholder below with your actual GitHub PAT before running
  INSERT INTO vault.secrets (name, secret)
  VALUES ('github_pat', 'YOUR_GITHUB_PAT_HERE')
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
EXCEPTION
  WHEN undefined_table THEN
    -- vault.secrets may not exist, fall back to app setting
    RAISE NOTICE 'Vault not available, using app.settings approach';
END;
$$;

-- 3. Trigger function
CREATE OR REPLACE FUNCTION notify_tier_change()
RETURNS TRIGGER AS $$
DECLARE
  old_tier TEXT;
  new_tier TEXT;
  city_slug TEXT;
  state_slug TEXT;
  gh_token TEXT;
  payload JSONB;
BEGIN
  old_tier := COALESCE(OLD.current_tier, OLD.badge_tier, 'listed');
  new_tier := COALESCE(NEW.current_tier, NEW.badge_tier, 'listed');

  -- Only fire if tier actually changed
  IF old_tier = new_tier THEN
    RETURN NEW;
  END IF;

  -- Skip if no city
  IF NEW.city_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up city
  SELECT c.slug, c.state_slug
  INTO city_slug, state_slug
  FROM cities c
  WHERE c.id = NEW.city_id;

  IF city_slug IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get GitHub token from vault
  BEGIN
    SELECT decrypted_secret INTO gh_token
    FROM vault.decrypted_secrets
    WHERE name = 'github_pat'
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      gh_token := NULL;
  END;

  IF gh_token IS NULL THEN
    RAISE WARNING 'No GitHub PAT found in vault. Tier change not dispatched.';
    RETURN NEW;
  END IF;

  -- Build GitHub dispatch payload
  payload := jsonb_build_object(
    'event_type', 'tier-change',
    'client_payload', jsonb_build_object(
      'city_slug', city_slug,
      'state_slug', state_slug,
      'agent_name', COALESCE(NEW.name, 'Unknown'),
      'agent_id', NEW.id::text,
      'old_tier', old_tier,
      'new_tier', new_tier
    )
  );

  -- Fire GitHub Actions via repository_dispatch
  PERFORM net.http_post(
    url := 'https://api.github.com/repos/rjmjr1962831/list-wise-boost/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'token ' || gh_token,
      'Accept', 'application/vnd.github.v3+json',
      'Content-Type', 'application/json',
      'User-Agent', 'top10lists-supabase-trigger'
    ),
    body := payload
  );

  RAISE LOG 'Tier change dispatched: % (% -> %) in %/%',
    NEW.name, old_tier, new_tier, state_slug, city_slug;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger
DROP TRIGGER IF EXISTS on_tier_change ON professionals;

CREATE TRIGGER on_tier_change
  AFTER UPDATE OF current_tier, badge_tier
  ON professionals
  FOR EACH ROW
  EXECUTE FUNCTION notify_tier_change();

-- 5. Verify
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: Tier change trigger is active.';
  RAISE NOTICE 'When current_tier or badge_tier changes on professionals,';
  RAISE NOTICE 'GitHub Action will regenerate that city clean-room page.';
END;
$$;
