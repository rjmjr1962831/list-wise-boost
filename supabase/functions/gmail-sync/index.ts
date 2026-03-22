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


async function createInboundTask(fromEmail: string, subject: string, bodyText: string) {
  const fromLower = fromEmail.toLowerCase().trim();

  // Find the professional by email
  const { data: pro } = await supabase
    .from("professionals")
    .select("id, name")
    .eq("email", fromLower)
    .limit(1)
    .maybeSingle();

  // Skip if there's already an open inbound_reply task for this professional
  if (pro) {
    const { data: existing } = await supabase
      .from("crm_tasks")
      .select("id")
      .eq("professional_id", pro.id)
      .eq("task_type", "inbound_reply")
      .in("status", ["pending", "in_progress"])
      .limit(1)
      .maybeSingle();
    if (existing) return;
  }

  const preview = bodyText.slice(0, 500).trim();

  await supabase.from("crm_tasks").insert({
    professional_id: pro?.id ?? null,
    task_type: "inbound_reply",
    title: `Inbound reply: ${pro?.name ?? fromLower} -- ${subject}`,
    description: preview || null,
    status: "pending",
    priority: "high",
    notes: `From: ${fromEmail}\nSubject: ${subject}`,
  });
}


async function handleBounce(bodyText: string, bodyHtml: string, toAddress: string) {
  const text = (bodyText || bodyHtml || "").toLowerCase();
  const hardBouncePatterns = [
    "mailbox not found",
    "domain not found",
    "user unknown",
    "no such user",
    "does not exist",
    "recipient rejected",
    "address rejected",
    "unknown user",
    "invalid recipient",
    "undeliverable",
    "mailbox unavailable",
    "account has been disabled",
    "no mailbox here",
    "not found",
  ];
  const isHardBounce = hardBouncePatterns.some(p => text.includes(p));
  if (!isHardBounce) return;

  // Extract the bounced email from the bounce body
  // Common patterns: "delivery to <email>" or "The email account that you tried to reach does not exist"
  // The original To address is in the bounce report
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const allEmails = (bodyText || bodyHtml || "").match(emailRegex) || [];
  
  // Filter out our own addresses and common system addresses
  const ourDomains = ["top10lists.us", "toptenlists.us", "googlemail.com", "google.com"];
  const bouncedEmails = allEmails.filter(e => {
    const domain = e.split("@")[1]?.toLowerCase();
    return !ourDomains.some(d => domain === d || domain?.endsWith("." + d));
  });

  if (bouncedEmails.length === 0) return;

  // Use first external email found as the bounced address
  const bouncedEmail = bouncedEmails[0].toLowerCase().trim();

  const { data: pro } = await supabase
    .from("professionals")
    .select("id, email, name, company, business_name, business_city, state_slug")
    .ilike("email", bouncedEmail)
    .limit(1)
    .maybeSingle();

  if (pro) {
    const baseDesc = `Hard bounce detected for ${pro.email}. Research correct email address and update manually. Do not send again until resolved.`;
    await supabase.from("crm_tasks").upsert({
      professional_id: pro.id,
      task_type: "email_bounced",
      title: `Bounced email: ${pro.email}`,
      description: baseDesc,
      status: "pending",
      priority: "high",
    }, { onConflict: "professional_id,task_type", ignoreDuplicates: true });

    // Exa search for suggested replacement email (fire-and-forget; we update task if we find any)
    const exaKey = Deno.env.get("EXA_API_KEY");
    if (exaKey && pro.name) {
      searchBounceEmailWithExa(exaKey, pro, bouncedEmail, baseDesc).catch((e) =>
        console.error("Exa bounce search failed:", e?.message ?? e)
      );
    }
  }

  // Disable any active enrollment for this email
  await supabase.from("crm_sequence_enrollments")
    .update({ status: "bounced" })
    .eq("email", bouncedEmail)
    .eq("status", "active");
}

