import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const directEmail = url.searchParams.get("email");
  const campaignId = url.searchParams.get("campaign");

  // ── Sequencer v2: direct email unsubscribe ──────────────────────────────────
  if (!token && directEmail) {
    // Record in email_unsubscribes table
    await supabase.from("email_unsubscribes").upsert({
      email: directEmail.toLowerCase(),
      campaign_id: campaignId || null,
      source: "link",
    }, { onConflict: "email" });

    // Mark professional as unsubscribed if they exist
    const { data: prof } = await supabase
      .from("professionals")
      .select("id")
      .ilike("email", directEmail.trim())
      .maybeSingle();

    if (prof) {
      await supabase.from("professionals")
        .update({ email_unsubscribed: true })
        .eq("id", prof.id);
    }

    // Mark any pending email_queue items as unsubscribed
    await supabase.from("email_queue")
      .update({ status: "unsubscribed" })
      .eq("recipient_email", directEmail.toLowerCase())
      .in("status", ["pending_review", "approved", "scheduled"]);

    // Also handle old crm_sequence_enrollments
    await supabase.from("crm_sequence_enrollments")
      .update({ status: "unsubscribed" })
      .eq("email", directEmail.toLowerCase())
      .eq("status", "active");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unsubscribed</title>
    <style>body{font-family:Arial,sans-serif;max-width:500px;margin:80px auto;text-align:center;color:#333;}
    h2{color:#2E7D32;}p{line-height:1.6;}</style></head>
    <body><h2>You have been unsubscribed.</h2>
    <p>You will no longer receive emails from Top10Lists.us.</p>
    <p>If this was a mistake, reply to any email you received from us and we will re-add you.</p>
    </body></html>`;

    return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
  }

  if (!token) {
    return new Response("Invalid unsubscribe link.", { status: 400, headers: { "Content-Type": "text/html" } });
  }

  // Find professional by verification_token
  const { data: prof } = await supabase
    .from("professionals")
    .select("id, name, email")
    .eq("verification_token", token)
    .single();

  if (!prof) {
    return new Response("Link not found or already processed.", { status: 404, headers: { "Content-Type": "text/html" } });
  }

  // Mark all active enrollments as unsubscribed
  await supabase
    .from("crm_sequence_enrollments")
    .update({ status: "unsubscribed" })
    .eq("email", prof.email)
    .eq("status", "active");

  // Optionally mark professional as unsubscribed
  await supabase
    .from("professionals")
    .update({ email_unsubscribed: true })
    .eq("id", prof.id);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Unsubscribed</title>
  <style>body{font-family:Arial,sans-serif;max-width:500px;margin:80px auto;text-align:center;color:#333;}
  h2{color:#2E7D32;}p{line-height:1.6;}</style></head>
  <body><h2>You have been unsubscribed.</h2>
  <p>You will no longer receive emails from Top10Lists.us.</p>
  <p>If this was a mistake, reply to any email you received from us and we will re-add you.</p>
  </body></html>`;

  return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
});
