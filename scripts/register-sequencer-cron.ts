/**
 * Register sequencer-v2-tick pg_cron job via run_sql RPC.
 * Usage: npx tsx scripts/register-sequencer-cron.ts
 */

const SUPABASE_URL = "https://wiotrvoirdgzfacuuiem.supabase.co";

// Load .env manually
import { readFileSync } from "fs";
const envContent = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
}
const SERVICE_ROLE_KEY = envVars["SUPABASE_SERVICE_ROLE_KEY"] || envVars["SERVICE_ROLE_KEY"];

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

async function runSql(query: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_sql`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("SQL error:", JSON.stringify(data));
    throw new Error("SQL failed");
  }
  return data;
}

async function main() {
  console.log("Registering sequencer-v2-tick cron...");

  // Remove old crons (ignore errors if they don't exist)
  try {
    await runSql("SELECT cron.unschedule('sequence-processor-cron')");
    console.log("Removed old sequence-processor-cron");
  } catch { console.log("sequence-processor-cron not found (OK)"); }

  try {
    await runSql("SELECT cron.unschedule('sequence-processor')");
    console.log("Removed old sequence-processor");
  } catch { console.log("sequence-processor not found (OK)"); }

  // Register new cron
  const cronSql = `
    SELECT cron.schedule(
      'sequencer-v2-tick',
      '*/2 * * * *',
      $CRON$
      SELECT net.http_post(
        url := 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/sequencer-v2-tick',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
      $CRON$
    );
  `;

  const result = await runSql(cronSql);
  console.log("Cron registered:", JSON.stringify(result));

  // Verify
  const jobs = await runSql("SELECT jobname, schedule, active FROM cron.job ORDER BY jobname");
  console.log("\nAll pg_cron jobs:");
  if (Array.isArray(jobs)) {
    for (const job of jobs) {
      console.log(`  ${job.jobname}: ${job.schedule} (active: ${job.active})`);
    }
  } else {
    console.log(JSON.stringify(jobs, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
