/**
 * sequencer-v2-tick — Cron Sender edge function for Email Sequencer v2.
 *
 * Runs every 90 seconds via pg_cron. Each invocation picks ONE email per
 * sender account per tick, sends it via Gmail API, and updates state.
 *
 * NOTE: A separate cleanup sweep should reset rows stuck in 'sending' status
 * for more than 5 minutes back to 'approved' (crash recovery).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  injectTracking,
  buildUnsubFooter,
  buildRawMimeMessage,
} from "../_shared/render-email.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;

const TRACK_BASE = "https://www.top10lists.us/api/t";
const SENDER_ACCOUNTS = [
  "hello@toptenlists.us",
  "robert@toptenlists.us",
  "hello@top10lists.us",
  "robert@top10lists.us",
];
const CAMPAIGN_START = new Date("2026-02-24T12:00:00Z"); // 5am MST

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDailyLimit(account: string, daysSinceStart: number): number {
  if (account.endsWith("@toptenlists.us"))
    return Math.min(25 + daysSinceStart * 5, 100);
  if (account.endsWith("@top10lists.us"))
    return Math.min(10 + daysSinceStart * 2, 25);
  return 0;
}

function isInSendWindow(): boolean {
  const mstHour = (new Date().getUTCHours() - 7 + 24) % 24;
  return mstHour >= 8 && mstHour < 17;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// OAuth token management
// ---------------------------------------------------------------------------

async function refreshAccessToken(account: {
  email: string;
  refresh_token: string;
}): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token)
    throw new Error("Token refresh failed: " + JSON.stringify(data));

  const expiry = new Date(
    Date.now() + (data.expires_in || 3600) * 1000
  ).toISOString();
  await supabase
    .from("crm_email_accounts")
    .update({
      access_token: data.access_token,
      token_expiry: expiry,
      updated_at: new Date().toISOString(),
    })
    .eq("email", account.email);

  return data.access_token;
}

async function getValidToken(account: {
  email: string;
  refresh_token: string;
  access_token: string;
  token_expiry: string | null;
}): Promise<string> {
  if (
    !account.token_expiry ||
    new Date(account.token_expiry) < new Date(Date.now() + 60000)
  ) {
    return await refreshAccessToken(account);
  }
  return account.access_token;
}

// ---------------------------------------------------------------------------
// Process one sender account
// ---------------------------------------------------------------------------

interface AccountResult {
  account: string;
  sent: 0 | 1;
  error?: string;
  dailyLimit: number;
  sentToday: number;
}

async function processAccount(senderAccount: string): Promise<AccountResult> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const daysSinceStart = Math.floor(
    (now.getTime() - CAMPAIGN_START.getTime()) / 86400000
  );
  const dailyLimit = getDailyLimit(senderAccount, daysSinceStart);

  const result: AccountResult = {
    account: senderAccount,
    sent: 0,
    dailyLimit,
    sentToday: 0,
  };

  try {
    // --- Get email account credentials ---
    const { data: emailAccount, error: acctErr } = await supabase
      .from("crm_email_accounts")
      .select("*")
      .eq("email", senderAccount)
      .maybeSingle();

    if (acctErr || !emailAccount) {
      result.error = acctErr?.message ?? "Email account not found";
      return result;
    }

    // --- Check daily volume ---
    const { data: volumeRow } = await supabase
      .from("email_send_volume")
      .select("emails_sent")
      .eq("sender_account", senderAccount)
      .eq("send_date", todayStr)
      .maybeSingle();

    const sentToday = volumeRow?.emails_sent ?? 0;
    result.sentToday = sentToday;

    if (sentToday >= dailyLimit) {
      result.error = "Daily limit reached";
      return result;
    }

    // --- Pick ONE approved email ---
    const { data: queueItem, error: queueErr } = await supabase
      .from("email_queue")
      .select("*")
      .eq("sender_account", senderAccount)
      .eq("status", "approved")
      .or(
        "scheduled_at.is.null,scheduled_at.lte." + now.toISOString()
      )
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queueErr) {
      result.error = "Queue query error: " + queueErr.message;
      return result;
    }
    if (!queueItem) {
      result.error = "No approved emails in queue";
      return result;
    }

    // --- Pre-send: check unsubscribes ---
    const { data: unsubRow } = await supabase
      .from("email_unsubscribes")
      .select("id")
      .eq("email", queueItem.recipient_email)
      .maybeSingle();

    if (unsubRow) {
      await supabase
        .from("email_queue")
        .update({ status: "unsubscribed", updated_at: now.toISOString() })
        .eq("id", queueItem.id);
      result.error = "Recipient unsubscribed (global)";
      return result;
    }

    // --- Pre-send: check professionals.email_unsubscribed ---
    if (queueItem.agent_id) {
      const { data: agent } = await supabase
        .from("professionals")
        .select("email_unsubscribed, verification_token")
        .eq("id", queueItem.agent_id)
        .maybeSingle();

      if (agent?.email_unsubscribed === true) {
        await supabase
          .from("email_queue")
          .update({ status: "unsubscribed", updated_at: now.toISOString() })
          .eq("id", queueItem.id);
        result.error = "Recipient unsubscribed (professional)";
        return result;
      }
    }

    // --- Claim the row (optimistic lock) ---
    const { data: claimed, error: claimErr } = await supabase
      .from("email_queue")
      .update({ status: "sending", updated_at: now.toISOString() })
      .eq("id", queueItem.id)
      .eq("status", "approved")
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) {
      result.error = "Failed to claim row (already claimed)";
      return result;
    }

    // --- Refresh Gmail token ---
    const accessToken = await getValidToken(emailAccount);

    // --- Build unsubscribe URL ---
    let unsubUrl: string;
    if (queueItem.agent_id) {
      const { data: agent } = await supabase
        .from("professionals")
        .select("verification_token")
        .eq("id", queueItem.agent_id)
        .maybeSingle();

      if (agent?.verification_token) {
        unsubUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?token=${agent.verification_token}`;
      } else {
        unsubUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(queueItem.recipient_email)}&campaign=${encodeURIComponent(queueItem.campaign_id)}`;
      }
    } else {
      unsubUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?email=${encodeURIComponent(queueItem.recipient_email)}&campaign=${encodeURIComponent(queueItem.campaign_id)}`;
    }

    // --- Build email content with tracking ---
    const unsubFooter = buildUnsubFooter(unsubUrl);
    const trackedHtml = injectTracking(
      queueItem.html_body + unsubFooter.html,
      queueItem.tracking_pixel_id,
      TRACK_BASE
    );
    const plainBody =
      htmlToPlainText(queueItem.html_body) + unsubFooter.plain;

    const rawMessage = buildRawMimeMessage({
      from: senderAccount,
      to: queueItem.recipient_email,
      toName: queueItem.recipient_name ?? undefined,
      subject: queueItem.subject,
      htmlBody: trackedHtml,
      plainBody,
      unsubUrl,
    });

    // --- Send via Gmail API ---
    const sendRes = await fetch(
      "https://www.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: rawMessage }),
      }
    );

    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      const statusCode = sendRes.status;
      const isTransient = statusCode !== 401 && statusCode !== 403;
      const retryCount = (queueItem.retry_count ?? 0) + 1;

      await supabase
        .from("email_queue")
        .update({
          status: isTransient && retryCount < 3 ? "approved" : "failed",
          failed_at: now.toISOString(),
          failure_reason: `Gmail API ${statusCode}: ${errBody.slice(0, 500)}`,
          retry_count: retryCount,
          updated_at: now.toISOString(),
        })
        .eq("id", queueItem.id);

      result.error = `Gmail send failed (${statusCode})`;
      return result;
    }

    const sentData = await sendRes.json();

    // --- Success: update email_queue ---
    await supabase
      .from("email_queue")
      .update({
        status: "sent",
        sent_at: now.toISOString(),
        gmail_message_id: sentData.id ?? null,
        updated_at: now.toISOString(),
      })
      .eq("id", queueItem.id);

    // --- Upsert email_send_volume ---
    const { data: existingVolume } = await supabase
      .from("email_send_volume")
      .select("id, emails_sent")
      .eq("sender_account", senderAccount)
      .eq("send_date", todayStr)
      .maybeSingle();

    if (existingVolume) {
      await supabase
        .from("email_send_volume")
        .update({
          emails_sent: existingVolume.emails_sent + 1,
        })
        .eq("id", existingVolume.id);
    } else {
      await supabase.from("email_send_volume").insert({
        sender_account: senderAccount,
        send_date: todayStr,
        emails_sent: 1,
        daily_limit: dailyLimit,
      });
    }

    // --- Increment campaign total_sent ---
    if (queueItem.campaign_id) {
      const { data: campaign } = await supabase
        .from("email_campaigns")
        .select("total_sent")
        .eq("id", queueItem.campaign_id)
        .maybeSingle();

      if (campaign) {
        await supabase
          .from("email_campaigns")
          .update({ total_sent: (campaign.total_sent ?? 0) + 1 })
          .eq("id", queueItem.campaign_id);
      }
    }

    // --- Log to crm_contact_activity ---
    if (queueItem.agent_id) {
      await supabase.from("crm_contact_activity").insert({
        professional_id: queueItem.agent_id,
        activity_type: "email_sent",
        description: `Sent campaign email: ${queueItem.subject}`,
        metadata: {
          campaign_id: queueItem.campaign_id,
          queue_id: queueItem.id,
          gmail_message_id: sentData.id,
          sender: senderAccount,
        },
        created_at: now.toISOString(),
      });

      // --- Update lead_status to "warm" if cold/null ---
      const { data: prof } = await supabase
        .from("professionals")
        .select("lead_status")
        .eq("id", queueItem.agent_id)
        .maybeSingle();

      if (
        prof &&
        (prof.lead_status === null ||
          prof.lead_status === "cold" ||
          prof.lead_status === "")
      ) {
        await supabase
          .from("professionals")
          .update({ lead_status: "warm" })
          .eq("id", queueItem.agent_id);
      }
    }

    result.sent = 1;
    result.sentToday = sentToday + 1;
    return result;
  } catch (err: unknown) {
    result.error =
      err instanceof Error ? err.message : "Unknown error: " + String(err);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (_req: Request) => {
  const startTime = Date.now();

  // Check send window
  if (!isInSendWindow()) {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Outside send window (8am-5pm MST)",
        results: [],
        elapsed_ms: Date.now() - startTime,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Process all sender accounts in parallel
  const results = await Promise.all(
    SENDER_ACCOUNTS.map((account) => processAccount(account))
  );

  return new Response(
    JSON.stringify({
      success: true,
      results,
      elapsed_ms: Date.now() - startTime,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
