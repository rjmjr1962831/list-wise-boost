import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const REPO = "rjmjr1962831/list-wise-boost";

async function getFileFromGithub(path: string): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}?ref=staging`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: "application/vnd.github.v3.raw" } }
  );
  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status} ${path}`);
  return await res.text();
}

serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const {
    sequence_id,
    filters,         // { state_slug, email_provider, tier }
    accounts_override,  // "toptenlists" | "all"
    start_date,
  } = body;

  const results: Record<string, any> = {};
  const failures: string[] = [];

  // ── STEP 1: Read sequence-processor and check safeguards ─────────────────
  try {
    const processorCode = await getFileFromGithub(
      "supabase/functions/sequence-processor/index.ts"
    );

    const capMatch = processorCode.match(/PER_INVOCATION_CAP\s*=\s*(\d+)/);
    const startMatch = processorCode.match(/CAMPAIGN_START\s*=\s*new Date\("([^"]+)"\)/);
    const toptenlisLimitMatch = processorCode.match(/toptenlists\.us[\s\S]{0,100}Math\.min\((\d+)/);
    const top10listsLimitMatch = processorCode.match(/top10lists\.us[\s\S]{0,100}Math\.min\((\d+)/);

    const cap = capMatch ? parseInt(capMatch[1]) : null;
    const campaignStart = startMatch ? startMatch[1] : null;

    results.step1_processor = {
      per_invocation_cap: cap,
      cap_ok: cap !== null && cap <= 12,
      campaign_start: campaignStart,
      campaign_start_ok: campaignStart ? new Date(campaignStart) <= new Date() : false,
      daily_limit_toptenlists_start: toptenlisLimitMatch ? parseInt(toptenlisLimitMatch[1]) : "NOT FOUND",
      daily_limit_top10lists_start: top10listsLimitMatch ? parseInt(top10listsLimitMatch[1]) : "NOT FOUND",
    };

    if (!results.step1_processor.cap_ok) {
      failures.push(`STEP 1 FAIL: PER_INVOCATION_CAP is ${cap ?? "MISSING"} — must be ≤ 12. Fix before proceeding.`);
    }
    if (!results.step1_processor.campaign_start_ok) {
      failures.push(`STEP 1 FAIL: CAMPAIGN_START is ${campaignStart ?? "MISSING"} — must be today or in the past.`);
    }
  } catch (e: any) {
    failures.push(`STEP 1 ERROR: Could not read sequence-processor — ${e.message}`);
    results.step1_processor = { error: e.message };
  }

  // ── STEP 2: Confirm cron is OFF ───────────────────────────────────────────
  try {
    const { data: cronJobs } = await supabase
      .from("cron.job" as any)
      .select("jobname, active")
      .eq("jobname", "sequence-processor");

    // Use Management API instead
    const cronRes = await fetch(
      "https://api.supabase.com/v1/projects/wiotrvoirdgzfacuuiem/database/query",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ACCESS_TOKEN") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: "SELECT jobname, active FROM cron.job WHERE jobname = 'sequence-processor';" }),
      }
    );
    const cronData = await cronRes.json();
    const cronActive = Array.isArray(cronData) && cronData.length > 0 && cronData[0].active;

    results.step2_cron = {
      sequence_processor_exists: Array.isArray(cronData) && cronData.length > 0,
      sequence_processor_active: cronActive,
      cron_ok: !cronActive,
    };

    if (cronActive) {
      failures.push("STEP 2 FAIL: sequence-processor cron is ACTIVE. Unschedule it before enrollment.");
    }
  } catch (e: any) {
    results.step2_cron = { error: e.message };
    failures.push(`STEP 2 ERROR: Could not check cron — ${e.message}`);
  }

  // ── STEP 3: Dry-run enrollment ────────────────────────────────────────────
  if (!sequence_id) {
    results.step3_dry_run = "SKIPPED — no sequence_id provided";
    failures.push("STEP 3 SKIPPED: sequence_id required to run dry-run enrollment check.");
  } else {
    try {
      const enrollRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/sequence-enroll`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sequence_id,
            filters: filters || {},
            accounts_override: accounts_override || "toptenlists",
            dry_run: true,
          }),
        }
      );
      const dryRun = await enrollRes.json();
      results.step3_dry_run = dryRun;

      if (dryRun.error) {
        failures.push(`STEP 3 FAIL: Dry-run returned error — ${dryRun.error}`);
      }
    } catch (e: any) {
      results.step3_dry_run = { error: e.message };
      failures.push(`STEP 3 ERROR: ${e.message}`);
    }
  }

  // ── STEP 4: Send math ─────────────────────────────────────────────────────
  const cap = results.step1_processor?.per_invocation_cap;
  const toEnroll = results.step3_dry_run?.to_enroll;
  const perDay = results.step3_dry_run?.per_day;
  const accounts = results.step3_dry_run?.sending_accounts;

  results.step4_send_math = cap && perDay ? {
    emails_per_invocation: cap,
    cron_frequency: "every 5 min",
    max_per_hour: cap * 12,
    daily_cap_per_account: 25,
    total_daily: perDay,
    agents_to_enroll: toEnroll ?? "unknown",
    run_duration_days: toEnroll && perDay ? Math.ceil(toEnroll / perDay) : "unknown",
    sending_accounts: accounts ?? "unknown",
    first_send: start_date || "next cron tick after enrollment",
  } : { note: "Cannot compute — fix steps 1-3 first" };

  // ── Final verdict ─────────────────────────────────────────────────────────
  const allClear = failures.length === 0;

  return new Response(JSON.stringify({
    verdict: allClear ? "✅ ALL CLEAR — awaiting Robert's explicit GO to proceed" : "🚫 BLOCKED — fix failures before proceeding",
    failures,
    results,
    next_step: allClear
      ? "Show this to Robert. Wait for explicit 'go' before enrolling or triggering processor."
      : "Fix all failures listed above. Re-run pre-flight. Do not proceed until all clear.",
  }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
