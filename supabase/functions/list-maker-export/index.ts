/**
 * List Maker Export: Generate CSV from professionals by criteria and output fields.
 * When AIFS fields are requested, uses run_sql RPC with LEFT JOIN to geo_audit_results.
 * Uploads to Supabase storage, returns public URL.
 * Run from staging CRM only; do not push to main.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map from frontend field keys to SQL expressions for query building
const AIFS_FIELD_MAP: Record<string, string> = {
  aifs_score_unlisted: "g.score_unlisted",
  aifs_score_listed: "g.score_listed",
  aifs_score_certified: "g.score_certified",
  aifs_score_audited: "g.score_audited",
  aifs_score_underwritten: "g.score_underwritten",
  aifs_lift_to_audited: "g.score_lift_to_audited",
  aifs_lift_to_underwritten: "g.score_lift_to_underwritten",
  aifs_most_recent_review_date: "g.most_recent_signal",
  aifs_gap_stale_reviews: "g.gap_stale_reviews",
  aifs_gap_no_linkedin: "g.gap_no_linkedin",
  aifs_gap_no_schema: "g.gap_no_schema",
  aifs_gap_no_personal_site: "g.gap_no_personal_site",
  aifs_gap_no_realtor: "g.gap_no_realtor",
  aifs_gap_no_press: "g.gap_no_press",
  aifs_artifact_url: "g.artifact_url",
  bot_crawl_count: "(SELECT COUNT(*)::int FROM bot_crawl_logs WHERE agent_id = p.id)",
  first_name: "SPLIT_PART(p.name, ' ', 1)",
  last_name: "CASE WHEN POSITION(' ' IN p.name) > 0 THEN SUBSTRING(p.name FROM POSITION(' ' IN p.name) + 1) ELSE '' END",
  ai_surfaces_total_7d: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id)",
  ai_surfaces_meta: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name = 'Meta-ExternalAgent')",
  ai_surfaces_google: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name = 'Googlebot')",
  ai_surfaces_apple: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name IN ('Applebot','Applebot-Extended'))",
  ai_surfaces_perplexity: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name = 'PerplexityBot')",
  ai_surfaces_chatgpt: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name IN ('ChatGPT-User','OAI-SearchBot'))",
  ai_surfaces_claude: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name = 'ClaudeBot')",
  ai_surfaces_bing: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name IN ('Bingbot','bingbot'))",
  ai_surfaces_gptbot: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name = 'GPTBot')",
  ai_surfaces_other: `(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name NOT IN ('Meta-ExternalAgent','Googlebot','Applebot','Applebot-Extended','PerplexityBot','ChatGPT-User','OAI-SearchBot','ClaudeBot','Bingbot','bingbot','GPTBot'))`,
  ai_surfaces_human: "(SELECT COALESCE(SUM(crawls),0)::int FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id AND bot_name IN ('ChatGPT-User','PerplexityBot'))",
  ai_surfaces_top5_bots: "(SELECT STRING_AGG(bot_name, ', ' ORDER BY crawls DESC) FROM (SELECT bot_name, crawls FROM agent_ai_surfaces_by_bot WHERE agent_id = p.id ORDER BY crawls DESC LIMIT 5) sub)",
};

// Friendly CSV header names matching the UI labels
const FIELD_LABELS: Record<string, string> = {
  id: "ID",
  name: "Name",
  first_name: "First Name",
  last_name: "Last Name",
  email: "Email",
  phone: "Phone",
  website: "Website",
  social_linkedin: "LinkedIn URL",
  company: "Company / Brokerage",
  canonical_slug: "Canonical Slug",
  state_slug: "State Slug",
  current_tier: "Current Tier",
  magic_link: "Magic Link",
  date_first_listed: "Date First Listed",
  date_last_updated: "Date Last Updated",
  zillow_profile_url: "Zillow URL",
  city_name: "City Name",
  created_at: "Created At",
  updated_at: "Updated At",
  review_stars_rating: "Rating",
  aifs_score_unlisted: "AIFS Score (Current)",
  aifs_score_listed: "AIFS Score (Listed)",
  aifs_score_certified: "AIFS Score (Certified)",
  aifs_score_audited: "AIFS Score (Audited)",
  aifs_score_underwritten: "AIFS Score (Underwritten)",
  aifs_lift_to_audited: "Lift to Audited",
  aifs_lift_to_underwritten: "Lift to Underwritten",
  aifs_most_recent_review_date: "Most Recent Review Date",
  aifs_gap_stale_reviews: "Gap: Stale Reviews",
  aifs_gap_no_linkedin: "Gap: No LinkedIn",
  aifs_gap_no_schema: "Gap: No Schema",
  aifs_gap_no_personal_site: "Gap: No Personal Site",
  aifs_gap_no_realtor: "Gap: No Realtor",
  aifs_gap_no_press: "Gap: No Press",
  aifs_artifact_url: "Artifact URL",
  bot_crawl_count: "AI Crawl Count",
  ai_surfaces_total_7d: "AI Surfaces (7d total)",
  ai_surfaces_meta: "Surfaces: Meta AI",
  ai_surfaces_google: "Surfaces: Google",
  ai_surfaces_apple: "Surfaces: Apple",
  ai_surfaces_perplexity: "Surfaces: Perplexity",
  ai_surfaces_chatgpt: "Surfaces: ChatGPT",
  ai_surfaces_claude: "Surfaces: Claude",
  ai_surfaces_bing: "Surfaces: Bing",
  ai_surfaces_gptbot: "Surfaces: GPTBot",
  ai_surfaces_other: "Surfaces: Other",
  ai_surfaces_human: "Surfaces: Human-Initiated",
  ai_surfaces_top5_bots: "Top 5 Bots",
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

    // Check if any AIFS fields are requested
    const hasAifsFields = outputFields.some((f) => f in AIFS_FIELD_MAP);

    let rows: Record<string, unknown>[];

    if (hasAifsFields) {
      // Use run_sql RPC for JOIN query
      rows = await queryWithJoin(supabase, criteria, outputFields);
    } else {
      // Use standard Supabase client query (no join needed)
      rows = await queryStandard(supabase, criteria);
    }

    // Build CSV
    const escape = (v: unknown): string => {
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = outputFields.map((f) => FIELD_LABELS[f] || f);
    const csvRows: string[] = [headers.join(",")];

    for (const row of rows) {
      const cells = outputFields.map((f) => {
        if (f === "magic_link") return escape(row.verification_token ? `${baseUrl}/funnel/${row.verification_token}` : "");
        if (f === "first_name" && row[f] == null) {
          const parts = String(row.name || "").trim().split(/\s+/);
          return escape(parts[0] || "");
        }
        if (f === "last_name" && row[f] == null) {
          const parts = String(row.name || "").trim().split(/\s+/);
          return escape(parts.slice(1).join(" "));
        }
        if (f === "date_first_listed") return escape(row.card_created_at || row.created_at);
        if (f === "date_last_updated") return escape(row.updated_at);
        if (f === "city_name") return escape(row.city_name ?? (row as any).cities?.name);
        if (f === "company") return escape(row.company || row.business_name || "");
        // AIFS fields: map to the SQL alias (aifs_* prefix)
        if (f in AIFS_FIELD_MAP) return escape(row[f]);
        return escape(row[f]);
      });
      csvRows.push(cells.join(","));
    }

    const csv = csvRows.join("\n");
    const count = rows.length;
    const fileName = `list-maker-${Date.now()}.csv`;

    // Upload to storage
    let url: string | null = null;
    try {
      const { error: uploadError } = await supabase.storage
        .from("list-maker-exports")
        .upload(fileName, new TextEncoder().encode(csv), {
          contentType: "text/csv",
          upsert: true,
        });
      if (uploadError) {
        console.error("list-maker-export storage upload failed:", uploadError);
      } else {
        const { data: urlData } = supabase.storage.from("list-maker-exports").getPublicUrl(fileName);
        url = urlData.publicUrl;
      }
    } catch (e) {
      console.error("list-maker-export storage error:", e);
    }

    const MAX_CSV_IN_BODY = 1_500_000;
    const includeCsv = csv.length <= MAX_CSV_IN_BODY;
    const payload: { url: string | null; count: number; csv?: string } = { url, count };
    if (includeCsv) payload.csv = csv;

    if (!url && !includeCsv) {
      return new Response(
        JSON.stringify({
          error:
            "Export too large for direct download and storage upload failed. Create the storage bucket: run migration 20260303000000_list_maker_exports_bucket.sql",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify(payload),
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

/**
 * Standard query using Supabase client (no AIFS join needed).
 */
