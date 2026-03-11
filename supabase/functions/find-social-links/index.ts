import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-enrichment-key",
};

/**
 * find-social-links
 *
 * Uses Serper.dev (Google Search API) to find social profile URLs for agents
 * across 8 platforms: LinkedIn, Facebook, Instagram, TikTok, HomeLight,
 * Homes.com, Realtor.com, Zillow.
 *
 * Single mode:
 *   POST { name, city, state?, professional_id?, save?, platforms? }
 *
 * Batch mode:
 *   POST { batch: true, limit?: number, offset?: number, state?: string, save?: true, force?: false, platforms? }
 *   Pulls agents from professionals table, skips those already enriched (unless force=true).
 *
 * Lookup mode (by IDs):
 *   POST { agents: [{ name, city, state?, professional_id? }], save?, platforms? }
 */

interface PlatformConfig {
  column: string;
  siteQuery: string;
  urlPattern: RegExp;
}

const PLATFORMS: Record<string, PlatformConfig> = {
  linkedin: {
    column: "social_linkedin",
    siteQuery: "site:linkedin.com/in",
    urlPattern: /linkedin\.com\/in\//i,
  },
  facebook: {
    column: "social_facebook",
    siteQuery: "site:facebook.com",
    // Reject posts, groups, marketplace, events, search — accept profile/page URLs
    urlPattern: /facebook\.com\/(?!search|groups\/|marketplace|events\/|watch\/|gaming\/|login|help|policies)[a-zA-Z0-9.]+/i,
  },
  instagram: {
    column: "social_instagram",
    siteQuery: "site:instagram.com",
    // Reject /p/ (posts), /reel/, /stories/ — accept profile URLs
    urlPattern: /instagram\.com\/(?!p\/|reel\/|explore\/|stories\/|accounts\/)[a-zA-Z0-9_.]+/i,
  },
  tiktok: {
    column: "social_tiktok",
    siteQuery: "site:tiktok.com/@",
    // Accept @username profiles (normalize strips /video/ paths)
    urlPattern: /tiktok\.com\/@[a-zA-Z0-9_.]+/i,
  },
  homelight: {
    column: "social_homelight",
    siteQuery: "site:homelight.com/agents",
    urlPattern: /homelight\.com\/agents\//i,
  },
  homes_com: {
    column: "social_homes_com",
    siteQuery: "site:homes.com/real-estate-agent",
    urlPattern: /homes\.com\/real-estate-agent\//i,
  },
  realtor_com: {
    column: "social_realtor_com",
    siteQuery: "site:realtor.com/realestateagents",
    urlPattern: /realtor\.com\/realestateagents\//i,
  },
  zillow: {
    column: "zillow_profile_url",
    siteQuery: "site:zillow.com/profile",
    urlPattern: /zillow\.com\/profile\//i,
  },
};

const ALL_PLATFORM_KEYS = Object.keys(PLATFORMS);
const SERPER_URL = "https://google.serper.dev/search";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serperKey = Deno.env.get("SERPER_API_KEY");
    if (!serperKey) {
      return jsonResp({ success: false, error: "SERPER_API_KEY not configured" }, 500);
    }

    const body = await req.json();
    const platforms = parsePlatforms(body.platforms);

    // Batch mode: pull from professionals table
    if (body.batch) {
      return await handleBatch(serperKey, body, platforms);
    }

    // Array mode: process provided agents
    if (Array.isArray(body.agents)) {
      return await handleAgentArray(serperKey, body, platforms);
    }

    // Single mode
    const { name, city, state, professional_id } = body;
    if (!name || !city) {
      return jsonResp({ success: false, error: "name and city are required" }, 400);
    }

    const results = await findSocialLinks(serperKey, name, city, state, platforms);

    if (body.save && professional_id) {
      await saveResults([{ professional_id, links: results }]);
    }

    return jsonResp({ success: true, name, city, state, links: results });
  } catch (err: any) {
    console.error("find-social-links error:", err);
    return jsonResp({ success: false, error: err.message }, 500);
  }
});

function parsePlatforms(input?: string[] | string): string[] {
  if (!input) return ALL_PLATFORM_KEYS;
  const list = Array.isArray(input) ? input : input.split(",").map((s) => s.trim());
  return list.filter((p) => PLATFORMS[p]);
}

