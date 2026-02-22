-- CRM Email integration tables
CREATE TABLE IF NOT EXISTS crm_email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text,
  access_token text,
  refresh_token text NOT NULL,
  token_expiry timestamptz,
  history_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id text UNIQUE NOT NULL,
  gmail_thread_id text NOT NULL,
  account_email text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_address text NOT NULL,
  to_address text NOT NULL,
  cc_address text,
  subject text,
  body_html text,
  body_text text,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_emails_thread_idx ON crm_emails(gmail_thread_id);
CREATE INDEX IF NOT EXISTS crm_emails_contact_idx ON crm_emails(contact_id);
CREATE INDEX IF NOT EXISTS crm_emails_account_idx ON crm_emails(account_email);
CREATE INDEX IF NOT EXISTS crm_emails_sent_at_idx ON crm_emails(sent_at DESC);

INSERT INTO crm_email_templates (name, subject, body) VALUES
('Welcome - Listed', 'Welcome to Top10Lists.us, {{first_name}}!',
'Hi {{first_name}},

Congratulations on your listing on Top10Lists.us. You are now part of the top 0.5% of real estate agents we have analyzed.

Your current AI Citability Score is {{aics_score}}/100. To improve your score and increase the probability that AI assistants will recommend you by name, visit your dashboard at {{profile_url}}.

Best regards,
The Top10Lists Team'),
('Follow Up', 'Following up, {{first_name}}',
'Hi {{first_name}},

I wanted to follow up on your Top10Lists profile. Your current tier is {{tier}} and your AI Citability Score is {{aics_score}}/100.

There are a few steps you can take to improve your chances of being recommended by AI assistants. Visit your dashboard to see your options: {{profile_url}}

Best regards,
Robert Maynard
Top10Lists.us'),
('Tier Upgrade', 'Improve your AI visibility, {{first_name}}',
'Hi {{first_name}},

As a {{tier}} member in {{city}}, your AI Citability Score is {{aics_score}}/100.

Agents who upgrade to our Audited or Underwritten tiers see substantially higher citation rates from AI assistants. Would you like to learn more?

{{profile_url}}

Best regards,
Robert Maynard
Top10Lists.us')
ON CONFLICT DO NOTHING;
