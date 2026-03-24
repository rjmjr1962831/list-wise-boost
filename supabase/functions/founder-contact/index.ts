import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const { sender_name, sender_email, message, founder_name, founder_email } = await req.json();

    if (!sender_name || !sender_email || !message || !founder_name || !founder_email) {
      return new Response(JSON.stringify({ error: "All fields required" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Create CRM task
    const { error: taskErr } = await sb.from("crm_tasks").insert({
      title: `Founder contact from ${sender_name}`,
      description: `From: ${sender_name} <${sender_email}>\nTo: ${founder_name} <${founder_email}>\n\n${message}`,
      priority: "high",
      status: "pending",
      task_type: "founder_contact",
      created_at: new Date().toISOString(),
    });
    if (taskErr) console.error("Task insert error:", taskErr);

    // 2. Send notification email to the founder's aryah.ai address via gmail-send
    const { error: sendErr } = await sb.functions.invoke("gmail-send", {
      body: {
        from_account: "hello@top10lists.us",
        to: founder_email,
        subject: `Founder page contact from ${sender_name}`,
        message_body: `<p>New message from the founder page:</p>
<p><strong>From:</strong> ${sender_name} &lt;${sender_email}&gt;</p>
<p><strong>To:</strong> ${founder_name}</p>
<p><strong>Message:</strong></p>
<p>${message.replace(/\n/g, "<br>")}</p>
<hr>
<p style="color:#6b7280;font-size:12px;">This message was submitted via the Top10Lists.us co-founders page.</p>`,
      },
    });

    if (sendErr) console.error("Email send error:", sendErr);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("founder-contact error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
