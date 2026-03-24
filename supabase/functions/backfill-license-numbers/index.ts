import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * backfill-license-numbers
 *
 * Matches active professionals missing license numbers against:
 *   1. state_licenses table (CA, TX, FL -- exact name + nickname expansion + city disambiguation)
 *   2. Serper search against realtor.com / AZRE.gov / BBB (AZ -- not in state_licenses)
 *
 * Run after memo23 enrichment or any agent discovery batch.
 * Only processes agents that are already active=true.
 *
 * POST body:
 *   { stateSlug?: "arizona"|"california", limit?: number, dryRun?: boolean }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLACEHOLDERS = new Set([
  "1522444", "N/A", "Not provided", "AZ License", "HSMOVE", "DV139", "",
]);

const NICKNAMES: Record<string, string[]> = {
  Bill: ["William", "Billy"], Bob: ["Robert", "Bobby"], Rich: ["Richard"],
  Tom: ["Thomas"], Patty: ["Patricia", "Patti"],
  Chris: ["Christopher", "Christine", "Christina"],
  Dan: ["Daniel"], Dave: ["David"], Mike: ["Michael"],
  Jeff: ["Jeffrey", "Geoffrey"], Becca: ["Rebecca"], Jen: ["Jennifer"],
  Kris: ["Kristin", "Kristine", "Kristen"],
  Shelly: ["Shelley", "Michelle"], Cindy: ["Cynthia"],
  Rachael: ["Rachel"], Katie: ["Katherine", "Kathryn"],
  Ray: ["Raymond"], Eddie: ["Edward"],
  Frank: ["Francisco", "Franklin"], Steve: ["Stephen"], Len: ["Leonard"],
  J: ["James", "John", "Jason", "Joseph", "Jeffrey"],
  Jack: ["John", "Jackson"], Lew: ["Lewis"],
  Pat: ["Patricia", "Patrick"], Jim: ["James"],
  Dick: ["Richard"], Joe: ["Joseph"], Ed: ["Edward", "Edwin"],
  Sam: ["Samuel"], Ben: ["Benjamin"], Nick: ["Nicholas"],
  Matt: ["Matthew"], Alex: ["Alexander", "Alexandra"],
  Tony: ["Anthony"], Megan: ["Margaret"],
};

const STATE_ABBR: Record<string, string> = {
  arizona: "AZ", california: "CA", texas: "TX", florida: "FL",
  "new-york": "NY", colorado: "CO",
};

interface MatchResult {
  license: string;
  via: string;
  confidence: "high" | "medium";
}

// ── state_licenses matching (CA, TX, FL, etc.) ──────────────────────
async function tryStateLicenses(
  supabase: any,
  agentName: string,
  stateAbbr: string,
  city: string
): Promise<MatchResult | null> {
  if (!stateAbbr) return null;

  const parts = agentName.trim().split(/\s+/);
  if (parts.length < 2) return null;

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const firstNames = [firstName, ...(NICKNAMES[firstName] || [])];

  for (const fn of firstNames) {
    const pattern = `${fn}%${lastName}`;
    const { data, error } = await supabase
      .from("state_licenses")
      .select("name, license_number, city")
      .eq("state", stateAbbr)
      .ilike("name", pattern)
      .limit(10);

    if (error || !data || data.length === 0) continue;

    if (data.length === 1) {
      return {
        license: data[0].license_number,
        via: `state_licenses (${fn})`,
        confidence: "high",
      };
    }

    // City disambiguation
    if (city) {
      const cm = data.filter(
        (r: any) => r.city && r.city.toUpperCase().includes(city.toUpperCase())
      );
      if (cm.length === 1) {
        return {
          license: cm[0].license_number,
          via: `state_licenses + city (${fn})`,
          confidence: "high",
        };
      }
    }
  }

  return null;
}

