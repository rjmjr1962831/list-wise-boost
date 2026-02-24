// badge-issue: run hourly via cron. Finds professionals whose tier changed (current_tier != last_tier_badge_notified),
// sends Web of Truth email with link to badge instructions, then sets last_tier_badge_notified and badge_tier.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-enrichment-key",
};

const CRON_KEY = "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a";

function isAuthorized(req: Request): boolean {
  const key = req.headers.get("x-enrichment-key");
  const auth = req.headers.get("authorization");
  const updater = Deno.env.get("UPDATER");
  const allowed = [CRON_KEY];
  if (updater) allowed.push(updater);
  if (key && allowed.includes(key)) return true;
  if (auth && updater && auth === `Bearer ${updater}`) return true;
  if (auth && auth === `Bearer ${CRON_KEY}`) return true;
  return false;
}

const BASE = "https://www.top10lists.us";

function instructionsUrl(token: string): string {
  return `${BASE}/badge-instructions${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

function badgeImageUrl(idOrCode: string): string {
  return `${BASE}/api/v1/badge/${idOrCode}/image`;
}

async function sendTierChangeEmail(
  to: string,
  firstName: string,
  tier: string,
  instructionsLink: string,
  badgeImageLink: string
): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY not set; skipping email");
    return false;
  }
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1).replace(/_/g, " ");
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Your certification tier is now ${tierLabel}</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 18px; color: #111827; margin-bottom: 20px;">Hi ${firstName},</p>
        <p style="color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
          Your Top10Lists.us verification tier has been updated. Your badge and artifact payload now reflect your current tier automatically—you don’t need to change anything. The same link you use today will always show your current badge (e.g. Certified → Underwritten).
        </p>
        <p style="color: #4b5563; line-height: 1.6; margin-bottom: 16px;">
          <strong>The Web of Truth</strong> is our network of cryptographically verifiable certifications. When you display your badge on your website, Zillow, email, or social profiles, visitors can click it to confirm your current status. One link, one embed—set it once and it stays correct as your tier changes.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${instructionsLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            How to use your badge (download &amp; install)
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Or copy this link: <a href="${instructionsLink}" style="color: #2563eb; word-break: break-all;">${instructionsLink}</a>
        </p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
          Your badge image URL (use this everywhere—it updates with your tier):<br>
          <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; word-break: break-all;">${badgeImageLink}</code>
        </p>
      </div>
    </div>
  `;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Robert from Top10lists <hello@top10lists.us>",
      reply_to: "robert@top10lists.us",
      to: [to],
      subject: `Your Top10Lists.us badge is now ${tierLabel} — set it once, it updates automatically`,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", res.status, err);
    return false;
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = !!body.dryRun;
    const limit = typeof body.limit === "number" ? Math.min(body.limit, 200) : 100;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find professionals whose tier changed: current_tier != last_tier_badge_notified (or never notified).
    // PostgREST can't compare two columns in .or(), so we fetch and filter in code.
    const { data: pros, error: listErr } = await supabase
      .from("professionals")
      .select("id, short_code, name, email, verification_token, current_tier, last_tier_badge_notified")
      .not("current_tier", "is", null)
      .limit(limit * 3);

    if (listErr) throw new Error(listErr.message);

    const toProcess = (pros ?? [])
      .filter((p) => (p.last_tier_badge_notified ?? "") !== (p.current_tier ?? ""))
      .slice(0, limit);

    if (toProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No tier changes to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          wouldProcess: toProcess.length,
          sample: toProcess.slice(0, 10).map((p) => ({
            id: p.id,
            name: p.name,
            current_tier: p.current_tier,
            last_tier_badge_notified: p.last_tier_badge_notified,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let ok = 0;
    let fail = 0;
    const tokenOrId = (p: { verification_token?: string | null; id: string }) =>
      p.verification_token || p.id;

    for (const p of toProcess) {
      const email = (p.email ?? "").toString().trim();
      const firstName = (p.name ?? "there").split(/\s+/)[0] || "there";
      const instructionsLink = instructionsUrl(tokenOrId(p));
      const badgeImageLink = badgeImageUrl(p.short_code || p.id);

      if (email) {
        const sent = await sendTierChangeEmail(
          email,
          firstName,
          p.current_tier ?? "certified",
          instructionsLink,
          badgeImageLink
        );
        if (sent) ok++;
        else fail++;
      } else {
        fail++;
      }

      await supabase
        .from("professionals")
        .update({
          last_tier_badge_notified: p.current_tier,
          badge_tier: p.current_tier,
        })
        .eq("id", p.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: toProcess.length,
        ok,
        fail,
        message: `Processed ${toProcess.length} tier change(s)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("badge-issue error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
