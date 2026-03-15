import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const WEIGHTS = {
  knowledge_graph: 25,
  sitelink_salience: 10,
  related_citations: 15,
  third_party: 10,
  data_freshness: 20,
  selection_rationale: 10,
  crypto_verification: 10,
};

const BATCH_SIZE = 50;
const CONCURRENCY = 10;

const HIGH_AUTHORITY_DOMAINS = [
  "realtor.com", "zillow.com", "bbb.org", "nar.realtor",
  "azcentral.com", "latimes.com", "sfchronicle.com",
  ".gov", ".edu", "bizjournals.com", "forbes.com",
  "homes.com", "redfin.com",
];

interface SerpSignals {
  hasKnowledgeGraph: boolean;
  hasSitelinkSalience: boolean;
  hasRelatedCitations: boolean;
  thirdPartyValidationCount: number;
}

interface InternalSignals {
  dataFreshnessDays: number | null;
  hasSelectionRationale: boolean;
  hasCryptoVerification: boolean;
  currentTier: string | null;
}

interface AgentRow {
  id: string;
  name: string;
  company: string | null;
  website: string | null;
  city_name: string;
  state_slug: string;
  current_tier: string | null;
}

async function querySerper(agentName: string, city: string, state: string): Promise<{ query: string; data: any }> {
  const query = `${agentName} ${city} ${state} real estate`;
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      location: `${city}, ${state}`,
      gl: "us",
      num: 10,
    }),
  });
  if (!res.ok) throw new Error(`Serper error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { query, data };
}

function extractSerpSignals(serperResponse: any, agentName: string, agentDomain?: string | null): SerpSignals {
  const nameLower = agentName.toLowerCase();
  const nameParts = nameLower.split(" ").filter(Boolean);
  const lastName = nameParts[nameParts.length - 1] || nameLower;

  // 1. Knowledge Graph (25 pts)
  const kg = serperResponse.knowledgeGraph;
  let hasKnowledgeGraph = false;
  if (kg) {
    // Validate KG is actually about this agent (not a different person)
    const kgTitle = (kg.title || "").toLowerCase();
    hasKnowledgeGraph = kgTitle.includes(lastName);
  }

  // 2. Sitelink Salience (10 pts) -- agent's domain is #1 organic result
  let hasSitelinkSalience = false;
  if (agentDomain && serperResponse.organic?.length > 0) {
    const cleanDomain = agentDomain.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const topResult = (serperResponse.organic[0].link || "").toLowerCase();
    hasSitelinkSalience = topResult.includes(cleanDomain);
  }

  // 3. Related Entity Citations (15 pts) -- name in relatedSearches or peopleAlsoAsk
  let hasRelatedCitations = false;
  const relatedSearches = (serperResponse.relatedSearches || []).map((r: any) => (r.query || "").toLowerCase());
  const peopleAlsoAsk = (serperResponse.peopleAlsoAsk || []).map((p: any) => (p.question || "").toLowerCase());
  const allRelated = [...relatedSearches, ...peopleAlsoAsk];
  hasRelatedCitations = allRelated.some((text: string) => text.includes(lastName));

  // 4. Third-Party Validation (10 pts) -- mentions on high-authority domains
  let thirdPartyValidationCount = 0;
  for (const result of serperResponse.organic || []) {
    const link = (result.link || "").toLowerCase();
    if (HIGH_AUTHORITY_DOMAINS.some((domain) => link.includes(domain))) {
      thirdPartyValidationCount++;
    }
  }

  return { hasKnowledgeGraph, hasSitelinkSalience, hasRelatedCitations, thirdPartyValidationCount };
}

function calculateAIFS(serp: SerpSignals, internal: InternalSignals): {
  total: number;
  band: "invisible" | "fragmented" | "recognized" | "high_fidelity";
  serpScore: number;
  internalScore: number;
  kgScore: number;
  slScore: number;
  rcScore: number;
  tpScore: number;
  freshScore: number;
  ratScore: number;
  cryptoScore: number;
  gaps: string[];
  tierLift: Record<string, any>;
} {
  // SERP Organic Visibility (max 60 points)
  const kgScore = serp.hasKnowledgeGraph ? WEIGHTS.knowledge_graph : 0;
  const slScore = serp.hasSitelinkSalience ? WEIGHTS.sitelink_salience : 0;
  const rcScore = serp.hasRelatedCitations ? WEIGHTS.related_citations : 0;
  const tpScore = Math.round(Math.min(serp.thirdPartyValidationCount / 3, 1) * WEIGHTS.third_party * 100) / 100;
  const serpScore = kgScore + slScore + rcScore + tpScore;

  // Internal Data Score (max 40 points)
  let freshScore = 0;
  if (internal.dataFreshnessDays !== null) {
    if (internal.dataFreshnessDays <= 7) {
      freshScore = WEIGHTS.data_freshness;
    } else if (internal.dataFreshnessDays < 365) {
      freshScore = Math.round(WEIGHTS.data_freshness * (1 - (internal.dataFreshnessDays - 7) / 358) * 100) / 100;
    }
  }
  const ratScore = internal.hasSelectionRationale ? WEIGHTS.selection_rationale : 0;
  const cryptoScore = internal.hasCryptoVerification ? WEIGHTS.crypto_verification : 0;
  const internalScore = freshScore + ratScore + cryptoScore;

  const total = Math.round(Math.min(serpScore + internalScore, 100));

  let band: "invisible" | "fragmented" | "recognized" | "high_fidelity";
  if (total <= 35) band = "invisible";
  else if (total <= 65) band = "fragmented";
  else if (total <= 85) band = "recognized";
  else band = "high_fidelity";

  // Gap analysis
  const gaps: string[] = [];
  if (!serp.hasKnowledgeGraph) gaps.push(`No Knowledge Graph (-${WEIGHTS.knowledge_graph})`);
  if (!serp.hasSitelinkSalience) gaps.push(`Not #1 organic result (-${WEIGHTS.sitelink_salience})`);
  if (!serp.hasRelatedCitations) gaps.push(`No related entity citations (-${WEIGHTS.related_citations})`);
  if (serp.thirdPartyValidationCount < 3) gaps.push(`Only ${serp.thirdPartyValidationCount}/3 third-party validations (-${Math.round((1 - Math.min(serp.thirdPartyValidationCount / 3, 1)) * WEIGHTS.third_party)})`);
  if (internal.dataFreshnessDays === null) {
    gaps.push(`No audit data (-${WEIGHTS.data_freshness})`);
  } else if (internal.dataFreshnessDays > 30) {
    gaps.push(`Data is ${internal.dataFreshnessDays} days stale (-${Math.round(WEIGHTS.data_freshness - freshScore)})`);
  }
  if (!internal.hasSelectionRationale) gaps.push(`No selection rationale (-${WEIGHTS.selection_rationale})`);
  if (!internal.hasCryptoVerification) gaps.push(`No cryptographic verification (-${WEIGHTS.crypto_verification})`);

  // Tier lift projections
  // For each tier, project what the score would be with that tier's internal benefits
  const tierLift: Record<string, any> = {};
  const tiers = ["listed", "certified", "audited", "underwritten"];
  for (const tier of tiers) {
    // Projected internal score at each tier
    let projFresh = freshScore;
    let projRat = ratScore;
    let projCrypto = cryptoScore;

    // Underwritten: daily refresh = max freshness
    if (tier === "underwritten") {
      projFresh = WEIGHTS.data_freshness; // 20 (daily = always fresh)
      projRat = WEIGHTS.selection_rationale; // 10 (underwritten has rationale)
      projCrypto = WEIGHTS.crypto_verification; // 10 (underwritten has crypto)
    } else if (tier === "audited") {
      projFresh = Math.round(WEIGHTS.data_freshness * 0.85 * 100) / 100; // ~30 day refresh
      projRat = WEIGHTS.selection_rationale; // 10
      projCrypto = 0; // no crypto at audited
    } else if (tier === "certified") {
      projFresh = Math.round(WEIGHTS.data_freshness * 0.5 * 100) / 100; // ~90 day refresh
      projRat = 0;
      projCrypto = 0;
    } else {
      // listed
      projFresh = Math.round(WEIGHTS.data_freshness * 0.25 * 100) / 100; // ~annual
      projRat = 0;
      projCrypto = 0;
    }

    const projInternal = projFresh + projRat + projCrypto;
    const projTotal = Math.round(Math.min(serpScore + projInternal, 100));
    let projBand: string;
    if (projTotal <= 35) projBand = "invisible";
    else if (projTotal <= 65) projBand = "fragmented";
    else if (projTotal <= 85) projBand = "recognized";
    else projBand = "high_fidelity";

    tierLift[tier] = {
      projected_score: projTotal,
      projected_band: projBand,
      lift: projTotal - total,
    };
  }

  return {
    total, band, serpScore: Math.round(serpScore * 100) / 100,
    internalScore: Math.round(internalScore * 100) / 100,
    kgScore, slScore, rcScore, tpScore, freshScore, ratScore, cryptoScore,
    gaps, tierLift,
  };
}

