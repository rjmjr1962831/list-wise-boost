import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  try {
    const { sequence_id, filters, dry_run = false } = await req.json();

    if (!sequence_id) return new Response(JSON.stringify({ error: "sequence_id required" }), { status: 400, headers: { "Content-Type": "application/json" } });

    let query = supabase
      .from("professionals")
      .select("id, name, email, verification_token, business_city, state_slug, current_tier")
      .eq("active", true)
      .not("email", "is", null)
      .not("verification_token", "is", null);

    if (filters?.state_slug) query = query.eq("state_slug", filters.state_slug);
    if (filters?.tier) query = query.eq("current_tier", filters.tier);
    if (filters?.city) query = query.eq("business_city", filters.city);

    const { data: agents, error } = await query.limit(10000);
    if (error) throw error;

    if (dry_run) {
      return new Response(JSON.stringify({ dry_run: true, would_enroll: agents?.length ?? 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const enrollments = (agents ?? []).map(agent => ({
      sequence_id,
      professional_id: agent.id,
      email: agent.email,
      first_name: agent.name?.split(" ")[0] ?? "",
      status: "active",
      current_step: 0,
      next_send_at: new Date().toISOString(),
      metadata: {
        magic_link: `https://www.top10lists.us/funnel/${agent.verification_token}`,
        business_city: agent.business_city ?? "",
        state: agent.state_slug === "arizona" ? "Arizona" : "California",
        tier: agent.current_tier ?? "listed",
      }
    }));

    let enrolled = 0, skipped = 0;
    for (let i = 0; i < enrollments.length; i += 500) {
      const batch = enrollments.slice(i, i + 500);
      const { data, error: upsertError } = await supabase
        .from("crm_sequence_enrollments")
        .upsert(batch, { onConflict: "sequence_id,email", ignoreDuplicates: true })
        .select("id");
      if (upsertError) throw upsertError;
      enrolled += data?.length ?? 0;
      skipped += batch.length - (data?.length ?? 0);
    }

    return new Response(JSON.stringify({ ok: true, enrolled, skipped, total: enrollments.length }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