async function queryStandard(
  supabase: ReturnType<typeof createClient>,
  criteria: Record<string, unknown>
): Promise<Record<string, unknown>[]> {
  const selectStr =
    "id,name,email,phone,website,social_linkedin,company,business_name,canonical_slug,state_slug,current_tier,card_created_at,created_at,updated_at,verification_token,zillow_profile_url,review_stars_rating,city_id,cities(name)";

  const PAGE_SIZE = 1000;
  const allRows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from("professionals").select(selectStr);

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
    if (criteria.exclude_teams === true)
      query = query.neq("lead_status", "team");

    const { data: rows, error } = await query
      .order("state_slug")
      .order("name")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    const batch = (rows || []) as Record<string, unknown>[];
    allRows.push(...batch);

    if (batch.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
  }

  return allRows;
}

/**
 * Query with LEFT JOIN to geo_audit_results via run_sql RPC.
 * Builds SELECT and WHERE dynamically from requested fields and criteria.
 */
async function queryWithJoin(
  supabase: ReturnType<typeof createClient>,
  criteria: Record<string, unknown>,
  outputFields: string[]
): Promise<Record<string, unknown>[]> {
  // Always select base professionals fields needed for field resolution
  const selectCols: string[] = [
    "p.id",
    "p.name",
    "p.email",
    "p.phone",
    "p.website",
    "p.social_linkedin",
    "p.company",
    "p.business_name",
    "p.canonical_slug",
    "p.state_slug",
    "p.current_tier",
    "p.card_created_at",
    "p.created_at",
    "p.updated_at",
    "p.verification_token",
    "p.zillow_profile_url",
    "p.review_stars_rating",
    "c.name AS city_name",
  ];

  // Add requested AIFS columns with aliases
  for (const f of outputFields) {
    if (f in AIFS_FIELD_MAP) {
      selectCols.push(`${AIFS_FIELD_MAP[f]} AS ${f}`);
    }
  }

  // Build WHERE clause
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (criteria.active === true) conditions.push("p.active = true");
  if (criteria.active === false) conditions.push("p.active = false");

  if (Array.isArray(criteria.state_slugs) && criteria.state_slugs.length > 0) {
    const escaped = criteria.state_slugs.map((s: string) => `'${s.replace(/'/g, "''")}'`).join(",");
    conditions.push(`p.state_slug IN (${escaped})`);
  }

  if (Array.isArray(criteria.current_tiers) && criteria.current_tiers.length > 0) {
    const escaped = criteria.current_tiers.map((t: string) => `'${t.replace(/'/g, "''")}'`).join(",");
    conditions.push(`p.current_tier IN (${escaped})`);
  }

  if (typeof criteria.min_rating === "number") {
    conditions.push(`p.review_stars_rating >= ${Number(criteria.min_rating)}`);
  }

  if (criteria.email_verified === true) {
    conditions.push("p.email_verified_at IS NOT NULL");
  }

  if (criteria.has_license === true) {
    conditions.push("p.license_number IS NOT NULL AND p.license_number != ''");
  }

  if (criteria.exclude_teams === true) {
    conditions.push("p.lead_status != 'team'");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT ${selectCols.join(", ")}
    FROM professionals p
    LEFT JOIN geo_audit_results g ON p.id = g.agent_id
    LEFT JOIN cities c ON p.city_id = c.id
    ${whereClause}
    ORDER BY p.state_slug, p.name
    LIMIT 50000
  `;

  const { data, error } = await supabase.rpc("run_sql", { query: sql });
  if (error) throw error;

  // run_sql returns jsonb; parse if needed
  if (typeof data === "string") {
    return JSON.parse(data);
  }
  if (Array.isArray(data)) return data;
  return [];
}

