/**
 * Send a test email using the send-template edge function.
 * Template: "I know you're getting bombarded" (from crm_email_templates)
 * To: rjmjr1@proton.me (to_override)
 * Professional: Robert's test record (handoff doc)
 * Run: npx tsx scripts/send-template-test.ts
 */
import { createClient } from "@supabase/supabase-js";
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co";
const SUPABASE_ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!SUPABASE_ANON) {
  console.error("Missing VITE_SUPABASE_PUBLISHABLE_KEY in .env / .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const TEMPLATE_NAME = "I know you're getting bombarded";
const PROFESSIONAL_ID = "20e0b7f2-5652-424a-9d46-ba74a19cd9a8";
const TO_OVERRIDE = "rjmjr1@proton.me";

async function main() {
  console.log("Sending template:", TEMPLATE_NAME);
  console.log("Professional id:", PROFESSIONAL_ID);
  console.log("To (override):", TO_OVERRIDE);

  const { data, error } = await supabase.functions.invoke("send-template", {
    body: {
      template_name: TEMPLATE_NAME,
      professional_id: PROFESSIONAL_ID,
      to_override: TO_OVERRIDE,
      from_account: "robert@toptenlists.us",
    },
  });

  if (error) {
    console.error("Send failed:", error.message);
    process.exit(1);
  }
  console.log("Result:", JSON.stringify(data, null, 2));
}

main();
