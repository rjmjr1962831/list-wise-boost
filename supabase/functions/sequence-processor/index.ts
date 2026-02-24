import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;
const TRACK_BASE = `${SUPABASE_URL}/functions/v1/email-track`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// HARD DAILY LIMITS - checked against actual crm_emails counts
// ============================================================
// Campaign start date: Feb 25, 2026 (reset after emergency stop)
const CAMPAIGN_START = new Date("2026-02-25T00:00:00Z");

function getDailyLimit(account: string): number {
  const now = new Date();
  const dayNum = Math.floor((now.getTime() - CAMPAIGN_START.getTime()) / 86400000) + 1;
  if (dayNum < 1) return 0; // before campaign starts

  if (account.endsWith("@toptenlists.us")) {
    // Start 25, +5/day, max 50
    return Math.min(25 + (dayNum - 1) * 5, 50);
  }
  if (account.endsWith("@top10lists.us")) {
    // Start 10, +2/day, max 25
    return Math.min(10 + (dayNum - 1) * 2, 25);
  }
  return 0;
}

async function getSentTodayCount(account: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("crm_emails")
    .select("id", { count: "exact", head: true })
    .eq("account_email", account)
    .eq("direction", "outbound")
    .gte("sent_at", todayStart.toISOString());
  return count || 0;
}

// ============================================================
// Token management
// ============================================================
async function refreshAccessToken(account: any): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: account.refresh_token, grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  const expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await supabase.from("crm_email_accounts").update({
    access_token: data.access_token, token_expiry: expiry, updated_at: new Date().toISOString(),
  }).eq("email", account.email);
  return data.access_token;
}

async function getValidToken(account: any): Promise<string> {
  if (!account.token_expiry || new Date(account.token_expiry) < new Date(Date.now() + 60000)) {
    return await refreshAccessToken(account);
  }
  return account.access_token;
}

// ============================================================
// Email building with tracking
// ============================================================
function textToHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

function injectTracking(html: string, emailId: string): string {
  const tracked = html.replace(/href="(https?:\/\/[^"]+)"/g, (_m: string, url: string) => {
    return `href="${TRACK_BASE}?t=c&eid=${encodeURIComponent(emailId)}&url=${encodeURIComponent(url)}"`;
  });
  return tracked + `<img src="${TRACK_BASE}?t=o&eid=${encodeURIComponent(emailId)}" width="1" height="1" style="display:none" alt="">`;
}

