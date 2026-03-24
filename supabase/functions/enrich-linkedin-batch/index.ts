/**
 * enrich-linkedin-batch — Batch LinkedIn URL enrichment via Serper.
 *
 * Finds LinkedIn profiles for active professionals missing social_linkedin.
 * Uses Serper Google search: site:linkedin.com/in/ "{name}" real estate {state}
 * Validates by checking agent first+last name appear in the LinkedIn URL slug.
 *
 * POST body:
 * {
 *   limit?: number,          // max agents to process (default 100)
 *   state?: string,          // filter by state_slug (optional)
 *   dry_run?: boolean        // if true, don't write to DB (default false)
 * }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SERPER_KEY = Deno.env.get("SERPER_API_KEY")!;

const DELAY_MS = 300; // between Serper calls

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function isStrongMatch(agentName: string, linkedinSlug: string): boolean {
  const parts = agentName.trim().split(/\s+/);
  if (parts.length < 2) return false;
  const first = normalize(parts[0]);
  const last = normalize(parts[parts.length - 1]);
  const slug = normalize(linkedinSlug);
  return slug.includes(first) && slug.includes(last);
}

async function searchLinkedIn(name: string, state: string): Promise<{ url: string | null; title: string | null }> {
  const stateDisplay = state === "arizona" ? "Arizona" : state === "california" ? "California" : state;
  const q = `site:linkedin.com/in/ "${name}" real estate ${stateDisplay}`;

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q, num: 1 }),
  });

  if (!res.ok) return { url: null, title: null };
  const data = await res.json();
  const top = data.organic?.[0];
  if (!top?.link?.includes("linkedin.com/in/")) return { url: null, title: null };
  return { url: top.link, title: top.title || null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const t0 = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(body.limit || 100, 500);
    const stateFilter = body.state || null;
    const dryRun = body.dry_run === true;

    // Fetch agents missing LinkedIn
    let query = supabase
      .from("professionals")
      .select("id, name, state_slug")
      .eq("active", true)
      .is("social_linkedin", null)
      .order("num_total_reviews", { ascending: false })
      .limit(limit);

    if (stateFilter) query = query.eq("state_slug", stateFilter);

    const { data: agents, error } = await query;
    if (error) throw error;
    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ success: true, total: 0, found: 0, saved: 0, elapsed_ms: Date.now() - t0 }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let found = 0;
    let saved = 0;
    let missed = 0;
    const results: { name: string; linkedin: string | null; match: string }[] = [];

    for (const agent of agents) {
      const { url, title } = await searchLinkedIn(agent.name, agent.state_slug);

      if (url) {
        const slug = url.split("/in/")[1] || "";
        if (isStrongMatch(agent.name, slug)) {
          found++;
          if (!dryRun) {
            await supabase
              .from("professionals")
              .update({ social_linkedin: url })
              .eq("id", agent.id);
            saved++;
          }
          results.push({ name: agent.name, linkedin: url, match: "strong" });
        } else {
          missed++;
          results.push({ name: agent.name, linkedin: url, match: "weak_skipped" });
        }
      } else {
        missed++;
        results.push({ name: agent.name, linkedin: null, match: "not_found" });
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: agents.length,
        found,
        saved,
        missed,
        dry_run: dryRun,
        cost_estimate: `$${(agents.length * 0.003).toFixed(2)}`,
        elapsed_ms: Date.now() - t0,
        results,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