// ── Serper search (AZ agents + team designated brokers) ─────────────
async function trySerper(
  agentName: string,
  city: string,
  stateSlug: string,
  serperKey: string
): Promise<MatchResult | null> {
  if (!serperKey) return null;

  const isTeam =
    /team|realty|group|associates|real estate|compass|coldwell|remax|exp |brokery|built by|selling|property|windermere|emprea|elite/i.test(
      agentName
    );

  const stateWord =
    stateSlug === "california" ? "California" : "Arizona";

  const queries = isTeam
    ? [
        `"${agentName}" ${city || stateWord} designated broker license number`,
        `"${agentName}" ${stateWord} REALTOR broker owner license`,
      ]
    : [
        `"${agentName}" ${city || ""} ${stateWord} real estate license number site:realtor.com`,
        `"${agentName}" ${city || ""} ${stateWord} license AZRE OR DRE`,
      ];

  for (const q of queries) {
    try {
      const resp = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q, num: 5 }),
      });
      const data = await resp.json();
      const snippets = (data.organic || [])
        .map((r: any) => `${r.title || ""} ${r.snippet || ""}`)
        .join(" ");

      // AZ pattern: SA/BR + 9 digits
      const azMatch = snippets.match(
        /(?:license\s*#?\s*|License:\s*|#)((?:SA|BR)\d{9})/i
      );
      if (azMatch) {
        return {
          license: azMatch[1],
          via: `serper (${isTeam ? "team DB" : "individual"})`,
          confidence: "medium",
        };
      }

      // Also try looser pattern
      const looseMatch = snippets.match(/((?:SA|BR)\d{9})/);
      if (looseMatch) {
        return {
          license: looseMatch[1],
          via: `serper loose (${isTeam ? "team DB" : "individual"})`,
          confidence: "medium",
        };
      }

      // CA pattern: 8 digits (DRE)
      if (stateSlug === "california") {
        const caMatch = snippets.match(
          /(?:DRE|license)\s*#?\s*:?\s*(\d{8})/i
        );
        if (caMatch) {
          return {
            license: caMatch[1],
            via: `serper CA DRE`,
            confidence: "medium",
          };
        }
      }
    } catch {
      // continue
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const serperKey = Deno.env.get("SERPER_API_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const stateSlug: string = body.stateSlug || "";
    const limit: number = body.limit || 50;
    const dryRun: boolean = body.dryRun || false;

    console.log(
      `[backfill] state=${stateSlug || "all"} limit=${limit} dryRun=${dryRun}`
    );

    // Build placeholder filter for SQL
    const phList = [...PLACEHOLDERS]
      .filter((p) => p)
      .map((p) => `'${p}'`)
      .join(",");

    let query = `
      SELECT id, name, business_city, state_slug
      FROM professionals
      WHERE active = true
        AND (license_number IS NULL
             OR license_number IN (${phList})
             OR license_number = '')
    `;
    if (stateSlug) {
      query += ` AND state_slug = '${stateSlug.replace(/'/g, "''")}'`;
    } else {
      query += ` AND state_slug IN ('arizona','california','texas')`;
    }
    query += ` ORDER BY name LIMIT ${limit}`;

    const { data: agents, error: err } = await supabase.rpc("run_sql", {
      query,
    });
    if (err) throw new Error(`fetch agents: ${err.message}`);
    if (!agents || agents.length === 0) {
      return json({
        success: true,
        message: "No agents missing license numbers",
        matched: 0,
        unmatched: 0,
      });
    }

    console.log(`[backfill] ${agents.length} agents missing license numbers`);

    const matched: Array<{
      id: string;
      name: string;
      license: string;
      via: string;
    }> = [];
    const unmatched: Array<{
      name: string;
      city: string;
      state: string;
    }> = [];

    for (const agent of agents) {
      const stateAbbr = STATE_ABBR[agent.state_slug] || "";
      const city = agent.business_city || "";

      // Step 1: state_licenses table (works for CA, TX, FL)
      let result = await tryStateLicenses(supabase, agent.name, stateAbbr, city);

      // Step 2: Serper (for AZ or if state_licenses missed)
      if (!result && serperKey) {
        result = await trySerper(agent.name, city, agent.state_slug, serperKey);
      }

      if (result) {
        if (!dryRun) {
          const { error: ue } = await supabase
            .from("professionals")
            .update({ license_number: result.license })
            .eq("id", agent.id);
          if (ue) {
            console.error(`[backfill] FAIL ${agent.name}: ${ue.message}`);
            unmatched.push({ name: agent.name, city, state: agent.state_slug });
            continue;
          }
        }
        matched.push({
          id: agent.id,
          name: agent.name,
          license: result.license,
          via: result.via,
        });
        console.log(
          `[backfill] OK: ${agent.name} -> ${result.license} [${result.via}]`
        );
      } else {
        unmatched.push({ name: agent.name, city, state: agent.state_slug });
        console.log(`[backfill] NO MATCH: ${agent.name} (${city})`);
      }
    }

    console.log(
      `[backfill] Done: ${matched.length} matched, ${unmatched.length} unmatched`
    );

    return json({
      success: true,
      dryRun,
      matched: matched.length,
      unmatched: unmatched.length,
      matchedAgents: matched,
      unmatchedAgents: unmatched,
    });
  } catch (error: any) {
    console.error("[backfill] Fatal:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function json(body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
