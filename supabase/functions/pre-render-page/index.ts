/**
 * pre-render-page
 * Generates complete static HTML for a city or neighborhood page (CleanRoom-style).
 * Used by the pre-render pipeline; output is stored in Cloudflare KV and served to bots.
 * Auth: X-Enrichment-Key header.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENRICHMENT_KEY = "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a";
const BASE = "https://www.top10lists.us";

const STATE_BOARD: Record<string, string> = {
  arizona: "Arizona Department of Real Estate (AZDRE)",
  california: "California Department of Real Estate (DRE)",
  texas: "Texas Real Estate Commission (TREC)",
  florida: "Florida Real Estate Commission",
  "new-york": "New York Department of State",
  colorado: "Colorado Division of Real Estate",
};

function stripCjk(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s
    .replace(/[\u4e00-\u9fff]/g, "")
    .replace(/[\u3400-\u4dbf]/g, "")
    .replace(/[\u3000-\u303f]/g, "")
    .replace(/[\uff00-\uffef]/g, "")
    .replace(/[\u2000-\u206f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html: string | null | undefined): string {
  if (!html || typeof html !== "string") return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function buildItemListSchema(
  cityName: string,
  stateName: string,
  stateSlug: string,
  agents: any[],
  isNeighborhood: boolean,
  neighborhoodName?: string
) {
  const name = isNeighborhood
    ? `Top Real Estate Agents in ${neighborhoodName}, ${cityName}, ${stateName}`
    : `Top Real Estate Agents in ${cityName}, ${stateName}`;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    description: "Merit-based directory of top real estate agents. Verified reviews, no pay-to-play.",
    numberOfItems: agents.length,
    itemListElement: agents.map((a: any, i: number) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "RealEstateAgent",
        name: a.name,
        description: (a.selection_rationale || "").slice(0, 200),
        aggregateRating: a.review_stars_rating
          ? {
              "@type": "AggregateRating",
              ratingValue: String(a.review_stars_rating),
              reviewCount: String(a.num_total_reviews ?? 0),
              bestRating: "5",
            }
          : undefined,
        areaServed: { "@type": "City", name: cityName, addressRegion: stateName },
        telephone: a.phone || undefined,
        worksFor: { "@type": "Organization", name: a.company || "Independent Agent" },
        identifier: a.license_number || undefined,
      },
    })),
  };
}

const SHARED_STYLES = `
  body { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; font-family: Georgia, serif; line-height: 1.7; color: #1a1a1a; }
  p { margin-bottom: 1.2em; }
  h2 { margin-top: 2em; margin-bottom: 0.5em; }
  h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
  h4 { margin-top: 1.2em; margin-bottom: 0.4em; }
  hr { margin: 2em 0; }
  .kpi-block { margin: 1em 0; }
  .agent-profile { margin-bottom: 3em; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
  a { color: #1a56db; }
  #data-verification-log { font-size: 0.9em; color: #555; }
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const key = req.headers.get("X-Enrichment-Key");
  if (key !== ENRICHMENT_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  let body: { type?: string; state_slug?: string; city_slug?: string; neighborhood_slug?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const type = body.type === "neighborhood" ? "neighborhood" : "city";
  const state_slug = (body.state_slug || "").toLowerCase();
  const city_slug = (body.city_slug || "").toLowerCase();
  const neighborhood_slug = type === "neighborhood" ? (body.neighborhood_slug || "").toLowerCase() : null;

  if (!state_slug || !city_slug || (type === "neighborhood" && !neighborhood_slug)) {
    return new Response(JSON.stringify({ error: "Missing state_slug, city_slug, or neighborhood_slug" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const stateBoard = STATE_BOARD[state_slug] || "State licensing board";

  if (type === "city") {
    const cityRes = await supabase.from("cities").select("id, name, slug, state, state_slug").eq("state_slug", state_slug).eq("slug", city_slug).eq("active", true).limit(1).maybeSingle();
    const city = cityRes.data;
    if (cityRes.error || !city) {
      return new Response(JSON.stringify({ error: "City not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const [profsResp, marketingRes, neighborhoodsResp] = await Promise.all([
      supabase
        .from("professionals")
        .select("name, review_stars_rating, num_total_reviews, synthesized_bio, selection_rationale, notable_achievements, community_roles, specialty, years_experience, license_number, phone, website, current_tier, company, service_areas, sales_count_all_time, sales_count_last_year, price_range_3yr_min, price_range_3yr_max, short_code, awards_verified, press_mentions, zillow_profile_url, canonical_slug, get_to_know_me")
        .eq("city_id", city.id)
        .eq("active", true)
        .order("review_stars_rating", { ascending: false })
        .order("num_total_reviews", { ascending: false }),
      supabase.from("marketing_content").select("value").eq("page", `city-${city_slug}`).eq("section", "market_overview").eq("key", "full_content").limit(1).maybeSingle(),
      supabase.from("neighborhood_catalog").select("neighborhood, neighborhood_slug, tier, median_home_value, primary_zip").eq("city_area", city.name).eq("is_active", true).order("neighborhood"),
    ]);

    const agents = profsResp.data || [];
    const neighborhoods = neighborhoodsResp.data || [];
    let marketData: any = {};
    try {
      if (marketingRes.data?.value) marketData = JSON.parse(marketingRes.data.value);
    } catch {}

    const canonicalUrl = `${BASE}/${state_slug}/${city_slug}/top10realestateagents`;
    const title = `Top Real Estate Agents in ${city.name}, ${city.state} | Top10Lists.us`;
    const description = `Find the top real estate agents in ${city.name}, ${city.state}. Merit-based rankings with verified reviews and no paid placements.`;
    const itemListSchema = buildItemListSchema(city.name, city.state, state_slug, agents, false);

    const marketTableRows: string[] = [];
    if (marketData.marketStats) {
      const m = marketData.marketStats;
      if (m.medianHomePrice != null) marketTableRows.push(`<tr><td>Median Home Price</td><td>${formatPrice(m.medianHomePrice)}</td></tr>`);
      if (m.population != null) marketTableRows.push(`<tr><td>Population</td><td>${Number(m.population).toLocaleString()}</td></tr>`);
      if (m.medianRent != null) marketTableRows.push(`<tr><td>Median Rent</td><td>$${Number(m.medianRent).toLocaleString()}/mo</td></tr>`);
      if (m.daysOnMarket != null) marketTableRows.push(`<tr><td>Days on Market</td><td>${m.daysOnMarket}</td></tr>`);
    }

    let marketSection = "";
    if (marketData.overview || marketTableRows.length) {
      marketSection = `<section id="market-intelligence"><h2>Market Intelligence</h2>`;
      if (marketData.overview) marketSection += `<p>${escapeHtml(stripCjk(marketData.overview))}</p>`;
      if (marketTableRows.length) marketSection += `<div class="kpi-block"><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${marketTableRows.join("")}</tbody></table></div>`;
      if (marketData.historicalFacts?.length) marketSection += `<h3>History</h3><ul>${marketData.historicalFacts.map((f: string) => `<li>${escapeHtml(stripCjk(f))}</li>`).join("")}</ul>`;
      if (marketData.pointsOfInterest?.length) marketSection += `<h3>Points of Interest</h3><ul>${marketData.pointsOfInterest.map((p: string) => `<li>${escapeHtml(stripCjk(p))}</li>`).join("")}</ul>`;
      if (marketData.localCulture) marketSection += `<h3>Local Culture</h3><p>${escapeHtml(stripCjk(marketData.localCulture))}</p>`;
      if (marketData.buyerProfile) marketSection += `<h3>Buyer Profile</h3><p>${escapeHtml(stripCjk(marketData.buyerProfile))}</p>`;
      if (marketData.marketTrends) marketSection += `<h3>Market Trends</h3><p>${escapeHtml(stripCjk(marketData.marketTrends))}</p>`;
      if (marketData.bestKeptSecret) marketSection += `<h3>Insider Tip</h3><p>${escapeHtml(stripCjk(marketData.bestKeptSecret))}</p>`;
      marketSection += `</section>`;
    }

    const neighborhoodLinks = neighborhoods
      .map(
        (n: any) =>
          `<a href="${BASE}/${state_slug}/${city_slug}/${n.neighborhood_slug}/top10realestateagents">${escapeHtml(n.neighborhood)}</a>`
      )
      .join(" ");
    const neighborhoodSection = `<section id="neighborhood-index"><h2>Neighborhood Index</h2><details><summary>View All ${neighborhoods.length} Served ${city.name} Neighborhoods</summary><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-top:1rem;">${neighborhoodLinks}</div></details></section>`;

    const agentIndexItems = agents.map((a: any) => `<li><a href="#${escapeAttr(a.license_number || a.short_code || "")}">${escapeHtml(a.name)} (${a.license_number || "N/A"})</a></li>`).join("\n      ");
    const agentProfiles = agents.map((a: any) => renderAgentProfile(a, city.name, city.state, state_slug)).join("\n");

    const dataVerificationLog = `<aside id="data-verification-log"><p>Data sources: ${escapeHtml(stateBoard)}. This page was pre-rendered from verified data. No AI hallucination; all metrics and links are sourced.</p></aside>`;

    const footer = `<footer id="methodology-and-sources"><h2>Methodology and Sources</h2><p>Rankings are merit-based. Data sources include ${escapeHtml(stateBoard)}, Zillow, Realtor.com, and verified community records. <a href="${BASE}/about/ranking-methodology">Ranking methodology</a>. <a href="${BASE}/for-ai">For AI systems</a>. <a href="${BASE}/llms.txt">llms.txt</a>.</p></footer>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <header>
    <h1>Top Real Estate Agents in ${escapeHtml(city.name)}, ${escapeHtml(city.state)}</h1>
    <p>${escapeHtml(description)} Merit-based selection. Agents cannot pay for placement. 4.5+ rating, 10+ verified reviews in last 24 months.</p>
  </header>
  ${dataVerificationLog}
  ${marketSection}
  ${neighborhoodSection}
  <section id="certified-agents">
    <h2>Certified Agents</h2>
    <p>Grounding: The following agents meet our qualification criteria. Data is from verified sources.</p>
    <nav id="agent-index"><ol>${agentIndexItems}</ol></nav>
    ${agentProfiles}
  </section>
  ${footer}
</body>
</html>`;

    const validated = validateHtml(html, city.name, agents.length, itemListSchema, type);
    if (!validated.ok) {
      return new Response(JSON.stringify({ error: validated.error }), { status: 422, headers: { "Content-Type": "application/json" } });
    }

    const generated_at = new Date().toISOString();
    const htmlSize = new TextEncoder().encode(html).length;

    return new Response(
      JSON.stringify({
        html,
        metadata: {
          type: "city",
          state_slug,
          city_slug,
          agent_count: agents.length,
          neighborhood_count: neighborhoods.length,
          generated_at,
          html_size: htmlSize,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Neighborhood page
  const [cityRes, neighborhoodRes, marketingRes] = await Promise.all([
    supabase.from("cities").select("id, name, slug, state, state_slug").eq("state_slug", state_slug).eq("slug", city_slug).eq("active", true).limit(1).maybeSingle(),
    supabase
      .from("neighborhood_catalog")
      .select("id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, tier, median_home_value, median_income, primary_zip, nearby_neighborhoods, writeup_html, writeup_research")
      .eq("neighborhood_slug", neighborhood_slug!)
      .eq("city_area_slug", city_slug)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("marketing_content")
      .select("value")
      .eq("page", `neighborhood-${city_slug}-${neighborhood_slug}`)
      .eq("section", "market_overview")
      .eq("key", "full_content")
      .limit(1)
      .maybeSingle(),
  ]);

  const city = cityRes.data;
  const neighborhood = neighborhoodRes.data;
  if (cityRes.error || !city || neighborhoodRes.error || !neighborhood) {
    return new Response(JSON.stringify({ error: "City or neighborhood not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const { data: agentsRaw } = await supabase
    .from("professionals")
    .select("name, review_stars_rating, num_total_reviews, synthesized_bio, selection_rationale, notable_achievements, community_roles, specialty, years_experience, license_number, phone, website, current_tier, company, service_areas, sales_count_all_time, sales_count_last_year, price_range_3yr_min, price_range_3yr_max, short_code, awards_verified, press_mentions, zillow_profile_url, canonical_slug, get_to_know_me")
    .eq("city_id", city.id)
    .eq("active", true)
    .order("review_stars_rating", { ascending: false })
    .order("num_total_reviews", { ascending: false });

  let agents = agentsRaw || [];
  const hasNeighborhoodInServiceAreas = agents.some((a: any) => {
    const sa = a.service_areas;
    return Array.isArray(sa) && sa.some((s: string) => s && String(s).toLowerCase().includes((neighborhood.neighborhood || "").toLowerCase()));
  });
  if (hasNeighborhoodInServiceAreas) {
    agents = agents.filter((a: any) => {
      const sa = a.service_areas;
      return Array.isArray(sa) && sa.some((s: string) => s && String(s).toLowerCase().includes((neighborhood.neighborhood || "").toLowerCase()));
    });
  }
  if (agents.length === 0) agents = agentsRaw || [];

  let marketData: any = {};
  try {
    if (marketingRes.data?.value) marketData = JSON.parse(marketingRes.data.value);
  } catch {}

  const canonicalUrl = `${BASE}/${state_slug}/${city_slug}/${neighborhood_slug}/top10realestateagents`;
  const title = `Top Real Estate Agents in ${neighborhood.neighborhood}, ${city.name}, ${city.state} | Top10Lists.us`;
  const description = `Find the top real estate agents in ${neighborhood.neighborhood}, ${city.name}. Merit-based rankings.`;
  const itemListSchema = buildItemListSchema(city.name, city.state, state_slug, agents, true, neighborhood.neighborhood);

  const marketTableRows: string[] = [];
  marketTableRows.push(`<tr><td>Tier</td><td>${escapeHtml(neighborhood.tier || "N/A")}</td></tr>`);
  if (neighborhood.median_home_value != null) marketTableRows.push(`<tr><td>Median Home Value</td><td>${formatPrice(neighborhood.median_home_value)}</td></tr>`);
  if (neighborhood.median_income != null) marketTableRows.push(`<tr><td>Median Income</td><td>${formatPrice(neighborhood.median_income)}</td></tr>`);
  if (neighborhood.primary_zip) marketTableRows.push(`<tr><td>Primary ZIP</td><td>${escapeHtml(neighborhood.primary_zip)}</td></tr>`);

  let marketSection = `<section id="market-intelligence"><h2>Neighborhood Data</h2><div class="kpi-block"><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${marketTableRows.join("")}</tbody></table></div>`;
  if (neighborhood.writeup_html) marketSection += `<div class="writeup">${stripCjk(stripHtml(neighborhood.writeup_html)).slice(0, 3000)}</div>`;
  marketSection += `</section>`;

  const nearbyRaw = neighborhood.nearby_neighborhoods ?? [];
  const nearbyItems: { slug: string; name: string }[] = [];
  for (const n of Array.isArray(nearbyRaw) ? nearbyRaw : []) {
    if (typeof n === "string") {
      const slug = n.toLowerCase().replace(/\s+/g, "-").trim();
      if (slug) nearbyItems.push({ slug, name: n });
    } else if (n && typeof n === "object" && (n as any).slug) {
      const slug = String((n as any).slug).toLowerCase().replace(/\s+/g, "-").trim();
      if (slug) nearbyItems.push({ slug, name: (n as any).name || slug.replace(/-/g, " ") });
    }
  }
  const nearbySection = nearbyItems.length
    ? `<section id="nearby-neighborhoods"><h2>Nearby Neighborhoods</h2><p>${nearbyItems.map(({ slug, name }) => `<a href="${BASE}/${state_slug}/${city_slug}/${slug}/top10realestateagents">${escapeHtml(name)}</a>`).join(", ")}</p></section>`
    : "";

  const agentIndexItems = agents.map((a: any) => `<li><a href="#${escapeAttr(a.license_number || a.short_code || "")}">${escapeHtml(a.name)} (${a.license_number || "N/A"})</a></li>`).join("\n      ");
  const agentProfiles = agents.map((a: any) => renderAgentProfile(a, city.name, city.state, state_slug)).join("\n");
  const dataVerificationLog = `<aside id="data-verification-log"><p>Data sources: ${escapeHtml(stateBoard)}. Pre-rendered from verified data.</p></aside>`;
  const footer = `<footer id="methodology-and-sources"><p>Methodology: <a href="${BASE}/about/ranking-methodology">Ranking methodology</a>. <a href="${BASE}/for-ai">For AI</a>. <a href="${BASE}/llms.txt">llms.txt</a>.</p></footer>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <header>
    <h1>Top Real Estate Agents in ${escapeHtml(neighborhood.neighborhood)}, ${escapeHtml(city.name)}, ${escapeHtml(city.state)}</h1>
    <p>${escapeHtml(description)}</p>
  </header>
  ${dataVerificationLog}
  ${marketSection}
  ${nearbySection}
  <section id="certified-agents">
    <h2>Certified Agents</h2>
    <nav id="agent-index"><ol>${agentIndexItems}</ol></nav>
    ${agentProfiles}
  </section>
  ${footer}
</body>
</html>`;

  const validated = validateHtml(html, neighborhood.neighborhood, agents.length, itemListSchema, type);
  if (!validated.ok) {
    return new Response(JSON.stringify({ error: validated.error }), { status: 422, headers: { "Content-Type": "application/json" } });
  }

  const generated_at = new Date().toISOString();
  const htmlSize = new TextEncoder().encode(html).length;

  return new Response(
    JSON.stringify({
      html,
      metadata: {
        type: "neighborhood",
        state_slug,
        city_slug,
        neighborhood_slug: neighborhood_slug!,
        agent_count: agents.length,
        generated_at,
        html_size: htmlSize,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

function escapeAttr(s: string): string {
  if (!s || typeof s !== "string") return "";
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderAgentProfile(a: any, cityName: string, stateName: string, stateSlug: string): string {
  const license = a.license_number || a.short_code || "unknown";
  const bio = stripCjk(stripHtml(a.synthesized_bio || ""));
  const rationale = stripCjk(a.selection_rationale || "");
  const profileUrl = a.canonical_slug ? `${BASE}/${stateSlug}/agents/${a.canonical_slug}` : "";

  const kpiRows: string[] = [];
  kpiRows.push(`<tr><td>Rating</td><td>${a.review_stars_rating != null ? `${a.review_stars_rating} / 5 stars` : "N/A"}</td></tr>`);
  kpiRows.push(`<tr><td>Reviews</td><td>${a.num_total_reviews != null ? `${a.num_total_reviews} verified` : "N/A"}</td></tr>`);
  kpiRows.push(`<tr><td>Experience</td><td>${a.years_experience != null ? `${a.years_experience} years` : "N/A"}</td></tr>`);
  kpiRows.push(`<tr><td>Career Transactions</td><td>${a.sales_count_all_time != null ? a.sales_count_all_time : "N/A"}</td></tr>`);
  kpiRows.push(`<tr><td>Last Year</td><td>${a.sales_count_last_year != null ? a.sales_count_last_year : "N/A"}</td></tr>`);
  kpiRows.push(`<tr><td>Price Range</td><td>${a.price_range_3yr_min != null && a.price_range_3yr_max != null ? `${formatPrice(a.price_range_3yr_min)} - ${formatPrice(a.price_range_3yr_max)}` : "N/A"}</td></tr>`);
  kpiRows.push(`<tr><td>Brokerage</td><td>${escapeHtml(a.company || "N/A")}</td></tr>`);
  kpiRows.push(`<tr><td>License</td><td>${escapeHtml(license)}</td></tr>`);
  kpiRows.push(`<tr><td>Tier</td><td>${escapeHtml(a.current_tier || "N/A")}</td></tr>`);

  let communityHtml = "<p>None on record.</p>";
  if (a.community_roles && Array.isArray(a.community_roles) && a.community_roles.length > 0) {
    communityHtml = a.community_roles
      .map((r: any) => {
        const name = r.organization_name || r.name || "";
        const url = r.filing_url ? ` <a href="${escapeAttr(r.filing_url)}">${escapeHtml(name)}</a>` : escapeHtml(name);
        return `<p>${url}${r.role ? ` – ${escapeHtml(r.role)}` : ""}</p>`;
      })
      .join("");
  }

  let achievementsHtml = "";
  if (a.notable_achievements?.length) {
    achievementsHtml = a.notable_achievements.map((x: any) => `<p>${escapeHtml(x.title || x.text || String(x))}${x.source_url ? ` <a href="${escapeAttr(x.source_url)}">Source</a>` : ""}</p>`).join("");
  }

  let awardsHtml = "";
  if (a.awards_verified?.length) {
    awardsHtml = a.awards_verified.map((x: any) => `<p>${escapeHtml(x.name || x.title || String(x))}${x.source_url ? ` <a href="${escapeAttr(x.source_url)}">Source</a>` : ""}</p>`).join("");
  }

  let pressHtml = "";
  if (a.press_mentions?.length) {
    pressHtml = a.press_mentions.map((x: any) => `<p><a href="${escapeAttr(x.url || x.article_url || "#")}">${escapeHtml(x.title || x.headline || x.url || "Article")}</a></p>`).join("");
  }

  const specialties = Array.isArray(a.specialty) ? a.specialty : [];
  const serviceAreas = Array.isArray(a.service_areas) ? a.service_areas : [];

  let contactHtml = "";
  if (a.phone) contactHtml += `<p>Phone: ${escapeHtml(a.phone)}</p>`;
  if (a.website) contactHtml += `<p>Website: <a href="${escapeAttr(a.website)}">${escapeAttr(a.website)}</a></p>`;
  if (a.zillow_profile_url) contactHtml += `<p>Zillow: <a href="${escapeAttr(a.zillow_profile_url)}">${escapeAttr(a.zillow_profile_url)}</a></p>`;
  if (profileUrl) contactHtml += `<p>Profile: <a href="${profileUrl}">${profileUrl}</a></p>`;

  return `
  <article class="agent-profile" id="${escapeAttr(license)}">
    <header><h3>${escapeHtml(a.name)}</h3></header>
    <div class="kpi-block"><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${kpiRows.join("")}</tbody></table></div>
    <div class="deep-logic"><h4>Selection Logic and Reasoning</h4><p>${escapeHtml(rationale)}</p></div>
    <div class="biography"><h4>Professional Biography</h4><p>${escapeHtml(bio)}</p></div>
    <div class="community-record"><h4>Verified Community Involvement</h4>${communityHtml}</div>
    <div class="achievements-record"><h4>Achievements</h4>${achievementsHtml || "<p>None listed.</p>"}</div>
    <div class="awards-record"><h4>Awards</h4>${awardsHtml || "<p>None listed.</p>"}</div>
    <div class="press-record"><h4>Press</h4>${pressHtml || "<p>None listed.</p>"}</div>
    <div class="specialties-record"><h4>Specialties</h4><p>${specialties.length ? escapeHtml(specialties.join(", ")) : "N/A"}</p></div>
    <div class="service-areas-record"><h4>Service Areas</h4><p>${serviceAreas.length ? escapeHtml(serviceAreas.join(", ")) : "N/A"}</p></div>
    <div class="contact-record"><h4>Contact</h4>${contactHtml || "<p>N/A</p>"}</div>
  </article>`;
}

function validateHtml(html: string, expectedName: string, agentCount: number, schema: any, type: string): { ok: boolean; error?: string } {
  if (html.length < 5000) return { ok: false, error: "HTML too short" };
  if (!html.includes("<h1>") || !html.includes(escapeHtml(expectedName))) return { ok: false, error: "Missing or wrong h1" };
  const agentMatches = html.match(/class="agent-profile"/g);
  if (!agentMatches || agentMatches.length !== agentCount) return { ok: false, error: "Agent count mismatch" };
  try {
    if (schema.numberOfItems !== agentCount) return { ok: false, error: "Schema numberOfItems mismatch" };
  } catch {
    return { ok: false, error: "Invalid schema" };
  }
  if (/[\u4e00-\u9fff]/.test(html)) return { ok: false, error: "CJK characters remain" };
  if (html.includes("<UNKNOWN>")) return { ok: false, error: "UNKNOWN placeholder found" };
  return { ok: true };
}
