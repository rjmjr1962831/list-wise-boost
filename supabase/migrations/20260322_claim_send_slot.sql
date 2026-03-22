-- Atomic send slot claim: checks limit AND increments in one transaction.
-- Returns true if a slot was claimed (under limit), false if at/over limit.
-- No race conditions — uses row-level locking via INSERT ON CONFLICT + UPDATE.
CREATE OR REPLACE FUNCTION claim_send_slot(
  p_sender_account TEXT,
  p_send_date TEXT,
  p_daily_limit INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_current INT;
BEGIN
  -- Upsert with 0 if row doesn't exist, then lock the row
  INSERT INTO email_send_volume (sender_account, send_date, emails_sent, daily_limit)
  VALUES (p_sender_account, p_send_date, 0, p_daily_limit)
  ON CONFLICT (sender_account, send_date) DO NOTHING;

  -- Lock and check+increment atomically
  UPDATE email_send_volume
  SET emails_sent = emails_sent + 1,
      daily_limit = p_daily_limit
  WHERE sender_account = p_sender_account
    AND send_date = p_send_date
    AND emails_sent < p_daily_limit
  RETURNING emails_sent INTO v_current;

  -- If no row was updated, we're at/over limit
  RETURN v_current IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Also need a unique constraint for the ON CONFLICT to work
-- Check if it exists first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_send_volume_sender_date_uq'
  ) THEN
    ALTER TABLE email_send_volume
    ADD CONSTRAINT email_send_volume_sender_date_uq
    UNIQUE (sender_account, send_date);
  END IF;
END $$;
