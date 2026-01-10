-- Smartlead Webhook Integration Tables

-- 1. Webhook Events (idempotency and audit log)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  email TEXT,
  smartlead_lead_id TEXT,
  smartlead_campaign_id TEXT,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_idempotency ON webhook_events(idempotency_key);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed) WHERE processed = FALSE;
CREATE INDEX idx_webhook_events_email ON webhook_events(email);

-- 2. Lead Mapping (Person + Campaign -> Pipedrive Lead)
CREATE TABLE IF NOT EXISTS lead_map (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipedrive_person_id INTEGER NOT NULL,
  smartlead_campaign_id TEXT NOT NULL,
  pipedrive_lead_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pipedrive_person_id, smartlead_campaign_id)
);

CREATE INDEX idx_lead_map_person_campaign ON lead_map(pipedrive_person_id, smartlead_campaign_id);

-- 3. Activity Throttle (prevents spam)
CREATE TABLE IF NOT EXISTS activity_throttle (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  throttle_key TEXT UNIQUE NOT NULL,
  last_logged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_throttle_key ON activity_throttle(throttle_key);
CREATE INDEX idx_activity_throttle_time ON activity_throttle(last_logged_at);

-- 4. DNC Sync Queue (for two-way sync)
CREATE TABLE IF NOT EXISTS dnc_sync_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  smartlead_lead_id TEXT,
  pipedrive_person_id INTEGER,
  synced BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dnc_sync_pending ON dnc_sync_queue(synced) WHERE synced = FALSE;

-- Enable Row Level Security
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_throttle ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_sync_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anon access (webhook worker)
CREATE POLICY "Allow anon insert webhook_events" ON webhook_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select webhook_events" ON webhook_events FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update webhook_events" ON webhook_events FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anon insert lead_map" ON lead_map FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select lead_map" ON lead_map FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon insert activity_throttle" ON activity_throttle FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select activity_throttle" ON activity_throttle FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update activity_throttle" ON activity_throttle FOR UPDATE TO anon USING (true);

CREATE POLICY "Allow anon insert dnc_sync_queue" ON dnc_sync_queue FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select dnc_sync_queue" ON dnc_sync_queue FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update dnc_sync_queue" ON dnc_sync_queue FOR UPDATE TO anon USING (true);