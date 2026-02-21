/**
 * Search Agent Presence
 * Finds where an agent is listed, mentioned, certified, in news, etc.
 * Uses Google Custom Search JSON API (no Exa).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export type PresenceType = "listing" | "mention" | "certification" | "news" | "other";

export interface PresenceResult {
  url: string;
  title: string;
  snippet?: string;
  type: PresenceType;
  source?: string;
}

export interface PresenceSearchResponse {
  agentName: string;
  city?: string;
  state?: string;
  listings: PresenceResult[];
  mentions: PresenceResult[];
  certifications: PresenceResult[];
  news: PresenceResult[];
  other: PresenceResult[];
  totalCount: number;
  queriedAt: string;
}

const LISTING_DOMAINS = [
  "zillow.com",
  "realtor.com",
  "redfin.com",
  "homes.com",
  "trulia.com",
  "remax.com",
  "coldwellbanker.com",
  "kw.com",
  "compass.com",
  "exprealty.com",
  "loopnet.com",
  "streeteasy.com",
];

const NEWS_DOMAINS = [
  "wsj.com",
  "nytimes.com",
  "forbes.com",
  "cnn.com",
  "businessjournal",
  "bizjournals",
  "realtor.com/magazine",
  "housingwire.com",
  "realtrends.com",
  "inman.com",
  "realtor.org",
  "patch.com",
  "prnewswire",
  "businesswire",
  "globenewswire",
];

const CERTIFICATION_KEYWORDS = [
  "top agent",
  "best realtor",
  "award",
  "recognition",
  "certified",
  "designation",
  "gri",
  "crs",
  "abr",
  "sres",
  "realtrends",
  "real trends",
  "top 1000",
  "platinum",
  "diamond",
];

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace("www.", "");
  } catch {
    return "";
  }
}

function classifyResult(url: string, title: string, snippet: string): PresenceType {
  const host = getHostname(url);
  const content = (title + " " + snippet).toLowerCase();

  if (LISTING_DOMAINS.some((d) => host.includes(d))) return "listing";
  if (NEWS_DOMAINS.some((d) => host.includes(d))) return "news";
  if (CERTIFICATION_KEYWORDS.some((kw) => content.includes(kw))) return "certification";
  if (
    content.includes("interview") ||
    content.includes("featured") ||
    content.includes("article") ||
    content.includes("report")
  ) {
    return "news";
  }
  return "mention";
}

async function googleCustomSearch(
  query: string,
  apiKey: string,
  cx: string,
  num: number = 10
): Promise<{ url: string; title: string; snippet: string }[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(num, 10)));

  const resp = await fetch(url.toString(), { method: "GET" });
  if (!resp.ok) {
    console.error("Custom Search API error:", resp.status, await resp.text());
    return [];
  }

  const data = await resp.json();
  const items = data.items || [];
  return items.map((item: { link?: string; title?: string; snippet?: string }) => ({
    url: item.link || "",
    title: item.title || "",
    snippet: item.snippet || "",
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_CSE_API_KEY");
    const cx = Deno.env.get("GOOGLE_CSE_CX");
    if (!apiKey || !cx) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX must be set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { professionalId, agentName, city, state, company } = body;

    let name = agentName;
    let locCity = city;
    let locState = state;

    if (professionalId && (!name || !locCity || !locState)) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: prof, error } = await supabase
        .from("professionals")
        .select("id, name, company, business_name, cities(name, state)")
        .eq("id", professionalId)
        .maybeSingle();

      if (error || !prof) {
        return new Response(
          JSON.stringify({ error: "Professional not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      name = name || prof.name;
      const cities = prof.cities as { name?: string; state?: string } | null;
      locCity = locCity || cities?.name || "";
      locState = locState || cities?.state || "";
    }

    if (!name) {
      return new Response(
        JSON.stringify({ error: "agentName or professionalId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const location = [locCity, locState].filter(Boolean).join(" ");
    const companyName = company || "";

    const queries: string[] = [
      `"${name}" real estate agent ${location}`.trim(),
      `"${name}" realtor ${location}`.trim(),
      `"${name}" real estate ${location} news`,
      `"${name}" real estate agent award certification`,
    ];
    if (companyName) {
      queries.push(`"${name}" "${companyName}" real estate`);
    }

    const allRaw: { url: string; title: string; snippet: string }[] = [];
    for (const q of queries) {
      const results = await googleCustomSearch(q, apiKey, cx, 10);
      allRaw.push(...results);
      await new Promise((r) => setTimeout(r, 350));
    }

    const seen = new Set<string>();
    const unique: PresenceResult[] = [];

    for (const r of allRaw) {
      const norm = r.url.toLowerCase().split("?")[0];
      if (seen.has(norm)) continue;
      seen.add(norm);

      const type = classifyResult(r.url, r.title, r.snippet);
      const host = getHostname(r.url);

      unique.push({
        url: r.url,
        title: r.title,
        snippet: r.snippet,
        type,
        source: host,
      });
    }

    const listings = unique.filter((u) => u.type === "listing");
    const mentions = unique.filter((u) => u.type === "mention");
    const certifications = unique.filter((u) => u.type === "certification");
    const news = unique.filter((u) => u.type === "news");
    const other = unique.filter((u) => u.type === "other");

    const response: PresenceSearchResponse = {
      agentName: name,
      city: locCity || undefined,
      state: locState || undefined,
      listings,
      mentions,
      certifications,
      news,
      other,
      totalCount: unique.length,
      queriedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[search-agent-presence] error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
