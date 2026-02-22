import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });

  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

  const pool = new Pool(dbUrl, 1, true);
  const conn = await pool.connect();
  const results: Record<string, string> = {};

  const ddl = [
    // CRM email tables
    `CREATE TABLE IF NOT EXISTS crm_email_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, display_name text, access_token text, refresh_token text NOT NULL, token_expiry timestamptz, history_id text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS crm_email_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, subject text NOT NULL, body text NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS crm_emails (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gmail_message_id text UNIQUE NOT NULL, gmail_thread_id text NOT NULL, account_email text NOT NULL, direction text NOT NULL CHECK (direction IN ('inbound','outbound')), from_address text NOT NULL, to_address text NOT NULL, cc_address text, subject text, body_html text, body_text text, contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL, sent_at timestamptz NOT NULL, created_at timestamptz DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS crm_emails_thread_idx ON crm_emails(gmail_thread_id)`,
    `CREATE INDEX IF NOT EXISTS crm_emails_contact_idx ON crm_emails(contact_id)`,
    `CREATE INDEX IF NOT EXISTS crm_emails_sent_at_idx ON crm_emails(sent_at DESC)`,
    // Instantly columns on professionals
    `ALTER TABLE professionals ADD COLUMN IF NOT EXISTS instantly_id text`,
    `ALTER TABLE professionals ADD COLUMN IF NOT EXISTS instantly_status text`,
    `ALTER TABLE professionals ADD COLUMN IF NOT EXISTS instantly_last_event_at timestamptz`,
    `CREATE INDEX IF NOT EXISTS professionals_instantly_id_idx ON professionals(instantly_id) WHERE instantly_id IS NOT NULL`,
  ];

  for (const sql of ddl) {
    try {
      await conn.queryObject(sql);
      results[sql.slice(0, 50)] = "OK";
    } catch (e: any) {
      results[sql.slice(0, 50)] = e.message;
    }
  }
  conn.release();
  await pool.end();

  // Seed templates
  await supabase.from("crm_email_templates").upsert([
    { name: "Welcome - Listed", subject: "Welcome to Top10Lists.us, {{first_name}}!", body: "Hi {{first_name}},\n\nCongratulations on your listing on Top10Lists.us. You are now part of the top 0.5% of real estate agents we have analyzed.\n\nYour AI Citability Score is {{aics_score}}/100. Visit your dashboard: {{profile_url}}\n\nBest regards,\nThe Top10Lists Team" },
    { name: "Follow Up", subject: "Following up, {{first_name}}", body: "Hi {{first_name}},\n\nI wanted to follow up on your Top10Lists profile. Your current tier is {{tier}} and your AI Citability Score is {{aics_score}}/100.\n\nVisit your dashboard: {{profile_url}}\n\nBest regards,\nRobert Maynard\nTop10Lists.us" },
    { name: "Tier Upgrade", subject: "Improve your AI visibility, {{first_name}}", body: "Hi {{first_name}},\n\nAs a {{tier}} member in {{city}}, your AI Citability Score is {{aics_score}}/100. Agents who upgrade see substantially higher citation rates.\n\n{{profile_url}}\n\nBest regards,\nRobert Maynard\nTop10Lists.us" },
  ], { onConflict: "name", ignoreDuplicates: true });

  results["templates"] = "seeded";

  return new Response(JSON.stringify({ ok: true, results }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
});
