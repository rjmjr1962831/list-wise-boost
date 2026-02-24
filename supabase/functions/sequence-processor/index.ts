import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TRACK_BASE = `${SUPABASE_URL}/functions/v1/email-track`;
const GMAIL_CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const GMAIL_CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Throttle: max sends per invocation per account
const MAX_PER_ACCOUNT_PER_RUN = 10;

async function refreshAccessToken(account: any): Promise<string> {
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
  if (data.error) throw new Error(`Token refresh failed: ${data.error}`);
  const expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
  await supabase.from("crm_email_accounts").update({
    access_token: data.access_token,
    token_expiry: expiry,
    updated_at: new Date().toISOString(),
  }).eq("email", account.email);
  return data.access_token;
}

async function getValidToken(account: any): Promise<string> {
  if (!account.token_expiry || new Date(account.token_expiry) < new Date(Date.now() + 60000)) {
    return await refreshAccessToken(account);
  }
  return account.access_token;
}

function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
}

function injectTracking(html: string, emailId: string): string {
  const tracked = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match: string, url: string) => {
      const trackUrl = `${TRACK_BASE}?t=c&eid=${encodeURIComponent(emailId)}&url=${encodeURIComponent(url)}`;
      return `href="${trackUrl}"`;
    }
  );
  const pixel = `<img src="${TRACK_BASE}?t=o&eid=${encodeURIComponent(emailId)}" width="1" height="1" style="display:none" alt="">`;
  return tracked + pixel;
}

function buildRawEmail(from: string, to: string, subject: string, bodyText: string, trackingId: string): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const bodyHtml = injectTracking(textToHtml(bodyText), trackingId);
  const lines = [
    `From: Robert Maynard <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(bodyText))),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(bodyHtml))),
    "",
    `--${boundary}--`,
  ];
  const raw = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  const startTime = Date.now();
  const results: any[] = [];
  let totalSent = 0;
  let totalErrors = 0;

  try {
    // Get active accounts (toptenlists.us only)
    const { data: accounts } = await supabase
      .from("crm_email_accounts")
      .select("*")
      .in("email", ["hello@toptenlists.us", "robert@toptenlists.us", "hello@top10lists.us", "robert@top10lists.us"]);

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ error: "No active accounts" }), { status: 500 });
    }

    for (const account of accounts) {
      const accountSent: string[] = [];
      let accountErrors = 0;

      // Get enrollments ready to send for this account
      const { data: enrollments } = await supabase
        .from("crm_sequence_enrollments")
        .select("*, crm_sequences(name), professional:professional_id(name, email, magic_link)")
        .eq("status", "active")
        .eq("assigned_account", account.email)
        .lte("next_send_at", new Date().toISOString())
        .order("next_send_at", { ascending: true })
        .limit(MAX_PER_ACCOUNT_PER_RUN);

      if (!enrollments || enrollments.length === 0) {
        results.push({ account: account.email, sent: 0, message: "Nothing due" });
        continue;
      }

      let token: string;
      try {
        token = await getValidToken(account);
      } catch (e: any) {
        results.push({ account: account.email, error: e.message });
        continue;
      }

      for (const enrollment of enrollments) {
        // Get the step template
        const { data: step } = await supabase
          .from("crm_sequence_steps")
          .select("*")
          .eq("sequence_id", enrollment.sequence_id)
          .eq("step_number", enrollment.current_step)
          .single();

        if (!step) {
          // No more steps - mark completed
          await supabase.from("crm_sequence_enrollments").update({
            status: "completed",
            completed_at: new Date().toISOString(),
          }).eq("id", enrollment.id);
          continue;
        }

        const pro = enrollment.professional as any;
        if (!pro?.email || pro.email === "pending@123.com") {
          await supabase.from("crm_sequence_enrollments").update({
            status: "disabled",
            metadata: { reason: "no_valid_email" },
          }).eq("id", enrollment.id);
          continue;
        }

        // Replace template variables
        const firstName = enrollment.first_name || (pro.name || "").split(" ")[0] || "there";
        const magicLink = pro.magic_link || "https://www.top10lists.us";
        const subject = (step.subject || "")
          .replace(/\{\{firstName\}\}/g, firstName)
          .replace(/\{\{magicLink\}\}/g, magicLink);
        const body = (step.body || "")
          .replace(/\{\{firstName\}\}/g, firstName)
          .replace(/\{\{magicLink\}\}/g, magicLink);

        // Send via Gmail API
        try {
          const trackingId = crypto.randomUUID();
          const raw = buildRawEmail(account.email, pro.email, subject, body, trackingId);
          const sendRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw }),
          });

          const sent = await sendRes.json();

          if (sent.error) {
            console.error(`Send failed for ${pro.email}: ${sent.error.message}`);
            accountErrors++;
            totalErrors++;

            // If auth error, skip rest of this account
            if (sent.error.code === 401 || sent.error.code === 403) {
              results.push({ account: account.email, error: `Auth error: ${sent.error.message}`, sent: accountSent.length });
              break;
            }
            continue;
          }

          // Log the sent email
          await supabase.from("crm_emails").insert({
            gmail_message_id: trackingId,
            gmail_thread_id: sent.threadId || sent.id,
            account_email: account.email,
            direction: "outbound",
            from_address: account.email,
            to_address: pro.email,
            subject,
            body_text: body,
            sent_at: new Date().toISOString(),
          });

          // Check if there's a next step
          const { data: nextStep } = await supabase
            .from("crm_sequence_steps")
            .select("step_number, delay_days")
            .eq("sequence_id", enrollment.sequence_id)
            .eq("step_number", enrollment.current_step + 1)
            .maybeSingle();

          if (nextStep) {
            // Advance to next step with delay
            const nextSend = new Date();
            nextSend.setDate(nextSend.getDate() + (nextStep.delay_days || 3));
            // Set to 2pm UTC (7am AZ)
            nextSend.setUTCHours(14, Math.floor(Math.random() * 60), 0, 0);

            await supabase.from("crm_sequence_enrollments").update({
              current_step: enrollment.current_step + 1,
              next_send_at: nextSend.toISOString(),
            }).eq("id", enrollment.id);
          } else {
            // Sequence complete
            await supabase.from("crm_sequence_enrollments").update({
              status: "completed",
              completed_at: new Date().toISOString(),
              current_step: enrollment.current_step + 1,
            }).eq("id", enrollment.id);
          }

          accountSent.push(pro.email);
          totalSent++;

        } catch (e: any) {
          console.error(`Error sending to ${pro.email}: ${e.message}`);
          accountErrors++;
          totalErrors++;
        }
      }

      results.push({
        account: account.email,
        sent: accountSent.length,
        errors: accountErrors,
        recipients: accountSent,
      });
    }

    const elapsed = Date.now() - startTime;
    return new Response(JSON.stringify({
      success: true,
      totalSent,
      totalErrors,
      elapsed_ms: elapsed,
      accounts: results,
    }), { headers: { "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
