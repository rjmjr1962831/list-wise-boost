/**
 * Clear all enrollments for the sequence, then rebuild the queue with:
 *   - Active agents in Arizona, private email only, listed tier only
 *   - Excludes anyone we emailed today and people who unsubscribed
 *   - Fields: first_name, last_name, magic_link per enrollment
 *
 * Usage:
 *   npx tsx scripts/sequence-clear-and-rebuild.ts           # clear + rebuild
 *   npx tsx scripts/sequence-clear-and-rebuild.ts --dry-run # report only
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

const base =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://wiotrvoirdgzfacuuiem.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(base, key);
const DRY_RUN = process.argv.includes("--dry-run");

const SENDING_ACCOUNTS = ["robert@toptenlists.us", "hello@toptenlists.us"];
const EMAILS_PER_ACCOUNT_PER_DAY = 25;
const INTERVAL_MINUTES = 5;
const DAILY_START_HOUR_UTC = 12;

function getDayStart(dayOffset: number, baseDate: Date): Date {
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(DAILY_START_HOUR_UTC, 0, 0, 0);
  return d;
}

async function main() {
  const sequenceId = process.env.SEQUENCE_ID || "3bed1ae8-61d9-49d8-8349-610e738c47d2";

  if (!DRY_RUN) {
    // 1) Clear queue for this sequence
    const { count: beforeCount } = await supabase
      .from("crm_sequence_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("sequence_id", sequenceId);

    const { error: deleteError } = await supabase
      .from("crm_sequence_enrollments")
      .delete()
      .eq("sequence_id", sequenceId);

    if (deleteError) {
      console.error("Failed to clear queue:", deleteError.message);
      process.exit(1);
    }
    console.log(`Cleared ${beforeCount ?? 0} enrollments for sequence ${sequenceId}.`);
  }

  // 2) Build list: Arizona, active, private, listed, not unsubscribed
  const { data: agentsRaw, error: agentsError } = await supabase
    .from("professionals")
    .select("id, name, email, verification_token, business_city, state_slug, current_tier")
    .eq("active", true)
    .eq("state_slug", "arizona")
    .eq("email_provider", "private")
    .eq("current_tier", "listed")
    .eq("email_unsubscribed", false)
    .not("email", "is", null)
    .not("verification_token", "is", null)
    .limit(10000);

  if (agentsError) {
    console.error("Failed to fetch agents:", agentsError.message);
    process.exit(1);
  }

  // Exclude: emailed today (any outbound to their address today)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: sentToday } = await supabase
    .from("crm_emails")
    .select("to_address")
    .eq("direction", "outbound")
    .gte("sent_at", todayStart.toISOString());
  const emailedTodaySet = new Set(
    (sentToday ?? []).map((r: { to_address: string }) => (r.to_address ?? "").toLowerCase()).filter(Boolean)
  );

  // Exclude: unsubscribed in this sequence
  const { data: unsubEnrollments } = await supabase
    .from("crm_sequence_enrollments")
    .select("email")
    .eq("sequence_id", sequenceId)
    .eq("status", "unsubscribed");
  const unsubSet = new Set(
    (unsubEnrollments ?? []).map((e: { email: string }) => (e.email ?? "").toLowerCase()).filter(Boolean)
  );

  const agents = (agentsRaw ?? []).filter(
    (a) => !emailedTodaySet.has((a.email ?? "").toLowerCase()) && !unsubSet.has((a.email ?? "").toLowerCase())
  );

  if (DRY_RUN) {
    const perDay = SENDING_ACCOUNTS.length * EMAILS_PER_ACCOUNT_PER_DAY;
    const baseDate = new Date();
    baseDate.setUTCDate(baseDate.getUTCDate() + 1);
    baseDate.setUTCHours(DAILY_START_HOUR_UTC, 0, 0, 0);
    const firstSend = getDayStart(0, baseDate);
    const days = agents.length ? Math.ceil(agents.length / perDay) : 0;
    const lastDayStart = days > 0 ? getDayStart(days - 1, baseDate) : null;
    console.log("--- Dry run: clear + rebuild (Arizona, private, listed) ---");
    console.log("Criteria: active, state_slug=arizona, email_provider=private, current_tier=listed, email_unsubscribed=false");
    console.log(`Total matching: ${agentsRaw?.length ?? 0}`);
    console.log(`Excluded (emailed today): ${(agentsRaw ?? []).filter((a) => emailedTodaySet.has((a.email ?? "").toLowerCase())).length}`);
    console.log(`Excluded (unsubscribed this sequence): ${(agentsRaw ?? []).filter((a) => unsubSet.has((a.email ?? "").toLowerCase())).length}`);
    console.log(`To enroll after exclusions: ${agents.length}`);
    console.log(`Per day: ${perDay}, days to complete: ${days}`);
    if (agents.length && lastDayStart) {
      console.log(`First send: ${firstSend.toISOString()}, last day start: ${lastDayStart.toISOString()}`);
    }
    console.log("Sending accounts:", SENDING_ACCOUNTS.join(", "));
    return;
  }

  if (!agents?.length) {
    console.log("No Arizona agents with private email found. Queue is empty.");
    return;
  }

  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() + 1);
  baseDate.setUTCHours(DAILY_START_HOUR_UTC, 0, 0, 0);
  const perDay = SENDING_ACCOUNTS.length * EMAILS_PER_ACCOUNT_PER_DAY;
  const enrollments: any[] = [];

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const dayOffset = Math.floor(i / perDay);
    const posInDay = i % perDay;
    const accountIndex = posInDay % SENDING_ACCOUNTS.length;
    const slotInDay = Math.floor(posInDay / SENDING_ACCOUNTS.length);
    const dayStart = getDayStart(dayOffset, baseDate);
    const sendTime = new Date(dayStart);
    sendTime.setMinutes(sendTime.getMinutes() + slotInDay * INTERVAL_MINUTES);
    const unsubUrl = `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/unsubscribe?token=${agent.verification_token}`;
    const nameParts = (agent.name ?? "").trim().split(/\s+/);
    const first_name = nameParts[0] ?? "";
    const last_name = nameParts.slice(1).join(" ") ?? "";

    enrollments.push({
      sequence_id: sequenceId,
      professional_id: agent.id,
      email: agent.email,
      first_name,
      status: "active",
      current_step: 0,
      next_send_at: sendTime.toISOString(),
      assigned_account: SENDING_ACCOUNTS[accountIndex],
      metadata: {
        magic_link: `https://www.top10lists.us/funnel/${agent.verification_token}`,
        first_name,
        last_name,
        business_city: agent.business_city ?? "",
        state: "Arizona",
        tier: agent.current_tier ?? "listed",
        unsubscribe_url: unsubUrl,
      },
    });
  }

  // 3) Insert in batches
  let enrolled = 0;
  for (let i = 0; i < enrollments.length; i += 200) {
    const chunk = enrollments.slice(i, i + 200);
    const { data, error: upsertError } = await supabase
      .from("crm_sequence_enrollments")
      .upsert(chunk, { onConflict: "sequence_id,email", ignoreDuplicates: true })
      .select("id");
    if (upsertError) {
      console.error("Upsert error:", upsertError.message);
      process.exit(1);
    }
    enrolled += data?.length ?? 0;
  }

  const firstSend = enrollments[0]?.next_send_at;
  const lastSend = enrollments[enrollments.length - 1]?.next_send_at;
  console.log(`Enrolled ${enrolled} Arizona agents (private email only).`);
  console.log(`First send: ${firstSend}, last: ${lastSend}.`);
  console.log(`Per day: ${perDay}, days to complete: ${Math.ceil(agents.length / perDay)}.`);
}

main();
