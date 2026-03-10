// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Map Instantly event types to our status values
const EVENT_STATUS_MAP: Record<string, string> = {
  email_sent: "sent",
  email_opened: "opened",
  email_link_clicked: "clicked",
  email_bounced: "bounced",
  reply_received: "replied",
  lead_unsubscribed: "unsubscribed",
  lead_interested: "interested",
  lead_not_interested: "not_interested",
};

serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const eventType = payload.event_type || payload.type;
  const leadEmail = payload.lead?.email || payload.email;
  const instantlyLeadId = payload.lead?.id || payload.lead_id;

  if (!leadEmail && !instantlyLeadId) {
    return new Response("Missing lead identifier", { status: 200 });
  }

  const status = EVENT_STATUS_MAP[eventType] || eventType;

  // Find matching professional
  let professional: any = null;

  if (instantlyLeadId) {
    const { data } = await supabase
      .from("professionals")
      .select("id, name, email")
      .eq("instantly_id", instantlyLeadId)
      .single();
    professional = data;
  }

  if (!professional && leadEmail) {
    const { data } = await supabase
      .from("professionals")
      .select("id, name, email")
      .eq("email", leadEmail.toLowerCase().trim())
      .single();
    professional = data;
  }

  if (!professional) {
    // Log unknown lead event but don't fail
    console.log(`Instantly event for unknown lead: ${leadEmail} (${eventType})`);
    return new Response("OK", { status: 200 });
  }

  // Update professional status
  const updateData: any = {
    instantly_status: status,
    instantly_last_event_at: new Date().toISOString(),
  };

  // Store instantly_id if we found via email
  if (instantlyLeadId && !professional.instantly_id) {
    updateData.instantly_id = instantlyLeadId;
  }

  await supabase.from("professionals")
    .update(updateData)
    .eq("id", professional.id);

  // Also write to crm_emails if it's a sent/reply event
  if (["email_sent", "reply_received"].includes(eventType)) {
    const direction = eventType === "reply_received" ? "inbound" : "outbound";
    const subject = payload.subject || payload.email_subject || "(Instantly campaign email)";
    const body = payload.body || payload.email_body || "";

    await supabase.from("crm_emails").insert({
      gmail_message_id: `instantly_${payload.lead?.id || ""}_${Date.now()}`,
      gmail_thread_id: payload.campaign_id || `instantly_campaign`,
      account_email: payload.from_address || "hello@top10lists.us",
      direction,
      from_address: direction === "inbound" ? leadEmail : (payload.from_address || "hello@top10lists.us"),
      to_address: direction === "outbound" ? leadEmail : (payload.from_address || "hello@top10lists.us"),
      subject,
      body_text: body,
      contact_id: null,
      sent_at: new Date().toISOString(),
    }).onConflict("gmail_message_id").ignore();
  }

  return new Response("OK", { status: 200 });
});