async function handleBatch(
  serperKey: string,
  body: any,
  platforms: string[]
): Promise<Response> {
  const limit = Math.min(body.limit || 50, 200);
  const offset = body.offset || 0;
  const force = body.force || false;
  const save = body.save !== false;

  const supabase = getSupabase();

  let query = supabase
    .from("professionals")
    .select("id, name, business_city, business_state, state_slug")
    .eq("active", true)
    .order("name")
    .range(offset, offset + limit - 1);

  if (body.state) {
    // Support both state abbreviation and slug
    const stateVal = body.state.toLowerCase();
    if (stateVal.length === 2) {
      // Map abbreviation to slug
      const slugMap: Record<string, string> = { az: "arizona", ca: "california", tx: "texas", fl: "florida", ny: "new-york", co: "colorado" };
      query = query.eq("state_slug", slugMap[stateVal] || stateVal);
    } else {
      query = query.eq("state_slug", stateVal);
    }
  }

  // Skip already-enriched agents unless force=true
  if (!force) {
    // Find agents missing at least one of the requested platform columns
    const orFilter = platforms.map((p) => `${PLATFORMS[p].column}.is.null`).join(",");
    query = query.or(orFilter);
  }

  const { data: agents, error } = await query;
  if (error) {
    return jsonResp({ success: false, error: error.message }, 500);
  }

  if (!agents || agents.length === 0) {
    return jsonResp({ success: true, message: "No agents to process", count: 0, results: [] });
  }

  const results = [];
  let queriesUsed = 0;

  // Map state_slug to abbreviation for search queries
  const slugToAbbr: Record<string, string> = { arizona: "AZ", california: "CA", texas: "TX", florida: "FL", "new-york": "NY", colorado: "CO" };

  for (const agent of agents) {
    const stateForSearch = agent.business_state || slugToAbbr[agent.state_slug] || "";
    const links = await findSocialLinks(
      serperKey,
      agent.name,
      agent.business_city || "",
      stateForSearch,
      platforms
    );
    queriesUsed += platforms.length;

    const result = {
      professional_id: agent.id,
      name: agent.name,
      city: agent.business_city,
      state: agent.business_state,
      links,
    };
    results.push(result);

    if (save) {
      await saveResults([{ professional_id: agent.id, links }]);
    }

    // Small delay between agents to avoid rate limits
    if (agents.length > 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return jsonResp({
    success: true,
    count: results.length,
    queries_used: queriesUsed,
    offset,
    next_offset: offset + agents.length,
    results,
  });
}

async function handleAgentArray(
  serperKey: string,
  body: any,
  platforms: string[]
): Promise<Response> {
  const agents = body.agents.slice(0, 50);
  const results = [];

  for (const agent of agents) {
    const links = await findSocialLinks(
      serperKey,
      agent.name,
      agent.city,
      agent.business_state,
      platforms
    );
    results.push({ ...agent, links });

    if (agents.length > 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  if (body.save) {
    await saveResults(
      results
        .filter((r) => r.professional_id)
        .map((r) => ({ professional_id: r.professional_id, links: r.links }))
    );
  }

  return jsonResp({ success: true, count: results.length, results });
}

function normalizeProfileUrl(platform: string, url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    switch (platform) {
      case "facebook":
        // facebook.com/<username> — keep only first path segment
        if (parts.length >= 1) return `${u.origin}/${parts[0]}`;
        break;
      case "instagram":
        // instagram.com/<username>
        if (parts.length >= 1) return `${u.origin}/${parts[0]}`;
        break;
      case "tiktok":
        // tiktok.com/@username
        if (parts.length >= 1 && parts[0].startsWith("@")) return `${u.origin}/${parts[0]}`;
        break;
      case "linkedin":
        // linkedin.com/in/<slug>
        if (parts.length >= 2 && parts[0] === "in") return `${u.origin}/in/${parts[1]}`;
        break;
    }
  } catch {
    // URL parse failed, return as-is
  }
  return url;
}

async function findSocialLinks(
  serperKey: string,
  name: string,
  city: string,
  state: string | undefined,
  platforms: string[]
): Promise<Record<string, { url: string | null; title: string | null; snippet: string | null }>> {
  const location = [city, state].filter(Boolean).join(" ");
  const results: Record<string, { url: string | null; title: string | null; snippet: string | null }> = {};

  // Run all platform searches in parallel
  const searches = platforms.map(async (platform) => {
    const config = PLATFORMS[platform];
    const query = `"${name}" ${location} real estate ${config.siteQuery}`;

    try {
      const res = await fetch(SERPER_URL, {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num: 3 }),
      });

      if (!res.ok) {
        console.error(`Serper error for ${platform} "${name}":`, await res.text());
        return { platform, url: null, title: null, snippet: null };
      }

      const data = await res.json();
      const items = data.organic || [];

      const match = items.find((item: any) => item.link && config.urlPattern.test(item.link));

      if (!match) {
        return { platform, url: null, title: null, snippet: null };
      }

      // Clean URL: remove query params, trailing slashes, normalize to profile root
      let cleanUrl = match.link.split("?")[0].replace(/\/+$/, "");
      cleanUrl = normalizeProfileUrl(platform, cleanUrl);

      return {
        platform,
        url: cleanUrl,
        title: match.title || null,
        snippet: match.snippet?.substring(0, 200) || null,
      };
    } catch (err: any) {
      console.error(`Search error for ${platform} "${name}":`, err.message);
      return { platform, url: null, title: null, snippet: null };
    }
  });

  const searchResults = await Promise.all(searches);

  for (const r of searchResults) {
    results[r.platform] = { url: r.url, title: r.title, snippet: r.snippet };
  }

  return results;
}

async function saveResults(
  items: Array<{ professional_id: string; links: Record<string, any> }>
) {
  const supabase = getSupabase();

  for (const item of items) {
    const update: Record<string, any> = {};

    for (const [platform, result] of Object.entries(item.links)) {
      if (result.url && PLATFORMS[platform]) {
        update[PLATFORMS[platform].column] = result.url;
      }
    }

    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from("professionals")
        .update(update)
        .eq("id", item.professional_id);

      if (error) {
        console.error(`Save error for ${item.professional_id}:`, error.message);
      }
    }
  }
}

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
