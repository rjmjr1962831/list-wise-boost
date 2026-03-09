-- Email Sequencer v2: State-machine driven email queue
-- Replaces sequence-processor. All state in DB, one send per cron tick, crash-safe.

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  status              text DEFAULT 'draft',
  -- draft | pending_review | approved | active | paused | complete
  template_subject    text,
  template_html       text,
  created_at          timestamptz DEFAULT now(),
  reviewed_by         text,
  approved_at         timestamptz,
  total_recipients    integer DEFAULT 0,
  total_sent          integer DEFAULT 0,
  total_opens         integer DEFAULT 0,
  total_clicks        integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.email_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         text NOT NULL REFERENCES public.email_campaigns(id),
  agent_id            uuid REFERENCES public.professionals(id),
  recipient_email     text NOT NULL,
  recipient_name      text,
  sender_account      text NOT NULL,
  subject             text NOT NULL,
  html_body           text NOT NULL,
  status              text NOT NULL DEFAULT 'pending_review',
  -- status values: pending_review | approved | scheduled | sending | sent | failed | unsubscribed | bounced
  scheduled_at        timestamptz,
  sent_at             timestamptz,
  failed_at           timestamptz,
  failure_reason      text,
  retry_count         integer DEFAULT 0,
  gmail_message_id    text,
  tracking_pixel_id   uuid DEFAULT gen_random_uuid(),
  opened_at           timestamptz,
  open_count          integer DEFAULT 0,
  clicked_at          timestamptz,
  click_count         integer DEFAULT 0,
  sequence_step       integer DEFAULT 1,
  sequence_id         uuid,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_send_volume (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_account  text NOT NULL,
  send_date       date NOT NULL,
  emails_sent     integer DEFAULT 0,
  daily_limit     integer NOT NULL,
  UNIQUE(sender_account, send_date)
);

CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  unsubscribed_at timestamptz DEFAULT now(),
  campaign_id     text,
  source          text DEFAULT 'link'
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status     ON public.email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled  ON public.email_queue(scheduled_at) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_email_queue_tracking   ON public.email_queue(tracking_pixel_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign   ON public.email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_agent      ON public.email_queue(agent_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_sender     ON public.email_queue(sender_account, status);
