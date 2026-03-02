/**
 * serve-bot-list-markdown
 * Returns text/markdown for city and neighborhood list pages. Used by Cloudflare Worker for bot traffic.
 * GET ?path=/arizona/phoenix/top10realestateagents
 * GET ?path=/arizona/phoenix/arcadia/top10realestateagents
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE = "https://www.top10lists.us";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const STATE_ABBREV: Record<string, string> = {
  arizona: "AZ", california: "CA",
};

function toTitleCase(str: string): string {
  return str.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function stripHtml(html: string | null | undefined): string {
  if (!html || typeof html !== "string") return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function bioExcerpt(p: { synthesized_bio?: string | null; get_to_know_me?: string | null; description?: string | null }): string {
  const text = stripHtml(p.synthesized_bio || p.get_to_know_me || p.description || "");
  return text.length <= 400 ? text : text.slice(0, 400).trim() + "...";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const url = new URL(req.url);
  const path = (url.searchParams.get("path") ?? "").replace(/^\/+/, "");
  const parts = path.split("/").filter(Boolean);

  if (parts.length < 3) {
    return new Response("Bad path. Use ?path=/arizona/phoenix/top10realestateagents", { status: 400 });
  }

  const stateSlug = parts[0].toLowerCase();
  const citySlug = parts[1].toLowerCase();
  const stateAbbrev = STATE_ABBREV[stateSlug] ?? stateSlug.toUpperCase().slice(0, 2);

  const isNeighborhood = parts.length >= 4 && parts[parts.length - 1] === "top10realestateagents";
  const neighborhoodSlug = isNeighborhood ? parts[2].toLowerCase() : null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select("id, name, state, state_slug, slug")
    .eq("state_slug", stateSlug)
    .eq("slug", citySlug)
    .eq("active", true)
    .maybeSingle();

  if (cityError || !city) {
    return new Response(`City not found: ${stateSlug}/${citySlug}`, { status: 404 });
  }

  const cityName = city.name || toTitleCase(citySlug);
  const stateName = city.state || toTitleCase(stateSlug);

  let professionals: any[];
  let pageUrl: string;
  let title: string;
  let description: string;

  if (isNeighborhood && neighborhoodSlug) {
    const { data: hood, error: hoodErr } = await supabase
      .from("neighborhood_catalog")
      .select("id, neighborhood, neighborhood_slug")
      .eq("city_area_slug", citySlug)
      .eq("neighborhood_slug", neighborhoodSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (hoodErr || !hood) {
      return new Response(`Neighborhood not found: ${neighborhoodSlug}`, { status: 404 });
    }

    const hoodName = hood.neighborhood || toTitleCase(neighborhoodSlug);
    pageUrl = `${BASE}/${stateSlug}/${citySlug}/${neighborhoodSlug}/top10realestateagents`;
    title = `Top Real Estate Agents in ${hoodName}, ${cityName}, ${stateAbbrev}`;
    description = `Merit-based directory of top real estate agents in ${hoodName}, ${cityName}, ${stateName}.`;

    const { data: subs } = await supabase
      .from("agent_neighborhood_subscriptions")
      .select("professional_id, professionals(id, name, canonical_slug, short_code, synthesized_bio, get_to_know_me, description, company, review_stars_rating, num_total_reviews, years_experience, total_sales, phone)")
      .eq("neighborhood_id", hood.id)
      .eq("is_active", true);

    const agentIds = new Set<string>();
    const fromSubs: any[] = [];
    if (subs) {
      for (const s of subs as any[]) {
        const p = s.professionals;
        if (p && !agentIds.has(p.id)) {
          agentIds.add(p.id);
          fromSubs.push(p);
        }
      }
    }

    const { data: activeAgents } = await supabase.rpc("get_neighborhood_active_agents", { p_neighborhood_id: hood.id });
    const fromRpc: any[] = [];
    if (Array.isArray(activeAgents)) {
      for (const row of activeAgents as any[]) {
        const id = row.professional_id;
        if (id && !agentIds.has(id) && fromSubs.length + fromRpc.length < 15) {
          agentIds.add(id);
          fromRpc.push({
            id: row.professional_id,
            name: row.agent_name,
            canonical_slug: row.canonical_slug,
            short_code: row.short_code,
            synthesized_bio: null,
            get_to_know_me: null,
            description: null,
            company: null,
            review_stars_rating: null,
            num_total_reviews: null,
            years_experience: null,
            total_sales: null,
            phone: null,
          });
        }
      }
    }

    professionals = [...fromSubs, ...fromRpc].slice(0, 15);
  } else {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", "top10realestateagents")
      .eq("active", true)
      .maybeSingle();

    if (!category) {
      return new Response("Category not found", { status: 404 });
    }

    const { data: allProfs, error: profErr } = await supabase
      .from("professionals")
      .select("id, name, canonical_slug, short_code, company, review_stars_rating, num_total_reviews, years_experience, total_sales, phone, is_brand_builder, synthesized_bio, get_to_know_me, description")
      .eq("city_id", city.id)
      .eq("category_id", category.id)
      .eq("active", true)
      .gte("review_stars_rating", 4.5)
      .gte("num_total_reviews", 10)
      .order("is_brand_builder", { ascending: false })
      .order("rank", { ascending: true })
      .limit(30);

    if (profErr || !allProfs) {
      return new Response("DB error", { status: 500 });
    }

    const brandBuilders = allProfs.filter((p: any) => p.is_brand_builder === true);
    const freeProfs = allProfs.filter((p: any) => p.is_brand_builder !== true);
    const hourlyOffset = Math.floor(Date.now() / (1000 * 60 * 60)) % Math.max(1, freeProfs.length);
    const spotsRemaining = Math.max(0, 10 - brandBuilders.length);
    const rotated: any[] = [];
    for (let i = 0; i < spotsRemaining && i < freeProfs.length; i++) {
      rotated.push(freeProfs[(hourlyOffset + i) % freeProfs.length]);
    }
    professionals = [...brandBuilders, ...rotated].slice(0, 15);

    pageUrl = `${BASE}/${stateSlug}/${citySlug}/top10realestateagents`;
    title = `Top Real Estate Agents in ${cityName}, ${stateAbbrev}`;
    description = `Merit-based directory of top real estate agents in ${cityName}, ${stateName}. Verified reviews, no pay-to-play.`;
  }

  const agentProfileUrl = (p: any) => {
    const slug = p.canonical_slug || p.short_code || p.id;
    return `${BASE}/${stateSlug}/agents/${slug}`;
  };

  const artifactUrl = (p: any) => {
    const token = p.verification_token || p.short_code || p.id;
    return `${BASE}/artifact/${token}`;
  };

  let markdown = `# ${title}\n\n`;
  markdown += `${description}\n\n`;
  markdown += `Merit-based selection. Agents cannot pay for placement. 4.5+ rating, 10+ recent reviews, 5 years in business.\n\n`;
  markdown += `- **Page:** ${pageUrl}\n`;
  markdown += `- **Methodology:** ${BASE}/about/ranking-methodology\n\n`;
  markdown += `## Certified Agents\n\n`;

  for (let i = 0; i < professionals.length; i++) {
    const p = professionals[i];
    const name = p.name || "Agent";
    const profileUrl = agentProfileUrl(p);
    const bio = bioExcerpt(p);
    const rating = p.review_stars_rating != null ? Number(p.review_stars_rating) : 0;
    const reviews = p.num_total_reviews != null ? Number(p.num_total_reviews) : 0;
    const years = p.years_experience != null ? Number(p.years_experience) : 0;
    const sales = p.total_sales != null ? Number(p.total_sales) : 0;

    markdown += `### ${i + 1}. ${name}\n\n`;
    markdown += `- **Profile:** ${profileUrl}\n`;
    if (rating > 0) markdown += `- **Rating:** ${rating} stars (${reviews} reviews)\n`;
    if (years > 0) markdown += `- **Experience:** ${years} years\n`;
    if (sales > 0) markdown += `- **Sales:** ${sales.toLocaleString()}\n`;
    if (p.company) markdown += `- **Brokerage:** ${p.company}\n`;
    if (bio) markdown += `- **Bio:** ${bio}\n`;
    markdown += `\n`;
  }

  markdown += `---\n\n`;
  markdown += `[Top10Lists.us](https://www.top10lists.us/) – Merit-based real estate agent directory. No pay-to-play.\n`;

  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