function buildRawEmail(from: string, to: string, subject: string, bodyText: string, trackingId: string, unsubUrl?: string): string {
  const boundary = `b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const baseHtml = textToHtml(bodyText.replace(/\n\n---\nUnsubscribe:.*$/, ""));
  const unsubHtml = unsubUrl ? `<br><br><hr style="border:none;border-top:1px solid #ccc;margin-top:20px;"><p style="font-size:13px;color:#555;margin-top:12px;"><a href="${unsubUrl}" style="color:#555;text-decoration:underline;">Unsubscribe</a></p>` : "";
  const bodyHtml = injectTracking(baseHtml + unsubHtml, trackingId);
  const headers = [
    `From: Robert Maynard <${from}>`, `To: ${to}`, `Subject: ${subject}`,
    "MIME-Version: 1.0", `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (unsubUrl) headers.push(`List-Unsubscribe: <${unsubUrl}>`);
  const lines = [
    ...headers,
    "", `--${boundary}`, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64",
    "", btoa(unescape(encodeURIComponent(bodyText))),
    "", `--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64",
    "", btoa(unescape(encodeURIComponent(bodyHtml))),
    "", `--${boundary}--`,
  ];
  return btoa(unescape(encodeURIComponent(lines.join("\r\n"))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ============================================================
// Main processor
// ============================================================
serve(async (req) => {
  const startTime = Date.now();
  const results: any[] = [];

  const accounts = [
    "hello@toptenlists.us", "robert@toptenlists.us",
  ];

  const { data: accountRecords } = await supabase
    .from("crm_email_accounts")
    .select("*")
    .in("email", accounts);

  if (!accountRecords?.length) {
    return new Response(JSON.stringify({ error: "No accounts found" }), { status: 500 });
  }

  let totalSent = 0;
  let totalErrors = 0;

  for (const account of accountRecords) {
    const dailyLimit = getDailyLimit(account.email);
    const sentToday = await getSentTodayCount(account.email);
    const remaining = dailyLimit - sentToday;

    if (remaining <= 0) {
      results.push({
        account: account.email, sent: 0,
        message: `Daily limit reached (${sentToday}/${dailyLimit})`,
      });
      continue;
    }

    // Get due enrollments, limited to remaining daily budget
    const { data: enrollments } = await supabase
      .from("crm_sequence_enrollments")
      .select("*, crm_sequences(name)")
      .eq("assigned_account", account.email)
      .eq("status", "active")
      .lte("next_send_at", new Date().toISOString())
      .order("next_send_at", { ascending: true })
      .limit(remaining);

    if (!enrollments?.length) {
      results.push({
        account: account.email, sent: 0,
        message: `Nothing due (${sentToday}/${dailyLimit} sent today)`,
      });
      continue;
    }

    let token: string;
    try {
      token = await getValidToken(account);
    } catch (e) {
      results.push({ account: account.email, error: `Token error: ${e}` });
      totalErrors++;
      continue;
    }

    const accountSent: string[] = [];
    let accountErrors = 0;

    for (const enrollment of enrollments) {
      // Double-check daily limit before each send
      const currentSent = sentToday + accountSent.length;
      if (currentSent >= dailyLimit) {
        break;
      }

      const { data: pro } = await supabase
        .from("professionals")
        .select("email, name, magic_link, state_slug, verification_token")
        .eq("id", enrollment.professional_id)
        .single();

      if (!pro?.email || pro.email === "pending@123.com") {
        await supabase.from("crm_sequence_enrollments").update({
          status: "disabled", metadata: { reason: "no_valid_email" },
        }).eq("id", enrollment.id);
        continue;
      }

      const { data: step } = await supabase
        .from("crm_sequence_steps")
        .select("*")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_number", enrollment.current_step + 1)
        .maybeSingle();

      if (!step) {
        await supabase.from("crm_sequence_enrollments").update({
          status: "completed", completed_at: new Date().toISOString(),
        }).eq("id", enrollment.id);
        continue;
      }

      const firstName = enrollment.first_name || (pro.name || "").split(" ")[0] || "there";
      const magicLink = pro.magic_link || "https://www.top10lists.us";
      const stateName = (pro.state_slug || "your state").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const unsubUrl = pro.verification_token ? `${SUPABASE_URL}/functions/v1/unsubscribe?token=${pro.verification_token}` : "";
      const subject = (step.subject || "")
        .replace(/\{\{firstName\}\}/g, firstName)
        .replace(/\{\{magicLink\}\}/g, magicLink)
        .replace(/\{\{magic_link\}\}/g, magicLink)
        .replace(/\{\{state\}\}/g, stateName);
      const bodyRaw = (step.body || "")
        .replace(/\{\{firstName\}\}/g, firstName)
        .replace(/\{\{magicLink\}\}/g, magicLink)
        .replace(/\{\{magic_link\}\}/g, magicLink)
        .replace(/\{\{state\}\}/g, stateName);
      const body = unsubUrl
        ? bodyRaw + `\n\n---\nUnsubscribe: ${unsubUrl}`
        : bodyRaw;

      try {
        const trackingId = crypto.randomUUID();
        const raw = buildRawEmail(account.email, pro.email, subject, body, trackingId, unsubUrl || undefined);

        const sendRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });

        const sent = await sendRes.json();

        if (sent.error) {
          console.error(`Send failed for ${pro.email}: ${sent.error.message}`);
          accountErrors++;
          totalErrors++;
          if (sent.error.code === 401 || sent.error.code === 403) {
            results.push({ account: account.email, error: `Auth error: ${sent.error.message}`, sent: accountSent.length });
            break;
          }
          continue;
        }

        // Log email
        await supabase.from("crm_emails").insert({
          gmail_message_id: trackingId,
          gmail_thread_id: sent.threadId || sent.id,
          account_email: account.email,
          direction: "outbound",
          from_address: account.email,
          to_address: pro.email,
          subject, body_text: body,
          sent_at: new Date().toISOString(),
        });

        // Advance enrollment
        const { data: nextStep } = await supabase
          .from("crm_sequence_steps")
          .select("step_number, delay_days")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_number", enrollment.current_step + 2)
          .maybeSingle();

        if (nextStep) {
          const nextSend = new Date();
          nextSend.setDate(nextSend.getDate() + (nextStep.delay_days || 1));
          nextSend.setUTCHours(12, 0, 0, 0);
          await supabase.from("crm_sequence_enrollments").update({
            current_step: enrollment.current_step + 1,
            next_send_at: nextSend.toISOString(),
          }).eq("id", enrollment.id);
        } else {
          await supabase.from("crm_sequence_enrollments").update({
            current_step: enrollment.current_step + 1,
            status: "completed",
            completed_at: new Date().toISOString(),
          }).eq("id", enrollment.id);
        }

        accountSent.push(pro.email);
        totalSent++;

        // 5 second pause between sends
        await new Promise(r => setTimeout(r, 5000));

      } catch (e) {
        console.error(`Exception sending to ${pro.email}:`, e);
        accountErrors++;
        totalErrors++;
      }
    }

    results.push({
      account: account.email,
      sent: accountSent.length,
      errors: accountErrors,
      dailyLimit,
      sentToday: sentToday + accountSent.length,
    });
  }

  return new Response(JSON.stringify({
    success: true, totalSent, totalErrors,
    elapsed_ms: Date.now() - startTime,
    accounts: results,
  }), { headers: { "Content-Type": "application/json" } });
});
