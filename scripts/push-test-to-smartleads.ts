/**
 * Push Robert's test record into Smartlead.
 * Run: npx tsx scripts/push-test-to-smartleads.ts
 * Optional: SMARTLEADS_CAMPAIGN_ID=123 to target a specific campaign (otherwise uses first).
 * Requires .env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 * Edge function sync-crm-to-smartleads must be deployed with SMARTLEADS_API_KEY (or vault secret).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(): void {
  const candidates = [".env", ".env.local", ".env.production"];
  const cwd = process.cwd();
  for (const name of candidates) {
    const envPath = resolve(cwd, name);
    if (!existsSync(envPath)) continue;
    try {
      const env = readFileSync(envPath, "utf-8");
      for (const line of env.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    } catch (_) {}
  }
}
loadEnv();

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://wiotrvoirdgzfacuuiem.supabase.co";
const SUPABASE_ANON =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_ANON) {
  console.error("Missing VITE_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const PROFESSIONAL_ID = "20e0b7f2-5652-424a-9d46-ba74a19cd9a8"; // Robert Maynard test
const CAMPAIGN_ID_OVERRIDE = process.env.SMARTLEADS_CAMPAIGN_ID;

async function main() {
  console.log("Test professional:", PROFESSIONAL_ID);

  // 1. List campaigns (or use override)
  let campaignId = CAMPAIGN_ID_OVERRIDE;
  if (!campaignId) {
    const listRes = await fetch(
      `${SUPABASE_URL}/functions/v1/sync-crm-to-smartleads`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ list_campaigns: true }),
      }
    );
    const listData = await listRes.json().catch(() => ({}));
    if (!listRes.ok) {
      console.error("List campaigns failed:", listRes.status, JSON.stringify(listData, null, 2));
      process.exit(1);
    }
    const campaigns = (listData as { campaigns?: unknown[] })?.campaigns ?? [];
    if (campaigns.length === 0) {
      console.error("No Smartlead campaigns found. Create one in Smartlead or set SMARTLEADS_CAMPAIGN_ID.");
      process.exit(1);
    }
    // Smartlead campaign objects: id or campaign_id
    const first = campaigns[0] as { id?: number; campaign_id?: number; name?: string };
    campaignId = String(first.id ?? first.campaign_id ?? campaigns[0]);
    console.log("Using first campaign:", campaignId, first.name ? `(${first.name})` : "");
  } else {
    console.log("Using SMARTLEADS_CAMPAIGN_ID:", campaignId);
  }

  // 2. Push test record
  const pushRes = await fetch(
    `${SUPABASE_URL}/functions/v1/sync-crm-to-smartleads`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ professional_id: PROFESSIONAL_ID, campaign_id: campaignId }),
    }
  );
  const data = await pushRes.json().catch(() => ({}));
  if (!pushRes.ok) {
    console.error("Push failed:", pushRes.status, JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log("Result:", JSON.stringify(data, null, 2));
  if ((data as { success?: boolean })?.success) {
    console.log("Test record pushed to Smartlead successfully.");
  }
}

main();
