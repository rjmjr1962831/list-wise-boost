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
    const outputFields = (body.outputFields || ["id", "name", "email", "phone"]).filter(Boolean);

    // Select superset of common fields + cities for city_name/city_slug
    const selectStr =
      "id,name,email,phone,website,company,business_name,title,canonical_slug,state_slug,current_tier,badge_tier,review_stars_rating,num_total_reviews,license_number,license_status,zillow_profile_url,verification_token,created_at,updated_at,city_id,cities(name,slug)";

    let query = supabase.from("professionals").select(selectStr, { count: "exact" });

    // Apply criteria
    if (criteria.active === true) query = query.eq("active", true);
    if (typeof criteria.state_slug === "string" && criteria.state_slug)
      query = query.eq("state_slug", criteria.state_slug);
    if (typeof criteria.current_tier === "string" && criteria.current_tier)
      query = query.eq("current_tier", criteria.current_tier);
    if (typeof criteria.category_id === "string" && criteria.category_id)
      query = query.eq("category_id", criteria.category_id);
    if (typeof criteria.city_id === "string" && criteria.city_id)
      query = query.eq("city_id", criteria.city_id);
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
      const cells = outputFields.map((f) => {
        if (f === "city_name") return escape((r.cities as any)?.name);
        if (f === "city_slug") return escape((r.cities as any)?.slug);
        return escape((r as any)[f]);
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
    console.error("list-maker-export error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
