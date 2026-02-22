import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const statements = [
    `CREATE TABLE IF NOT EXISTS crm_email_accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE NOT NULL,
      display_name text,
      access_token text,
      refresh_token text NOT NULL,
      token_expiry timestamptz,
      history_id text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS crm_email_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      subject text NOT NULL,
      body text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS crm_emails (
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
    )`,
    `CREATE INDEX IF NOT EXISTS crm_emails_thread_idx ON crm_emails(gmail_thread_id)`,
    `CREATE INDEX IF NOT EXISTS crm_emails_contact_idx ON crm_emails(contact_id)`,
    `CREATE INDEX IF NOT EXISTS crm_emails_sent_at_idx ON crm_emails(sent_at DESC)`,
  ];

  const results = [];
  for (const sql of statements) {
    const { error } = await client.rpc("run_sql", { query: sql }).single().catch(() => ({ error: { message: "rpc not available" } }));
    
    // Fallback: try direct table creation via insert test
    results.push({ sql: sql.slice(0, 50), error: error?.message });
  }

  // Try seeding templates directly
  const templates = [
    { name: "Welcome - Listed", subject: "Welcome to Top10Lists.us, {{first_name}}!", body: "Hi {{first_name}},\n\nCongratulations on your listing on Top10Lists.us. You are now part of the top 0.5% of real estate agents we have analyzed.\n\nYour current AI Citability Score is {{aics_score}}/100. Visit your dashboard at {{profile_url}}.\n\nBest regards,\nThe Top10Lists Team" },
    { name: "Follow Up", subject: "Following up, {{first_name}}", body: "Hi {{first_name}},\n\nI wanted to follow up on your Top10Lists profile. Your current tier is {{tier}} and your AI Citability Score is {{aics_score}}/100.\n\nVisit your dashboard: {{profile_url}}\n\nBest regards,\nRobert Maynard\nTop10Lists.us" },
    { name: "Tier Upgrade", subject: "Improve your AI visibility, {{first_name}}", body: "Hi {{first_name}},\n\nAs a {{tier}} member in {{city}}, your AI Citability Score is {{aics_score}}/100. Agents who upgrade see substantially higher citation rates.\n\n{{profile_url}}\n\nBest regards,\nRobert Maynard\nTop10Lists.us" },
  ];

  const { error: tplError } = await client.from("crm_email_templates").upsert(templates, { onConflict: "name", ignoreDuplicates: true });

  return new Response(JSON.stringify({ results, tplError }), {
    headers: { "Content-Type": "application/json" }
  });
});