async function processAgent(supabase: any, agent: AgentRow): Promise<{ success: boolean; agentId: string; score?: number; error?: string }> {
  try {
    // 1. Query Serper
    const stateName = (agent.state_slug || "").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const { query: serperQuery, data: serperData } = await querySerper(agent.name, agent.city_name, stateName);

    // 2. Extract SERP signals
    const serpSignals = extractSerpSignals(serperData, agent.name, agent.website);

    // 3. Get internal signals via run_sql (parameterized)
    const { data: internalRows } = await supabase.rpc("run_sql", {
      query: `SELECT
        EXTRACT(DAY FROM NOW() - g.audited_at)::int AS days_since_audit,
        p.current_tier,
        c.certification_status,
        c.payload_hash IS NOT NULL AS has_signature,
        c.next_verification_due > NOW() AS not_expired,
        EXISTS(SELECT 1 FROM marketing_content mc WHERE mc.agent_id = p.id AND mc.content_type = 'selection_rationale') AS has_rationale
      FROM professionals p
      LEFT JOIN geo_audit_results g ON g.agent_id = p.id
      LEFT JOIN certifications c ON c.professional_id = p.id
      WHERE p.id = '${agent.id}'::uuid`
    });

    const row = internalRows?.[0] || {};
    const internalSignals: InternalSignals = {
      dataFreshnessDays: row.days_since_audit ?? null,
      hasSelectionRationale: !!row.has_rationale,
      hasCryptoVerification: row.certification_status === "active" && !!row.has_signature && !!row.not_expired,
      currentTier: row.current_tier || agent.current_tier,
    };

    // 4. Calculate score
    const result = calculateAIFS(serpSignals, internalSignals);

    // 5. Upsert to aifs_scores
    const upsertQuery = `
      INSERT INTO aifs_scores (
        agent_id, aifs_total, aifs_band, aifs_version,
        serp_knowledge_graph, serp_knowledge_graph_score,
        serp_sitelink_salience, serp_sitelink_salience_score,
        serp_related_citations, serp_related_citations_score,
        serp_third_party_count, serp_third_party_score,
        serp_organic_visibility_score,
        internal_data_freshness_days, internal_data_freshness_score,
        internal_selection_rationale, internal_selection_rationale_score,
        internal_crypto_verified, internal_crypto_verified_score,
        internal_data_score,
        gap_analysis, tier_lift_projection,
        serper_query, serper_raw,
        scored_at, updated_at
      ) VALUES (
        '${agent.id}'::uuid, ${result.total}, '${result.band}', 'v1',
        ${serpSignals.hasKnowledgeGraph}, ${result.kgScore},
        ${serpSignals.hasSitelinkSalience}, ${result.slScore},
        ${serpSignals.hasRelatedCitations}, ${result.rcScore},
        ${serpSignals.thirdPartyValidationCount}, ${result.tpScore},
        ${result.serpScore},
        ${internalSignals.dataFreshnessDays ?? 'NULL'}, ${result.freshScore},
        ${internalSignals.hasSelectionRationale}, ${result.ratScore},
        ${internalSignals.hasCryptoVerification}, ${result.cryptoScore},
        ${result.internalScore},
        ARRAY[${result.gaps.map(g => `'${g.replace(/'/g, "''")}'`).join(',')}]::text[],
        '${JSON.stringify(result.tierLift).replace(/'/g, "''")}'::jsonb,
        '${serperQuery.replace(/'/g, "''")}',
        '${JSON.stringify(serperData).replace(/'/g, "''")}'::jsonb,
        NOW(), NOW()
      )
      ON CONFLICT (agent_id) DO UPDATE SET
        aifs_total = EXCLUDED.aifs_total,
        aifs_band = EXCLUDED.aifs_band,
        serp_knowledge_graph = EXCLUDED.serp_knowledge_graph,
        serp_knowledge_graph_score = EXCLUDED.serp_knowledge_graph_score,
        serp_sitelink_salience = EXCLUDED.serp_sitelink_salience,
        serp_sitelink_salience_score = EXCLUDED.serp_sitelink_salience_score,
        serp_related_citations = EXCLUDED.serp_related_citations,
        serp_related_citations_score = EXCLUDED.serp_related_citations_score,
        serp_third_party_count = EXCLUDED.serp_third_party_count,
        serp_third_party_score = EXCLUDED.serp_third_party_score,
        serp_organic_visibility_score = EXCLUDED.serp_organic_visibility_score,
        internal_data_freshness_days = EXCLUDED.internal_data_freshness_days,
        internal_data_freshness_score = EXCLUDED.internal_data_freshness_score,
        internal_selection_rationale = EXCLUDED.internal_selection_rationale,
        internal_selection_rationale_score = EXCLUDED.internal_selection_rationale_score,
        internal_crypto_verified = EXCLUDED.internal_crypto_verified,
        internal_crypto_verified_score = EXCLUDED.internal_crypto_verified_score,
        internal_data_score = EXCLUDED.internal_data_score,
        gap_analysis = EXCLUDED.gap_analysis,
        tier_lift_projection = EXCLUDED.tier_lift_projection,
        serper_query = EXCLUDED.serper_query,
        serper_raw = EXCLUDED.serper_raw,
        scored_at = NOW(),
        updated_at = NOW()
    `;
    await supabase.rpc("run_sql", { query: upsertQuery });

    // 6. Update denormalized columns on professionals
    await supabase.rpc("run_sql", {
      query: `UPDATE professionals SET aifs_score = ${result.total}, aifs_band = '${result.band}' WHERE id = '${agent.id}'::uuid`
    });

    return { success: true, agentId: agent.id, score: result.total };
  } catch (err: any) {
    console.error(`AIFS error for ${agent.id} (${agent.name}):`, err.message);
    return { success: false, agentId: agent.id, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body = cron mode */ }

    const agentIds: string[] = body.agent_ids || [];
    const forceRescore: boolean = body.force_rescore || false;
    const stateFilter: string | null = body.state_slug || null;

    let candidateQuery: string;

    if (agentIds.length > 0) {
      // Single/multi agent mode
      const idList = agentIds.map(id => `'${id}'::uuid`).join(",");
      candidateQuery = `
        SELECT p.id, p.name, p.company, p.website, p.current_tier,
               pc.city_name, pc.state_slug
        FROM professionals p
        JOIN professional_cities pc ON pc.professional_id = p.id
        WHERE p.id IN (${idList})
        LIMIT ${BATCH_SIZE}
      `;
    } else if (forceRescore) {
      // Force rescore mode
      candidateQuery = `
        SELECT p.id, p.name, p.company, p.website, p.current_tier,
               pc.city_name, pc.state_slug
        FROM professionals p
        JOIN professional_cities pc ON pc.professional_id = p.id
        WHERE p.active = true
          AND p.merit_gate_pass IS NOT FALSE
          ${stateFilter ? `AND pc.state_slug = '${stateFilter.replace(/'/g, "''")}'` : ""}
        ORDER BY RANDOM()
        LIMIT ${BATCH_SIZE}
      `;
    } else {
      // Cron mode -- pick candidates needing scoring
      candidateQuery = `
        SELECT p.id, p.name, p.company, p.website, p.current_tier,
               pc.city_name, pc.state_slug
        FROM professionals p
        JOIN professional_cities pc ON pc.professional_id = p.id
        LEFT JOIN aifs_scores a ON a.agent_id = p.id
        WHERE p.active = true
          AND p.merit_gate_pass IS NOT FALSE
          AND (
            a.agent_id IS NULL
            OR (p.current_tier = 'underwritten' AND a.scored_at < NOW() - INTERVAL '1 day')
            OR (p.current_tier = 'audited'      AND a.scored_at < NOW() - INTERVAL '7 days')
            OR (p.current_tier = 'certified'    AND a.scored_at < NOW() - INTERVAL '30 days')
            OR (COALESCE(p.current_tier, 'listed') = 'listed' AND a.scored_at < NOW() - INTERVAL '90 days')
          )
        ORDER BY
          CASE p.current_tier
            WHEN 'underwritten' THEN 1
            WHEN 'audited' THEN 2
            WHEN 'certified' THEN 3
            ELSE 4
          END,
          a.scored_at ASC NULLS FIRST
        LIMIT ${BATCH_SIZE}
      `;
    }

    const { data: candidates } = await supabase.rpc("run_sql", { query: candidateQuery });

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ message: "No candidates to score", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate by agent_id (agent may appear in multiple cities -- use first city)
    const seen = new Set<string>();
    const uniqueAgents: AgentRow[] = [];
    for (const row of candidates) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        uniqueAgents.push(row as AgentRow);
      }
    }

    // Process with concurrency limit
    const results: any[] = [];
    for (let i = 0; i < uniqueAgents.length; i += CONCURRENCY) {
      const batch = uniqueAgents.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((agent) => processAgent(supabase, agent))
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled") results.push(r.value);
        else results.push({ success: false, error: r.reason?.message });
      }
    }

    const processed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({ processed, failed, total: uniqueAgents.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("batch-aifs-score error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
