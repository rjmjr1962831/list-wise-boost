import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  c => c.charCodeAt(0)
);

serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("eid");   // = trackingId = crm_emails.gmail_message_id
  const type    = url.searchParams.get("t");     // "o" open | "c" click
  const linkUrl = url.searchParams.get("url");

  if (!emailId) return new Response("missing eid", { status: 400 });

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  const ua = req.headers.get("user-agent") || "";

  // ── Log to crm_email_events (existing, fire-and-forget) ──────────────────
  supabase.from("crm_email_events").insert({
    email_id: emailId,
    event_type: type === "c" ? "click" : "open",
    link_url: linkUrl || null,
    ip_address: ip.split(",")[0].trim(),
    user_agent: ua.substring(0, 500),
  }).then(() => {});

  // ── Look up the crm_email record to get context ───────────────────────────
  const { data: emailRow } = await supabase
    .from("crm_emails")
    .select("id, to_address, subject, from_address, account_email, opened_at, clicked_at")
    .eq("gmail_message_id", emailId)
    .maybeSingle();

  // Declare pro at outer scope so all blocks can access it
  let pro: { id: string; name: string } | null = null;

  if (emailRow) {
    const isOpen  = type === "o";
    const isClick = type === "c";

    // ── Update first-open / first-click timestamps on crm_emails ─────────────
    if (isOpen && !emailRow.opened_at) {
      supabase.from("crm_emails").update({ opened_at: new Date().toISOString() })
        .eq("gmail_message_id", emailId).then(() => {});
    }
    if (isClick && !emailRow.clicked_at) {
      supabase.from("crm_emails").update({ clicked_at: new Date().toISOString() })
        .eq("gmail_message_id", emailId).then(() => {});
    }

    // ── Look up professional by email ─────────────────────────────────────────
    const recipientEmail = emailRow.to_address;
    const { data: proData } = await supabase
      .from("professionals")
      .select("id, name")
      .ilike("email", recipientEmail)
      .maybeSingle();
    pro = proData;

    // ── Look up enrollment for sequence name ──────────────────────────────────
    let sequenceName: string | null = null;
    if (pro?.id) {
      const { data: enrollment } = await supabase
        .from("crm_sequence_enrollments")
        .select("sequence_id, crm_sequences(name)")
        .eq("professional_id", pro.id)
        .order("enrolled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      sequenceName = (enrollment?.crm_sequences as any)?.name ?? null;
    }

    // ── Write to crm_contact_activity ─────────────────────────────────────────
    const shouldRecord =
      (isOpen  && !emailRow.opened_at) ||
      (isClick);

    if (shouldRecord) {
      supabase.from("crm_contact_activity").insert({
        professional_id:    pro?.id ?? null,
        professional_email: recipientEmail,
        event_type:         isClick ? "email_click" : "email_open",
        subject:            emailRow.subject,
        email_id:           emailId,
        link_url:           linkUrl || null,
        from_account:       emailRow.account_email || emailRow.from_address,
        sequence_name:      sequenceName,
        metadata: {
          ip:         ip.split(",")[0].trim(),
          user_agent: ua.substring(0, 200),
        },
      }).then(() => {});
    }

    // ── Update lead_status on professionals ──────────────────────────────────
    if (pro?.id) {
      if (isClick) {
        await supabase.from("professionals").update({ lead_status: "hot" }).eq("id", pro.id);
      } else if (isOpen && !emailRow.opened_at) {
        await supabase.from("professionals").update({ lead_status: "warm" })
          .eq("id", pro.id).neq("lead_status", "hot");
      }
    }

    // ── Create follow-up task ─────────────────────────────────────────────────
    if (pro?.id) {
      if (isClick) {
        await supabase.from("crm_tasks").upsert({
          professional_id: pro.id,
          task_type: "email_clicked",
          title: `Follow up: ${pro.name} clicked your email`,
          description: `Clicked link in "${emailRow.subject}". Go to their funnel or call them directly.`,
          status: "pending",
          priority: "high",
        }, { onConflict: "professional_id,task_type", ignoreDuplicates: true });
      } else if (isOpen && !emailRow.opened_at) {
        await supabase.from("crm_tasks").upsert({
          professional_id: pro.id,
          task_type: "email_opened",
          title: `Follow up: ${pro.name} opened your email`,
          description: `Opened "${emailRow.subject}". Consider a phone call while the interest is fresh.`,
          status: "pending",
          priority: "normal",
        }, { onConflict: "professional_id,task_type", ignoreDuplicates: true });
      }
    }
  }

  // ── Redirect clicks ───────────────────────────────────────────────────────
  if (type === "c" && linkUrl) {
    return new Response(null, {
      status: 302,
      headers: { "Location": linkUrl, "Cache-Control": "no-store, no-cache" },
    });
  }

  // ── Return tracking pixel for opens ──────────────────────────────────────
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
});