/** Call Exa to find possible contact emails for a bounced professional; append to task description. */
async function searchBounceEmailWithExa(
  exaApiKey: string,
  pro: { id: string; email: string; name: string | null; company: string | null; business_name: string | null; business_city: string | null; state_slug: string | null },
  bouncedEmail: string,
  baseDesc: string,
) {
  const company = (pro.company || pro.business_name || "").trim();
  const city = (pro.business_city || "").trim();
  const state = (pro.state_slug || "").replace(/-/g, " ");
  const query = [pro.name, "real estate agent", city, state, company]
    .filter(Boolean)
    .join(" ");
  if (!query.trim()) return;

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": exaApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: query + " contact email",
      useAutoprompt: true,
      numResults: 8,
      type: "auto",
      contents: { text: { maxCharacters: 2000 }, highlights: true },
    }),
  });
  if (!res.ok) return;

  const data = await res.json();
  const results = data.results || [];
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const ourDomains = ["top10lists.us", "toptenlists.us", "googlemail.com", "google.com", "gmail.com"];
  const seen = new Set<string>([bouncedEmail.toLowerCase()]);
  const suggested: string[] = [];

  for (const r of results) {
    const text = [r.text || "", (r.highlights || []).join(" ")].join(" ");
    const matches = text.match(emailRegex) || [];
    for (const email of matches) {
      const lower = email.toLowerCase().trim();
      if (seen.has(lower)) continue;
      const domain = lower.split("@")[1] || "";
      if (ourDomains.some((d) => domain === d || domain.endsWith("." + d))) continue;
      seen.add(lower);
      suggested.push(email);
    }
  }

  if (suggested.length > 0) {
    const extra = `\n\nExa suggested: ${[...new Set(suggested)].slice(0, 5).join(", ")}`;
    await supabase
      .from("crm_tasks")
      .update({ description: baseDesc + extra })
      .eq("professional_id", pro.id)
      .eq("task_type", "email_bounced");
  }
}

async function syncAccount(account: any) {
  const token = await getValidToken(account);

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=newer_than:7d -in:trash`,
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
    const OUR_ACCOUNTS = new Set([
      "robert@top10lists.us",
      "hello@top10lists.us",
      "robert@toptenlists.us",
      "hello@toptenlists.us",
      "mark@toptenlists.us",
    ]);
    const direction = OUR_ACCOUNTS.has(fromEmail.toLowerCase()) ? "outbound" : "inbound";

    // Handle bounce notifications - process but don't store
    const isBounce = fromEmail.toLowerCase().includes("mailer-daemon") || 
                     fromEmail.toLowerCase().includes("postmaster");
    if (direction === "inbound" && isBounce) {
      await handleBounce(bodyText, bodyHtml, to);
      continue;
    }

    // Skip inbound spam/cold outreach - allow enrolled agents, contacts, and known domains
    if (direction === "inbound") {
      const fromLower = fromEmail.toLowerCase().trim();
      const fromDomain = fromLower.split("@")[1] || "";
      
      // Always allow our own domains and known admin addresses
      const trustedDomains = ["top10lists.us", "toptenlists.us", "maynard.com", "aryah.ai"];
      const isTrusted = trustedDomains.some(d => fromDomain === d || fromDomain.endsWith("." + d));
      
      if (!isTrusted) {
        // Check if sender is a known enrollment or contact
        const { data: knownEnrollment } = await supabase
          .from("crm_sequence_enrollments")
          .select("id")
          .eq("email", fromLower)
          .limit(1)
          .maybeSingle();
        const { data: knownContact } = await supabase
          .from("contacts")
          .select("id")
          .eq("email", fromLower)
          .limit(1)
          .maybeSingle();
        const { data: knownPro } = await supabase
          .from("professionals")
          .select("id")
          .eq("email", fromLower)
          .limit(1)
          .maybeSingle();
        // Also check email_queue — agents we emailed via campaigns
        const { data: knownQueued } = await supabase
          .from("email_queue")
          .select("id")
          .eq("recipient_email", fromLower)
          .limit(1)
          .maybeSingle();
        if (!knownEnrollment && !knownContact && !knownPro && !knownQueued) continue;
      }
    }

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

    // Reply detection -- if inbound from known sender, check if in active sequence
    if (direction === "inbound") {
      await handleReply(fromEmail);
      await createInboundTask(fromEmail, subject || "(no subject)", bodyText || "");
    }

    synced++;
  }
  return { synced };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const { data: accounts, error } = await supabase
    .from("crm_email_accounts")
    .select("*");

  if (error || !accounts?.length) {
    return new Response(JSON.stringify({ error: "No accounts connected" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Sync all accounts in parallel to avoid 27s+ sequential timeout
  const results = await Promise.all(
    accounts.map(async (account: any) => {
      try {
        const result = await syncAccount(account);
        return { email: account.email, ...result };
      } catch (e: any) {
        return { email: account.email, error: (e as Error).message };
      }
    })
  );

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
