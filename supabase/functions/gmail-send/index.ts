import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TRACK_BASE = `${SUPABASE_URL}/functions/v1/email-track`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function refreshAccessToken(account: any): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
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
  // Rewrite links for click tracking
  const tracked = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match, url) => {
      const trackUrl = `${TRACK_BASE}?t=c&eid=${encodeURIComponent(emailId)}&url=${encodeURIComponent(url)}`;
      return `href="${trackUrl}"`;
    }
  );
  // Append open tracking pixel
  const pixel = `<img src="${TRACK_BASE}?t=o&eid=${encodeURIComponent(emailId)}" width="1" height="1" style="display:none" alt="">`;
  return tracked + pixel;
}

function buildRawEmail(params: {
  from: string; to: string; subject: string; bodyText: string; bodyHtml: string;
  threadId?: string; inReplyTo?: string; references?: string; unsubUrl?: string;
}): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines = [
    `From: Robert Maynard <${params.from}>`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (params.unsubUrl) lines.push(`List-Unsubscribe: <${params.unsubUrl}>`);
  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) lines.push(`References: ${params.references}`);
  lines.push(
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(params.bodyText))),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(params.bodyHtml))),
    "",
    `--${boundary}--`,
  );
  const raw = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.json();
  const { from_account, to, subject, message_body, thread_id, in_reply_to, references, contact_id } = body;

  if (!from_account || !to || !subject || !message_body) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
  }

  const { data: account } = await supabase
    .from("crm_email_accounts").select("*").eq("email", from_account).single();

  if (!account) {
    return new Response(JSON.stringify({ error: "Account not connected" }), { status: 404 });
  }

  const token = await getValidToken(account);

  // Look up professional's verification_token for unsubscribe link
  const { data: proRecord } = await supabase
    .from("professionals")
    .select("verification_token")
    .eq("email", to)
    .maybeSingle();
  const unsubToken = proRecord?.verification_token || "";
  const unsubUrl = unsubToken ? `${SUPABASE_URL}/functions/v1/unsubscribe?token=${unsubToken}` : "";

  // Generate a tracking ID (will be replaced by gmail message ID after send)
  const trackingId = crypto.randomUUID();

  // Plain text gets URL, HTML gets clickable word
  const fullBody = unsubUrl
    ? message_body + `\n\n---\nUnsubscribe: ${unsubUrl}`
    : message_body;
  const baseHtml = textToHtml(message_body);
  const unsubHtml = unsubUrl ? `<br><br><hr style="border:none;border-top:1px solid #ccc;margin-top:20px;"><p style="font-size:13px;color:#555;margin-top:12px;"><a href="${unsubUrl}" style="color:#555;text-decoration:underline;">Unsubscribe</a></p>` : "";
  const trackedHtml = injectTracking(baseHtml + unsubHtml, trackingId);

  const raw = buildRawEmail({
    from: from_account,
    to, subject,
    bodyText: fullBody,
    bodyHtml: trackedHtml,
    inReplyTo: in_reply_to,
    references,
    unsubUrl: unsubUrl || undefined,
  });

  const sendPayload: any = { raw };
  if (thread_id) sendPayload.threadId = thread_id;

  const sendRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sendPayload),
  });

  const sent = await sendRes.json();
  if (sent.error) {
    return new Response(JSON.stringify({ error: sent.error.message }), { status: 500 });
  }

  // Store with tracking ID for event correlation
  await supabase.from("crm_emails").insert({
    gmail_message_id: trackingId,
    gmail_thread_id: sent.threadId || thread_id || sent.id,
    account_email: from_account,
    direction: "outbound",
    from_address: from_account,
    to_address: to,
    subject,
    body_text: fullBody,
    contact_id: contact_id || null,
    sent_at: new Date().toISOString(),
  });

  return new Response(JSON.stringify({ success: true, message_id: sent.id, tracking_id: trackingId }), {
    headers: { "Content-Type": "application/json" }
  });
});
