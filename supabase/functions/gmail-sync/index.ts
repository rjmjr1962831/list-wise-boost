import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function extractPlainText(payload: any): string {
  if (!payload) return "";
  const decode = (s: string) => {
    try { return atob(s.replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; }
  };
  if (payload.mimeType === "text/plain" && payload.body?.data) return decode(payload.body.data);
  if (payload.mimeType === "text/html" && payload.body?.data) return decode(payload.body.data);
  if (payload.parts) {
    const plain = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (plain?.body?.data) return decode(plain.body.data);
    const html = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (html?.body?.data) return decode(html.body.data);
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  return "";
}

function extractHtml(payload: any): string {
  if (!payload) return "";
  const decode = (s: string) => {
    try { return atob(s.replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; }
  };
  if (payload.mimeType === "text/html" && payload.body?.data) return decode(payload.body.data);
  if (payload.parts) {
    const html = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (html?.body?.data) return decode(html.body.data);
    for (const part of payload.parts) {
      const h = extractHtml(part);
      if (h) return h;
    }
  }
  return "";
}

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

async function handleReply(fromEmail: string) {
  // Find active enrollment for this email address
  const { data: enrollment } = await supabase
    .from("crm_sequence_enrollments")
    .select("id, sequence_id, crm_sequences!inner(on_reply_sequence_id, from_account)")
    .eq("email", fromEmail.toLowerCase().trim())
    .eq("status", "active")
    .single();

  if (!enrollment) return;

  const seq = enrollment.crm_sequences as any;
  const now = new Date().toISOString();

  // Pause the current enrollment
  await supabase.from("crm_sequence_enrollments")
    .update({ status: "replied", replied_at: now })
    .eq("id", enrollment.id);

  // If there is a follow-up sequence, enroll them in it
  if (seq.on_reply_sequence_id) {
    const { data: agent } = await supabase
      .from("crm_sequence_enrollments")
      .select("professional_id, first_name, metadata")
      .eq("id", enrollment.id)
      .single();

    if (agent) {
      await supabase.from("crm_sequence_enrollments").upsert({
        sequence_id: seq.on_reply_sequence_id,
        professional_id: agent.professional_id,
        email: fromEmail.toLowerCase().trim(),
        first_name: agent.first_name,
        status: "active",
        current_step: 0,
        next_send_at: now,
        metadata: agent.metadata,
      }, { onConflict: "sequence_id,email", ignoreDuplicates: true });
    }
  }
}

async function syncAccount(account: any) {
  const token = await getValidToken(account);

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=in:inbox OR from:me`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const list = await listRes.json();
  if (!list.messages) return { synced: 0 };

  let synced = 0;
  for (const msg of list.messages.slice(0, 50)) {
    const { data: existing } = await supabase
      .from("crm_emails")
      .select("id")
      .eq("gmail_message_id", msg.id)
      .single();
    if (existing) continue;

    const msgRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msgData = await msgRes.json();
    const headers = msgData.payload?.headers || [];
    const from = getHeader(headers, "from");
    const to = getHeader(headers, "to");
    const cc = getHeader(headers, "cc");
    const subject = getHeader(headers, "subject");
    const dateStr = getHeader(headers, "date");
    const sentAt = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

    const bodyText = extractPlainText(msgData.payload);
    const bodyHtml = extractHtml(msgData.payload);

    const fromEmail = from.match(/<(.+)>/)?.[1] || from;
    const direction = fromEmail.toLowerCase() === account.email.toLowerCase() ? "outbound" : "inbound";

    const senderEmail = direction === "inbound" ? fromEmail : (to.match(/<(.+)>/)?.[1] || to);
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("email", senderEmail.toLowerCase().trim())
      .single();

    await supabase.from("crm_emails").upsert({
      gmail_message_id: msg.id,
      gmail_thread_id: msgData.threadId,
      account_email: account.email,
      direction,
      from_address: from,
      to_address: to,
      cc_address: cc || null,
      subject: subject || "(no subject)",
      body_text: bodyText || null,
      body_html: bodyHtml || null,
      contact_id: contact?.id || null,
      sent_at: sentAt,
    }, { onConflict: "gmail_message_id" });

    // Reply detection -- if inbound, check if this person is in an active sequence
    if (direction === "inbound") {
      await handleReply(fromEmail);
    }

    synced++;
  }
  return { synced };
}

serve(async (req) => {
  const { data: accounts, error } = await supabase
    .from("crm_email_accounts")
    .select("*");

  if (error || !accounts?.length) {
    return new Response(JSON.stringify({ error: "No accounts connected" }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }

  const results = [];
  for (const account of accounts) {
    try {
      const result = await syncAccount(account);
      results.push({ email: account.email, ...result });
    } catch (e: any) {
      results.push({ email: account.email, error: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { "Content-Type": "application/json" }
  });
});
