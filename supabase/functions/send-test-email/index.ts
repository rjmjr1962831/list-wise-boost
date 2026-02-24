import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GMAIL_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GMAIL_CLIENT_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function refreshToken(acct: any): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: acct.refresh_token, grant_type: "refresh_token",
    }),
  });
  const d = await res.json();
  if (!d.access_token) throw new Error("Token refresh failed: " + JSON.stringify(d));
  await supabase.from("crm_email_accounts").update({
    access_token: d.access_token,
    token_expiry: new Date(Date.now() + (d.expires_in || 3600) * 1000).toISOString(),
  }).eq("email", acct.email);
  return d.access_token;
}

function buildHtml(toName: string, magicLink: string, fromName: string, unsubUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;padding:40px 32px;">
<tr><td style="font-family:Georgia,serif;font-size:16px;line-height:1.7;color:#1a1a1a;">

<p style="margin:0 0 20px">Hi ${toName},</p>

<p style="margin:0 0 20px">What is changing now is how AI assistants decide which agents to name when someone asks:</p>

<p style="margin:0 0 20px">&ldquo;Who are the best agents in Scottsdale?&rdquo;</p>

<p style="margin:0 0 20px">Most of what you are paying for (portals, SEO, mailers) no longer touches that decision because of recent changes in how AI measures recommendation risk.</p>

<p style="margin:0 0 20px">Our job is simple: make you a safer, more obvious name for AI to recommend, increasing the probability that you will be named when someone asks for an agent referral.</p>

<p style="margin:0 0 20px">If you are curious, copy this and ask any AI:</p>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr><td style="background:#f5f5f5;border:1px solid #ddd;border-radius:8px;padding:20px 24px;font-family:'Courier New',monospace;font-size:14px;line-height:1.7;color:#333;">
I am a real estate agent.<br><br>
Look at <a href="https://top10lists.us" style="color:#333;">top10lists.us</a>. I am listed there in my market. Based on how you currently choose which agents to name, does being listed there increase my chances of being named by you when someone here asks for a referral to an agent TODAY?<br><br>
Would being Certified by them increase those chances further? Does this matter more, less, or differently than being a Preferred Agent on Zillow?<br><br>
Please answer specifically for yourself, and then tell me how you think ChatGPT, Claude, Gemini, and Perplexity would answer the same question.
</td></tr>
</table>

<p style="margin:0 0 20px">Your certification upgrade is free as long as you meet our selection criteria and there is no obligation to buy anything.</p>

<p style="margin:0 0 20px">If you or your marketing team want to understand how we do this, I am happy to explain it in as much detail as you like.</p>

<p style="margin:0 0 20px">To get certified, <a href="${magicLink}" style="color:#1a1a1a;text-decoration:underline;">click here</a></p>

<p style="margin:0 0 4px">Peace,</p>
<p style="margin:0 0 4px">${fromName}</p>
<p style="margin:0 0 4px">Founder, Top10Lists.us</p>
<p style="margin:0 0 20px">(602) 758-9600</p>

<p style="margin:0 0 20px;color:#666;font-size:13px;">
3241 E Shea Blvd, Suite 130<br>Phoenix, AZ 85028
</p>

<hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
<p style="margin:0;font-size:12px;color:#999;">
<a href="${unsubUrl}" style="color:#999;text-decoration:underline;">Unsubscribe</a>
</p>

</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildText(toName: string, magicLink: string, fromName: string, unsubUrl: string): string {
  return `Hi ${toName},

What is changing now is how AI assistants decide which agents to name when someone asks:

"Who are the best agents in Scottsdale?"

Most of what you are paying for (portals, SEO, mailers) no longer touches that decision because of recent changes in how AI measures recommendation risk.

Our job is simple: make you a safer, more obvious name for AI to recommend, increasing the probability that you will be named when someone asks for an agent referral.

If you are curious, copy this and ask any AI:

---
I am a real estate agent.

Look at top10lists.us. I am listed there in my market. Based on how you currently choose which agents to name, does being listed there increase my chances of being named by you when someone here asks for a referral to an agent TODAY?

Would being Certified by them increase those chances further? Does this matter more, less, or differently than being a Preferred Agent on Zillow?

Please answer specifically for yourself, and then tell me how you think ChatGPT, Claude, Gemini, and Perplexity would answer the same question.
---

Your certification upgrade is free as long as you meet our selection criteria and there is no obligation to buy anything.

If you or your marketing team want to understand how we do this, I am happy to explain it in as much detail as you like.

To get certified: ${magicLink}

Peace,
${fromName}
Founder, Top10Lists.us
(602) 758-9600

3241 E Shea Blvd, Suite 130
Phoenix, AZ 85028

---
Unsubscribe: ${unsubUrl}`;
}

function buildRaw(from: string, fromName: string, to: string, subject: string, text: string, html: string): string {
  const boundary = `b_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines = [
    `From: ${fromName} <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(text))),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(html))),
    ``,
    `--${boundary}--`,
  ];
  return btoa(unescape(encodeURIComponent(lines.join("\r\n"))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

serve(async (req) => {
  try {
    const { from_email, to_email, to_name, subject } = await req.json();

    const { data: acct } = await supabase
      .from("crm_email_accounts")
      .select("*")
      .eq("email", from_email)
      .single();

    if (!acct) return new Response(JSON.stringify({ error: "Account not found: " + from_email }), { status: 404 });

    const token = await refreshToken(acct);
    const fromName = from_email.startsWith("robert") ? "Robert Maynard" : "Top10Lists.us";
    const magicLink = "https://www.top10lists.us/funnel/test-qa";
    const unsubUrl = "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/unsubscribe?token=test-qa";

    const text = buildText(to_name, magicLink, fromName, unsubUrl);
    const html = buildHtml(to_name, magicLink, fromName, unsubUrl);
    const raw = buildRaw(from_email, fromName, to_email, subject, text, html);

    const sendRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    const sent = await sendRes.json();

    if (sent.error) return new Response(JSON.stringify({ error: sent.error }), { status: 500 });
    return new Response(JSON.stringify({ ok: true, messageId: sent.id, from: from_email, to: to_email }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
