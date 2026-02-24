import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

serve(async (req) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("eid");
  const type = url.searchParams.get("t"); // "o" for open, "c" for click
  const linkUrl = url.searchParams.get("url");

  if (!emailId) {
    return new Response("missing eid", { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  const ua = req.headers.get("user-agent") || "";

  // Log event (fire and forget)
  supabase.from("crm_email_events").insert({
    email_id: emailId,
    event_type: type === "c" ? "click" : "open",
    link_url: linkUrl || null,
    ip_address: ip.split(",")[0].trim(),
    user_agent: ua.substring(0, 500),
  }).then(() => {});

  // Also update crm_emails with first open/click timestamps
  if (type === "o") {
    supabase.from("crm_emails").update({
      opened_at: new Date().toISOString(),
    }).eq("gmail_message_id", emailId).is("opened_at", null).then(() => {});
  }

  // Click: redirect to target URL
  if (type === "c" && linkUrl) {
    return new Response(null, {
      status: 302,
      headers: {
        "Location": linkUrl,
        "Cache-Control": "no-store, no-cache",
      },
    });
  }

  // Open: return tracking pixel
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
});
