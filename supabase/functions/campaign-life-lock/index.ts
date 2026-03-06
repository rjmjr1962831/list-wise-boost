import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SEND_TEMPLATE_URL = `${SUPABASE_URL}/functions/v1/send-template`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CAMPAIGN_ID = "life_lock_cofounder_2026";
const TEMPLATE_NAME = "I am the Cofounder of LifeLock";
const ACCOUNTS = ["hello@toptenlists.us", "robert@toptenlists.us"];
const MAX_SENDS_PER_ACCOUNT_PER_RUN = 1;
const DAILY_LIMIT_PER_ACCOUNT = 50;

/** Start of current "MST day" in UTC: 12:00 UTC (5am MST) on or before now. */
function getMSTDayStart(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(12, 0, 0, 0);
  if (now.getTime() < d.getTime()) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

async function getSentTodayCount(account: string): Promise<number> {
  const todayStart = getMSTDayStart(new Date());
  const { count } = await supabase
    .from("crm_emails")
    .select("id", { count: "exact", head: true })
    .eq("account_email", account)
    .eq("direction", "outbound")
    .eq("campaign_id", CAMPAIGN_ID)
    .gte("sent_at", todayStart.toISOString());
  return count ?? 0;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = !!body?.dry_run;

  const now = new Date();
  const nowISO = now.toISOString();

  // Pending tasks: status=pending, task_type != 'email_bounced', (due_at is null or due_at <= now)
  const { data: tasks } = await supabase
    .from("crm_tasks")
    .select("id, professional_id")
    .eq("status", "pending")
    .neq("task_type", "email_bounced")
    .or(`due_at.is.null,due_at.lte.${nowISO}`)
    .order("created_at", { ascending: true });

  if (!tasks?.length) {
    return new Response(JSON.stringify({ sent: 0, message: "No pending tasks" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Already sent LifeLock campaign to these professionals
  const { data: alreadySent } = await supabase
    .from("crm_emails")
    .select("professional_id")
    .eq("campaign_id", CAMPAIGN_ID)
    .not("professional_id", "is", null);
  const sentProIds = new Set((alreadySent ?? []).map((r: any) => r.professional_id).filter(Boolean));

  // Dedupe by professional_id (once per professional)
  const seenPro = new Set<string>();
  const eligible: { id: string; professional_id: string }[] = [];
  for (const t of tasks) {
    const pid = t.professional_id;
    if (!pid || sentProIds.has(pid) || seenPro.has(pid)) continue;
    seenPro.add(pid);
    eligible.push(t);
  }

  if (!eligible.length) {
    return new Response(JSON.stringify({ sent: 0, message: "No eligible professionals" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { account: string; sent: number; error?: string }[] = [];
  let totalSent = 0;
  const usedProIdsThisRun = new Set<string>();

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];
    const sentToday = await getSentTodayCount(account);
    const remaining = DAILY_LIMIT_PER_ACCOUNT - sentToday;
    if (remaining <= 0) {
      results.push({ account, sent: 0, error: `Daily limit reached (${sentToday}/${DAILY_LIMIT_PER_ACCOUNT})` });
      continue;
    }

    const limitThisRun = Math.min(remaining, MAX_SENDS_PER_ACCOUNT_PER_RUN);
    const candidates = eligible.filter((e) => !usedProIdsThisRun.has(e.professional_id));
    if (!candidates.length || limitThisRun <= 0) {
      results.push({ account, sent: 0 });
      continue;
    }

    const task = candidates[0];
    usedProIdsThisRun.add(task.professional_id);
    const { data: pro } = await supabase
      .from("professionals")
      .select("id, email, name")
      .eq("id", task.professional_id)
      .single();

    if (!pro?.email || pro.email === "pending@123.com") {
      results.push({ account, sent: 0, error: `No valid email for pro ${task.professional_id}` });
      continue;
    }

    if (dryRun) {
      results.push({
        account,
        sent: 1,
        would_send_to: pro.email,
        professional_id: task.professional_id,
        professional_name: pro.name,
      } as any);
      totalSent++;
      continue;
    }

    try {
      const sendRes = await fetch(SEND_TEMPLATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          template_name: TEMPLATE_NAME,
          professional_id: task.professional_id,
          from_account: account,
          campaign_id: CAMPAIGN_ID,
        }),
      });

      const sendResult = await sendRes.json();
      if ((sendResult as any).error) {
        results.push({ account, sent: 0, error: (sendResult as any).error });
        continue;
      }

      totalSent++;
      results.push({ account, sent: 1 });

      // Mark task completed, create follow-up in 2 days
      await supabase
        .from("crm_tasks")
        .update({ status: "completed", completed_at: nowISO })
        .eq("id", task.id);

      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + 2);
      dueAt.setHours(12, 0, 0, 0);

      await supabase
        .from("crm_tasks")
        .delete()
        .eq("professional_id", task.professional_id)
        .eq("task_type", "follow_up");

      await supabase.from("crm_tasks").insert({
        professional_id: task.professional_id,
        task_type: "follow_up",
        title: `Follow up: ${pro.name ?? "Contact"}`,
        description: `Due in 2 days. Follow-up after LifeLock campaign email.`,
        status: "pending",
        priority: "normal",
        due_at: dueAt.toISOString(),
      });
    } catch (e: any) {
      results.push({ account, sent: 0, error: e?.message ?? "Send failed" });
    }
  }

  return new Response(
    JSON.stringify({
      dry_run: dryRun,
      sent: totalSent,
      results,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
});
