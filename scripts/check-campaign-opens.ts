/**
 * Check opens for campaign-life-lock emails.
 * Run: npx tsx scripts/check-campaign-opens.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const env = readFileSync(envPath, "utf-8");
  for (const line of env.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnv();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from("crm_emails")
    .select("id, to_address, account_email, sent_at, opened_at, clicked_at")
    .eq("campaign_id", "life_lock_cofounder_2026")
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as { to_address: string; account_email: string; sent_at: string; opened_at: string | null; clicked_at: string | null }[];
  const opens = rows.filter((r) => r.opened_at);
  const clicks = rows.filter((r) => r.clicked_at);

  console.log(`Campaign life_lock_cofounder_2026:`);
  console.log(`  Sent: ${rows.length}`);
  console.log(`  Opens: ${opens.length}`);
  console.log(`  Clicks: ${clicks.length}`);
  if (opens.length) {
    console.log(`\n  Opened:`);
    opens.forEach((r) => console.log(`    ${r.to_address} (${r.account_email}) @ ${r.opened_at}`));
  }
  if (clicks.length) {
    console.log(`\n  Clicked:`);
    clicks.forEach((r) => console.log(`    ${r.to_address} (${r.account_email}) @ ${r.clicked_at}`));
  }
}

main();
