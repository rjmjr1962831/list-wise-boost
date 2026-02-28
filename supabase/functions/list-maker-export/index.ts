/**
 * List Maker Export: Generate CSV from professionals by criteria and output fields.
 * Uploads to Supabase storage, returns public URL.
 * Run from staging CRM only; do not push to main.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = (await req.json()) as {
      criteria?: Record<string, unknown>;
      outputFields?: string[];
    };
    const criteria = body.criteria || {};
    const outputFields = (body.outputFields || ["id", "name", "email", "magic_link", "date_first_listed", "current_tier"]).filter(Boolean);

    const baseUrl = "https://www.top10lists.us";

    // Select fields needed for output (company/business_name coalesced as Company / Brokerage)
    const selectStr =
      "id,name,email,phone,website,company,business_name,canonical_slug,state_slug,current_tier,card_created_at,created_at,updated_at,verification_token,zillow_profile_url,city_id,cities(name)";

    let query = supabase.from("professionals").select(selectStr, { count: "exact" });

    // Apply criteria
    if (criteria.active === true) query = query.eq("active", true);
    if (criteria.active === false) query = query.eq("active", false);
    if (Array.isArray(criteria.state_slugs) && criteria.state_slugs.length > 0)
      query = query.in("state_slug", criteria.state_slugs);
    if (Array.isArray(criteria.current_tiers) && criteria.current_tiers.length > 0)
      query = query.in("current_tier", criteria.current_tiers);
    if (typeof criteria.min_rating === "number")
      query = query.gte("review_stars_rating", criteria.min_rating);
    if (criteria.email_verified === true)
      query = query.not("email_verified_at", "is", null);
    if (criteria.has_license === true)
      query = query.not("license_number", "is", null).neq("license_number", "");

    const { data: rows, error } = await query.order("state_slug").order("name").limit(50000);

    if (error) throw error;

    // Build CSV headers from outputFields
    const headers = outputFields.map((f) => f);
    const escape = (v: unknown): string => {
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const csvRows: string[] = [headers.join(",")];

    for (const r of rows || []) {
      const row = r as Record<string, unknown> & { cities?: { name?: string }; verification_token?: string; card_created_at?: string; created_at?: string; updated_at?: string; company?: string; business_name?: string };
      const cells = outputFields.map((f) => {
        if (f === "magic_link") return escape(row.verification_token ? `${baseUrl}/dashboard/${row.verification_token}` : "");
        if (f === "date_first_listed") return escape(row.card_created_at || row.created_at);
        if (f === "date_last_updated") return escape(row.updated_at);
        if (f === "city_name") return escape(row.cities?.name);
        if (f === "company") return escape(row.company || row.business_name || "");
        return escape(row[f]);
      });
      csvRows.push(cells.join(","));
    }

    const csv = csvRows.join("\n");
    const fileName = `list-maker-${Date.now()}.csv`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("list-maker-exports")
      .upload(fileName, new TextEncoder().encode(csv), {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("list-maker-exports").getPublicUrl(fileName);
    const url = urlData.publicUrl;

    return new Response(
      JSON.stringify({ url, count: rows?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    const msg = err?.message || String(err);
    const hint = msg.includes("Bucket") || msg.includes("bucket") || msg.includes("not found")
      ? " Ensure migration 20260303000000_list_maker_exports_bucket.sql has been run."
      : "";
    console.error("list-maker-export error:", err);
    return new Response(
      JSON.stringify({ error: msg + hint }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
