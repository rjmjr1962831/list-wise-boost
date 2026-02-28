import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const SENDING_ACCOUNTS = [
  "robert@top10lists.us",
  "hello@top10lists.us",
  "robert@toptenlists.us",
  "hello@toptenlists.us",
];

const EMAILS_PER_ACCOUNT_PER_DAY = 25;
const INTERVAL_MINUTES = 5;

// 5am MST = UTC-7 = 12:00 UTC
const DAILY_START_HOUR_UTC = 12;

function getDayStart(dayOffset: number, baseDate: Date): Date {
  const d = new Date(baseDate);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(DAILY_START_HOUR_UTC, 0, 0, 0);
  return d;
}

serve(async (req) => {
  try {
    const { sequence_id, filters, dry_run = false, start_date } = await req.json();

    if (!sequence_id) return new Response(JSON.stringify({ error: "sequence_id required" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });

    // Build agent query
    let query = supabase
      .from("professionals")
      .select("id, name, email, verification_token, business_city, state_slug, current_tier")
      .eq("active", true)
      .eq("email_unsubscribed", false)
      .not("email", "is", null)
      .not("verification_token", "is", null);

    if (filters?.state_slug) query = query.eq("state_slug", filters.state_slug);
    if (filters?.tier) query = query.eq("current_tier", filters.tier);
    if (filters?.city) query = query.eq("business_city", filters.city);

    const { data: agents, error } = await query.limit(10000);
    if (error) throw error;

    // Filter out already enrolled
    const { data: alreadyEnrolled } = await supabase
      .from("crm_sequence_enrollments")
      .select("email")
      .eq("sequence_id", sequence_id);

    const enrolledEmails = new Set((alreadyEnrolled ?? []).map((e: any) => e.email));
    const newAgents = (agents ?? []).filter(a => !enrolledEmails.has(a.email));

    if (dry_run) {
      const perDay = SENDING_ACCOUNTS.length * EMAILS_PER_ACCOUNT_PER_DAY;
      return new Response(JSON.stringify({
        dry_run: true,
        total_agents: agents?.length ?? 0,
        already_enrolled: enrolledEmails.size,
        to_enroll: newAgents.length,
        per_day: perDay,
        days_to_complete: Math.ceil(newAgents.length / perDay),
      }), { headers: { "Content-Type": "application/json" } });
    }

    // Base date -- provided or tomorrow 5am MST
    const baseDate = start_date ? new Date(start_date) : getDayStart(0, new Date());

    // Schedule: each slot = 5 min window, 4 accounts send in parallel per slot
    // slot 0 = 05:00, slot 1 = 05:05 ... slot 24 = 07:00
    // day 0: agents 0-99, day 1: agents 100-199, etc.
    const perDay = SENDING_ACCOUNTS.length * EMAILS_PER_ACCOUNT_PER_DAY;

    const enrollments: any[] = [];
    for (let i = 0; i < newAgents.length; i++) {
      const agent = newAgents[i];
      const dayOffset = Math.floor(i / perDay);
      const posInDay = i % perDay;
      const accountIndex = posInDay % SENDING_ACCOUNTS.length;
      const slotInDay = Math.floor(posInDay / SENDING_ACCOUNTS.length);

      const dayStart = getDayStart(dayOffset, baseDate);
      const sendTime = new Date(dayStart);
      sendTime.setMinutes(sendTime.getMinutes() + slotInDay * INTERVAL_MINUTES);

      const unsubUrl = `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/unsubscribe?token=${agent.verification_token}`;

      enrollments.push({
        sequence_id,
        professional_id: agent.id,
        email: agent.email,
        first_name: agent.name?.split(" ")[0] ?? "",
        status: "active",
        current_step: 0,
        next_send_at: sendTime.toISOString(),
        assigned_account: SENDING_ACCOUNTS[accountIndex],
        metadata: {
          magic_link: `https://www.top10lists.us/funnel/${agent.verification_token}`,
          business_city: agent.business_city ?? "",
          state: agent.state_slug === "arizona" ? "Arizona" : "California",
          tier: agent.current_tier ?? "listed",
          unsubscribe_url: unsubUrl,
        }
      });
    }

    // Upsert in batches of 200
    let enrolled = 0;
    for (let i = 0; i < enrollments.length; i += 200) {
      const chunk = enrollments.slice(i, i + 200);
      const { data, error: upsertError } = await supabase
        .from("crm_sequence_enrollments")
        .upsert(chunk, { onConflict: "sequence_id,email", ignoreDuplicates: true })
        .select("id");
      if (upsertError) throw upsertError;
      enrolled += data?.length ?? 0;
    }

    const lastSend = enrollments[enrollments.length - 1]?.next_send_at;
    const firstSend = enrollments[0]?.next_send_at;

    return new Response(JSON.stringify({
      ok: true,
      enrolled,
      per_day: perDay,
      days_to_complete: Math.ceil(newAgents.length / perDay),
      first_send: firstSend,
      last_send: lastSend,
      accounts: SENDING_ACCOUNTS,
    }), { headers: { "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
