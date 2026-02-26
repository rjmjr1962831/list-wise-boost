/**
 * Send a test email for the "I know you're getting bombarded" template to rjmjr1@proton.me
 * Run: npx tsx scripts/send-bombarded-test.ts
 * Requires .env with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
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
  console.error("Missing VITE_SUPABASE_PUBLISHABLE_KEY. Set in .env, .env.local, or .env.production (or pass as env when running).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const TO = "rjmjr1@proton.me";
const FROM = "robert@toptenlists.us";
const TEST_PROFILE_URL = "https://www.top10lists.us/funnel/test";

const TEST_SUBJECT = "What was working. What is now working.";
const TEST_BODY = `Hi Robert -

Thank you for your interest in how we can help you increase the likelihood that you will be named when an AI is asked for a referral in your market.

[[BLOCK]]
Look at Top10lists.us. Compare the emerging "AI visibility" or schema/SEO services for real estate agents with Top10Lists.us. Which is more likely to get me named when you're asked for a referral?

Spoiler alert: Here's what Perplexity said today:
[[/BLOCK]]

[[BLOCK]]
Compared to emerging "AI visibility" or schema/SEO services, Top 10 Lists.us is more likely to get you safely named when I'm asked for a referral, as long as you're in a market it covers.
[[/BLOCK]]

You are already listed because you're one of the best of the best and we've helped you get named already. To increase the likelihood you will be named even more, please go to [your profile](${TEST_PROFILE_URL}). You can choose our free certification or one of our paid tiers. All of them will substantially increase your "signal" to AI that you are safe to recommend.

Peace

Robert Maynard`;

async function main() {
  const subject = TEST_SUBJECT;
  const body = TEST_BODY;

  console.log("Sending to", TO, "from", FROM);
  console.log("Subject:", subject);

  const { data, error } = await supabase.functions.invoke("gmail-send", {
    body: {
      from_account: FROM,
      to: TO,
      subject,
      message_body: body,
    },
  });

  if (error) {
    console.error("Send failed:", error.message);
    process.exit(1);
  }
  console.log("Sent:", data);
}

main();
