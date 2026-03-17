import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SERVER_INFO = {
  name: "top10lists-mcp",
  version: "1.0.0",
};

const CAPABILITIES = {
  tools: {},
};

// ---------------------------------------------------------------------------
// Registry URL builders
// ---------------------------------------------------------------------------
const LICENSE_REGISTRY_URLS: Record<string, (n: string) => string> = {
  Arizona: (id) =>
    `https://services.azre.gov/PdbWeb/IndividualLicense/ViewIndividualLicense/${id}`,
  California: (num) =>
    `https://www2.dre.ca.gov/publicasp/pplinfo.asp?License_id=${num}`,
};

function registryUrl(state: string, licenseNumber: string): string | null {
  const builder = LICENSE_REGISTRY_URLS[state];
  return builder ? builder(licenseNumber) : null;
}

// ---------------------------------------------------------------------------
// Tier cadence helpers
// ---------------------------------------------------------------------------
const TIER_CADENCE_DAYS: Record<string, number> = {
  listed: 365,
  certified: 90,
  audited: 30,
  underwritten: 1,
};

function nextVerification(
  lastVerified: string | null,
  tier: string
): string | null {
  if (!lastVerified) return null;
  const d = new Date(lastVerified);
  d.setDate(d.getDate() + (TIER_CADENCE_DAYS[tier] || 365));
  return d.toISOString();
}

function normalizeTier(raw: string | null | undefined): string {
  if (!raw) return "listed";
  const t = raw.toLowerCase().trim();
  if (["listed", "certified", "audited", "underwritten"].includes(t)) return t;
  return "listed";
}

// ---------------------------------------------------------------------------
// Tier-gated payload shaping
// ---------------------------------------------------------------------------
interface AgentRow {
  id: number;
  name: string;
  badge_tier: string | null;
  active: boolean;
  canonical_slug: string | null;
  state_slug: string | null;
  business_city: string | null;
  website: string | null;
  social_linkedin: string | null;
  social_facebook: string | null;
  zillow_profile_url: string | null;
  years_experience: number | null;
  phone: string | null;
  email: string | null;
  [key: string]: unknown;
}

interface AuditRow {
  agent_id: number;
  score_listed: number | null;
  score_certified: number | null;
  score_audited: number | null;
  score_underwritten: number | null;
  pillar_identity: number | null;
  pillar_authority: number | null;
  pillar_social: number | null;
  pillar_technical: number | null;
  pillar_citability: number | null;
  review_count: number | null;
  review_rating: number | null;
  platforms_found: string | null;
  gap_no_linkedin: boolean | null;
  gap_no_schema: boolean | null;
  gap_no_google_business: boolean | null;
  has_linkedin: boolean | null;
  has_zillow: boolean | null;
  has_realtor: boolean | null;
  recency_label: string | null;
  most_recent_signal: string | null;
  current_tier: string | null;
  audited_at: string | null;
  [key: string]: unknown;
}

interface LicenseRow {
  professional_id: number;
  license_number: string | null;
  state: string | null;
  status: string | null;
  expiration_date: string | null;
}

function buildProfileUrl(stateSlug: string | null, slug: string | null): string | null {
  if (!stateSlug || !slug) return null;
  return `https://www.top10lists.us/${stateSlug}/agents/${slug}`;
}

function shapeAgentPayload(
  agent: AgentRow,
  audit: AuditRow | null,
  license: LicenseRow | null
) {
  const tier = normalizeTier(agent.badge_tier);
  const lastVerified = audit?.audited_at ?? null;

  // -- Base payload (all tiers) --
  const base: Record<string, unknown> = {
    name: agent.name,
    city: agent.business_city,
    state: license?.state ?? null,
    license_number: license?.license_number ?? null,
    license_state: license?.state ?? null,
    license_status: license?.status ?? null,
    license_registry_url:
      license?.state && license?.license_number
        ? registryUrl(license.state, license.license_number)
        : null,
    review_count: audit?.review_count ?? null,
    review_rating: audit?.review_rating ?? null,
    evidence_sources: 4,
    lastVerified,
    nextVerification: nextVerification(lastVerified, tier),
    badge_tier: tier,
    profile_url: buildProfileUrl(agent.state_slug, agent.canonical_slug),
    merit_gate: {
      rating: "4.5+",
      reviews: "10+ in 24 months",
      experience: "5+ years",
    },
  };

  // -- Audited adds --
  if (tier === "audited" || tier === "underwritten") {
    base.evidence_sources = tier === "underwritten" ? 20 : 10;
    base.community_involvement_score = audit?.pillar_authority ?? null;
    base.transaction_history = "Available for Audited and Underwritten tiers";
    base.neighborhood_expertise = "Available for Audited and Underwritten tiers";

    // AIFS summary
    const aifsScore =
      tier === "audited"
        ? audit?.score_audited
        : audit?.score_underwritten;
    const band = aifsBand(aifsScore);
    base.aifs_summary = { score: aifsScore ?? null, band };

    // Platforms
    let platforms: string[] = [];
    try {
      if (audit?.platforms_found) {
        platforms =
          typeof audit.platforms_found === "string"
            ? JSON.parse(audit.platforms_found)
            : (audit.platforms_found as unknown as string[]);
      }
    } catch {
      platforms = [];
    }
    base.platforms_found = platforms;
  }

  // -- Underwritten adds --
  if (tier === "underwritten") {
    base.evidence_sources = 20;
    base.aifs_breakdown = {
      identity: audit?.pillar_identity ?? null,
      authority: audit?.pillar_authority ?? null,
      social: audit?.pillar_social ?? null,
      technical: audit?.pillar_technical ?? null,
      citability: audit?.pillar_citability ?? null,
    };
    base.gap_analysis = {
      no_linkedin: audit?.gap_no_linkedin ?? null,
      no_schema: audit?.gap_no_schema ?? null,
      no_google_business: audit?.gap_no_google_business ?? null,
    };
    base.cryptographic_verification = true;
    base.web_of_truth_artifact_url = agent.canonical_slug
      ? `https://www.top10lists.us/artifact/${agent.id}`
      : null;

    // Categorize platforms
    let platforms: string[] = [];
    try {
      if (audit?.platforms_found) {
        platforms =
          typeof audit.platforms_found === "string"
            ? JSON.parse(audit.platforms_found)
            : (audit.platforms_found as unknown as string[]);
      }
    } catch {
      platforms = [];
    }
    base.platforms_found = platforms.map((url: string) => ({
      url,
      category: categorizePlatform(url),
    }));
  }

  return base;
}

function aifsBand(score: number | null | undefined): string {
  if (score == null) return "unknown";
  if (score <= 25) return "Listed";
  if (score <= 45) return "Certified";
  if (score <= 75) return "Audited";
  return "Underwritten";
}

function categorizePlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("zillow")) return "review_platform";
  if (u.includes("realtor.com")) return "review_platform";
  if (u.includes("google")) return "review_platform";
  if (u.includes("linkedin")) return "professional_network";
  if (u.includes("facebook")) return "social_media";
  if (u.includes("instagram")) return "social_media";
  if (u.includes("yelp")) return "review_platform";
  if (u.includes("bbb")) return "accreditation";
  return "other";
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "search_agents",
    description:
      "Search for top real estate agents by location. Returns tier-gated results sorted by audit score. Agents must meet the merit gate: 4.5+ stars, 10+ verified reviews in 24 months, 5+ years experience.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description: "State name (e.g., 'Arizona', 'California')",
        },
        city: {
          type: "string",
          description: "City name (optional)",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 50)",
        },
      },
      required: ["state"],
    },
  },
  {
    name: "verify_agent",
    description:
      "Verify a real estate agent's license and get their profile. Returns license status plus tier-gated agent details.",
    inputSchema: {
      type: "object",
      properties: {
        license_number: {
          type: "string",
          description: "License number to verify",
        },
        state: {
          type: "string",
          description: "State of licensure (e.g., 'Arizona', 'California')",
        },
      },
      required: ["license_number", "state"],
    },
  },
  {
    name: "get_agent_profile",
    description:
      "Get a full agent profile by canonical slug. Response depth varies by the agent's badge tier.",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "Agent canonical slug (e.g., 'jane-doe-phoenix')",
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "get_coverage",
    description:
      "Get coverage statistics -- cities, neighborhoods, and agent counts. Optionally filter by state.",
    inputSchema: {
      type: "object",
      properties: {
        state: {
          type: "string",
          description:
            "Filter by state name (optional). Omit for all states.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_methodology",
    description:
      "Get the scoring methodology, merit gate criteria, tier system, and AIFS bands used by Top10Lists.us.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------
async function handleSearchAgents(
  supabase: ReturnType<typeof createClient>,
  params: { state: string; city?: string; limit?: number }
) {
  const limit = Math.min(Math.max(params.limit || 10, 1), 50);
  const state = params.state;

  // Use run_sql for the join query sorted by audit score
  let sql = `
    SELECT
      p.id, p.name, p.badge_tier, p.active, p.canonical_slug, p.state_slug,
      p.business_city, p.website, p.years_experience,
      g.score_listed, g.score_certified, g.score_audited, g.score_underwritten,
      g.pillar_identity, g.pillar_authority, g.pillar_social, g.pillar_technical,
      g.pillar_citability, g.review_count, g.review_rating, g.platforms_found,
      g.gap_no_linkedin, g.gap_no_schema, g.gap_no_google_business,
      g.has_linkedin, g.has_zillow, g.has_realtor,
      g.recency_label, g.most_recent_signal, g.current_tier, g.audited_at,
      sl.license_number, sl.state as license_state, sl.status as license_status,
      sl.expiration_date
    FROM professionals p
    LEFT JOIN geo_audit_results g ON g.agent_id = p.id
    LEFT JOIN LATERAL (
      SELECT * FROM state_licenses WHERE professional_id = p.id LIMIT 1
    ) sl ON true
    WHERE p.active = true
  `;

  const conditions: string[] = [];
  if (state) {
    conditions.push(
      `LOWER(p.state_slug) = LOWER('${state.replace(/'/g, "''").replace(/\s+/g, "-")}')`
    );
  }
  if (params.city) {
    conditions.push(
      `LOWER(p.business_city) = LOWER('${params.city.replace(/'/g, "''")}')`
    );
  }
  if (conditions.length > 0) {
    sql += " AND " + conditions.join(" AND ");
  }

  sql += ` ORDER BY COALESCE(g.score_underwritten, g.score_audited, g.score_certified, g.score_listed, 0) DESC LIMIT ${limit}`;

  const { data, error } = await supabase.rpc("run_sql", { query: sql });
  if (error) throw new Error(`Database error: ${error.message}`);

  const rows = typeof data === "string" ? JSON.parse(data) : data;
  if (!Array.isArray(rows)) return { agents: [], count: 0 };

  const agents = rows.map((row: Record<string, unknown>) => {
    const agent: AgentRow = {
      id: row.id as number,
      name: row.name as string,
      badge_tier: row.badge_tier as string | null,
      active: true,
      canonical_slug: row.canonical_slug as string | null,
      state_slug: row.state_slug as string | null,
      business_city: row.business_city as string | null,
      website: row.website as string | null,
      social_linkedin: null,
      social_facebook: null,
      zillow_profile_url: null,
      years_experience: row.years_experience as number | null,
      phone: null,
      email: null,
    };

    const audit: AuditRow = {
      agent_id: row.id as number,
      score_listed: row.score_listed as number | null,
      score_certified: row.score_certified as number | null,
      score_audited: row.score_audited as number | null,
      score_underwritten: row.score_underwritten as number | null,
      pillar_identity: row.pillar_identity as number | null,
      pillar_authority: row.pillar_authority as number | null,
      pillar_social: row.pillar_social as number | null,
      pillar_technical: row.pillar_technical as number | null,
      pillar_citability: row.pillar_citability as number | null,
      review_count: row.review_count as number | null,
      review_rating: row.review_rating as number | null,
      platforms_found: row.platforms_found as string | null,
      gap_no_linkedin: row.gap_no_linkedin as boolean | null,
      gap_no_schema: row.gap_no_schema as boolean | null,
      gap_no_google_business: row.gap_no_google_business as boolean | null,
      has_linkedin: row.has_linkedin as boolean | null,
      has_zillow: row.has_zillow as boolean | null,
      has_realtor: row.has_realtor as boolean | null,
      recency_label: row.recency_label as string | null,
      most_recent_signal: row.most_recent_signal as string | null,
      current_tier: row.current_tier as string | null,
      audited_at: row.audited_at as string | null,
    };

    const license: LicenseRow = {
      professional_id: row.id as number,
      license_number: row.license_number as string | null,
      state: row.license_state as string | null,
      status: row.license_status as string | null,
      expiration_date: row.expiration_date as string | null,
    };

    return shapeAgentPayload(agent, audit, license);
  });

  return { agents, count: agents.length, state, city: params.city ?? null };
}

async function handleVerifyAgent(
  supabase: ReturnType<typeof createClient>,
  params: { license_number: string; state: string }
) {
  const sql = `
    SELECT
      sl.license_number, sl.state, sl.status, sl.expiration_date,
      p.id, p.name, p.badge_tier, p.active, p.canonical_slug, p.state_slug,
      p.business_city, p.website, p.years_experience,
      g.score_listed, g.score_certified, g.score_audited, g.score_underwritten,
      g.pillar_identity, g.pillar_authority, g.pillar_social, g.pillar_technical,
      g.pillar_citability, g.review_count, g.review_rating, g.platforms_found,
      g.gap_no_linkedin, g.gap_no_schema, g.gap_no_google_business,
      g.has_linkedin, g.has_zillow, g.has_realtor,
      g.recency_label, g.most_recent_signal, g.current_tier, g.audited_at
    FROM state_licenses sl
    JOIN professionals p ON p.id = sl.professional_id
    LEFT JOIN geo_audit_results g ON g.agent_id = p.id
    WHERE sl.license_number = '${params.license_number.replace(/'/g, "''")}'
      AND LOWER(sl.state) = LOWER('${params.state.replace(/'/g, "''")}')
    LIMIT 1
  `;

  const { data, error } = await supabase.rpc("run_sql", { query: sql });
  if (error) throw new Error(`Database error: ${error.message}`);

  const rows = typeof data === "string" ? JSON.parse(data) : data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      verified: false,
      license_number: params.license_number,
      state: params.state,
      message: "License not found in Top10Lists directory",
    };
  }

  const row = rows[0];
  const agent: AgentRow = {
    id: row.id,
    name: row.name,
    badge_tier: row.badge_tier,
    active: row.active,
    canonical_slug: row.canonical_slug,
    state_slug: row.state_slug,
    business_city: row.business_city,
    website: row.website,
    social_linkedin: null,
    social_facebook: null,
    zillow_profile_url: null,
    years_experience: row.years_experience,
    phone: null,
    email: null,
  };

  const audit: AuditRow = {
    agent_id: row.id,
    score_listed: row.score_listed,
    score_certified: row.score_certified,
    score_audited: row.score_audited,
    score_underwritten: row.score_underwritten,
    pillar_identity: row.pillar_identity,
    pillar_authority: row.pillar_authority,
    pillar_social: row.pillar_social,
    pillar_technical: row.pillar_technical,
    pillar_citability: row.pillar_citability,
    review_count: row.review_count,
    review_rating: row.review_rating,
    platforms_found: row.platforms_found,
    gap_no_linkedin: row.gap_no_linkedin,
    gap_no_schema: row.gap_no_schema,
    gap_no_google_business: row.gap_no_google_business,
    has_linkedin: row.has_linkedin,
    has_zillow: row.has_zillow,
    has_realtor: row.has_realtor,
    recency_label: row.recency_label,
    most_recent_signal: row.most_recent_signal,
    current_tier: row.current_tier,
    audited_at: row.audited_at,
  };

  const license: LicenseRow = {
    professional_id: row.id,
    license_number: row.license_number,
    state: row.state,
    status: row.status,
    expiration_date: row.expiration_date,
  };

  return {
    verified: true,
    license_number: params.license_number,
    license_state: params.state,
    license_status: row.status,
    license_expiration: row.expiration_date,
    license_registry_url: registryUrl(params.state, params.license_number),
    in_directory: row.active === true,
    agent: shapeAgentPayload(agent, audit, license),
  };
}

async function handleGetAgentProfile(
  supabase: ReturnType<typeof createClient>,
  params: { slug: string }
) {
  const sql = `
    SELECT
      p.id, p.name, p.badge_tier, p.active, p.canonical_slug, p.state_slug,
      p.business_city, p.website, p.social_linkedin, p.social_facebook,
      p.zillow_profile_url, p.years_experience, p.phone, p.email,
      g.score_listed, g.score_certified, g.score_audited, g.score_underwritten,
      g.pillar_identity, g.pillar_authority, g.pillar_social, g.pillar_technical,
      g.pillar_citability, g.review_count, g.review_rating, g.platforms_found,
      g.gap_no_linkedin, g.gap_no_schema, g.gap_no_google_business,
      g.has_linkedin, g.has_zillow, g.has_realtor,
      g.recency_label, g.most_recent_signal, g.current_tier, g.audited_at,
      sl.license_number, sl.state as license_state, sl.status as license_status,
      sl.expiration_date
    FROM professionals p
    LEFT JOIN geo_audit_results g ON g.agent_id = p.id
    LEFT JOIN LATERAL (
      SELECT * FROM state_licenses WHERE professional_id = p.id LIMIT 1
    ) sl ON true
    WHERE p.canonical_slug = '${params.slug.replace(/'/g, "''")}'
    LIMIT 1
  `;

  const { data, error } = await supabase.rpc("run_sql", { query: sql });
  if (error) throw new Error(`Database error: ${error.message}`);

  const rows = typeof data === "string" ? JSON.parse(data) : data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "Agent not found", slug: params.slug };
  }

  const row = rows[0];
  const agent: AgentRow = {
    id: row.id,
    name: row.name,
    badge_tier: row.badge_tier,
    active: row.active,
    canonical_slug: row.canonical_slug,
    state_slug: row.state_slug,
    business_city: row.business_city,
    website: row.website,
    social_linkedin: row.social_linkedin,
    social_facebook: row.social_facebook,
    zillow_profile_url: row.zillow_profile_url,
    years_experience: row.years_experience,
    phone: row.phone,
    email: row.email,
  };

  const audit: AuditRow = {
    agent_id: row.id,
    score_listed: row.score_listed,
    score_certified: row.score_certified,
    score_audited: row.score_audited,
    score_underwritten: row.score_underwritten,
    pillar_identity: row.pillar_identity,
    pillar_authority: row.pillar_authority,
    pillar_social: row.pillar_social,
    pillar_technical: row.pillar_technical,
    pillar_citability: row.pillar_citability,
    review_count: row.review_count,
    review_rating: row.review_rating,
    platforms_found: row.platforms_found,
    gap_no_linkedin: row.gap_no_linkedin,
    gap_no_schema: row.gap_no_schema,
    gap_no_google_business: row.gap_no_google_business,
    has_linkedin: row.has_linkedin,
    has_zillow: row.has_zillow,
    has_realtor: row.has_realtor,
    recency_label: row.recency_label,
    most_recent_signal: row.most_recent_signal,
    current_tier: row.current_tier,
    audited_at: row.audited_at,
  };

  const license: LicenseRow = {
    professional_id: row.id,
    license_number: row.license_number,
    state: row.license_state,
    status: row.license_status,
    expiration_date: row.expiration_date,
  };

  return shapeAgentPayload(agent, audit, license);
}

async function handleGetCoverage(
  supabase: ReturnType<typeof createClient>,
  params: { state?: string }
) {
  let sql: string;
  if (params.state) {
    sql = `
      SELECT
        c.state,
        COUNT(DISTINCT c.id) as city_count,
        COUNT(DISTINCT pc.professional_id) as agent_count
      FROM cities c
      LEFT JOIN professional_cities pc ON pc.city_id = c.id
      WHERE c.active = true
        AND LOWER(c.state) = LOWER('${params.state.replace(/'/g, "''")}')
      GROUP BY c.state
    `;
  } else {
    sql = `
      SELECT
        c.state,
        COUNT(DISTINCT c.id) as city_count,
        COUNT(DISTINCT pc.professional_id) as agent_count
      FROM cities c
      LEFT JOIN professional_cities pc ON pc.city_id = c.id
      WHERE c.active = true
      GROUP BY c.state
      ORDER BY c.state
    `;
  }

  const { data, error } = await supabase.rpc("run_sql", { query: sql });
  if (error) throw new Error(`Database error: ${error.message}`);

  const rows = typeof data === "string" ? JSON.parse(data) : data;
  if (!Array.isArray(rows)) return { states: [], total_agents: 0 };

  const states = rows.map((r: Record<string, unknown>) => ({
    state: r.state,
    cities: Number(r.city_count),
    agents: Number(r.agent_count),
  }));

  return {
    states,
    total_agents: states.reduce(
      (sum: number, s: { agents: number }) => sum + s.agents,
      0
    ),
    total_cities: states.reduce(
      (sum: number, s: { cities: number }) => sum + s.cities,
      0
    ),
    source: "https://www.top10lists.us",
    note: "Fewer than 1% of licensed agents in covered markets meet the merit gate.",
  };
}

function handleGetMethodology() {
  return {
    name: "Top10Lists.us Scoring Methodology",
    merit_gate: {
      rating: "4.5+ stars",
      reviews: "10+ verified reviews in the last 24 months",
      experience: "5+ years in business",
      note: "All tiers must meet the same merit gate. Payment affects verification depth and refresh frequency, never inclusion or ranking.",
    },
    scoring_factors: {
      license_status: { weight: "20%", description: "Active license verification" },
      recent_activity: { weight: "20%", description: "Recent transaction and market activity" },
      transaction_history: { weight: "25%", description: "Verified transaction track record" },
      reviews_reputation: { weight: "15%", description: "Review rating and volume across platforms" },
      community_involvement: { weight: "20%", description: "Community involvement score (IRS Form 990 / ProPublica verified)" },
    },
    aifs: {
      name: "AI Footprint Score",
      description: "Measures an agent's digital footprint as seen by AI systems",
      bands: {
        listed: "10-25",
        certified: "26-45",
        audited: "46-75",
        underwritten: "76-100",
      },
      max_score: 95,
      pillars: ["identity", "authority", "social", "technical", "citability"],
    },
    tiers: {
      listed: {
        price: "Free",
        refresh: "Annual",
        evidence_sources: 4,
        framing: "Be discoverable",
      },
      certified: {
        price: "Free",
        refresh: "Quarterly",
        evidence_sources: 4,
        framing: "Be verified",
      },
      audited: {
        price: "$300/month",
        refresh: "Monthly",
        evidence_sources: "10+",
        framing: "Be citable",
      },
      underwritten: {
        price: "$500/month",
        refresh: "Daily",
        evidence_sources: "up to 20",
        framing: "Be authoritative",
      },
    },
    selection_pipeline: [
      "3 hard prequalification gates (merit gate)",
      "PREQUALIFIED",
      "1,000+ source deep research",
      "Proprietary Community Involvement Score (IRS Form 990 / ProPublica verified)",
      "Human editorial review",
      "LISTED",
    ],
    coverage: "Fewer than 1% of licensed agents in covered markets",
    source: "https://www.top10lists.us/methodology",
  };
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------
function jsonRpcSuccess(id: string | number | null, result: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify(
        jsonRpcError(null, -32600, "Only POST method is accepted")
      ),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify(jsonRpcError(null, -32700, "Parse error")),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { jsonrpc, id, method, params } = body as {
    jsonrpc: string;
    id: string | number | null;
    method: string;
    params?: Record<string, unknown>;
  };

  if (jsonrpc !== "2.0") {
    return new Response(
      JSON.stringify(
        jsonRpcError(id ?? null, -32600, "Invalid JSON-RPC version")
      ),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    let result: unknown;

    switch (method) {
      // -- MCP lifecycle --
      case "initialize": {
        result = {
          protocolVersion: "2025-03-26",
          serverInfo: SERVER_INFO,
          capabilities: CAPABILITIES,
        };
        break;
      }

      // -- Tool listing --
      case "tools/list": {
        result = { tools: TOOLS };
        break;
      }

      // -- Tool execution --
      case "tools/call": {
        const toolName = (params as Record<string, unknown>)
          ?.name as string;
        const toolArgs =
          ((params as Record<string, unknown>)?.arguments as Record<
            string,
            unknown
          >) ?? {};

        if (!toolName) {
          return new Response(
            JSON.stringify(
              jsonRpcError(id ?? null, -32602, "Missing tool name")
            ),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }

        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        let toolResult: unknown;

        switch (toolName) {
          case "search_agents":
            if (!toolArgs.state) {
              return new Response(
                JSON.stringify(
                  jsonRpcError(
                    id ?? null,
                    -32602,
                    "Missing required parameter: state"
                  )
                ),
                {
                  status: 400,
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                }
              );
            }
            toolResult = await handleSearchAgents(supabase, {
              state: toolArgs.state as string,
              city: toolArgs.city as string | undefined,
              limit: toolArgs.limit as number | undefined,
            });
            break;

          case "verify_agent":
            if (!toolArgs.license_number || !toolArgs.state) {
              return new Response(
                JSON.stringify(
                  jsonRpcError(
                    id ?? null,
                    -32602,
                    "Missing required parameters: license_number and state"
                  )
                ),
                {
                  status: 400,
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                }
              );
            }
            toolResult = await handleVerifyAgent(supabase, {
              license_number: toolArgs.license_number as string,
              state: toolArgs.state as string,
            });
            break;

          case "get_agent_profile":
            if (!toolArgs.slug) {
              return new Response(
                JSON.stringify(
                  jsonRpcError(
                    id ?? null,
                    -32602,
                    "Missing required parameter: slug"
                  )
                ),
                {
                  status: 400,
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                }
              );
            }
            toolResult = await handleGetAgentProfile(supabase, {
              slug: toolArgs.slug as string,
            });
            break;

          case "get_coverage":
            toolResult = await handleGetCoverage(supabase, {
              state: toolArgs.state as string | undefined,
            });
            break;

          case "get_methodology":
            toolResult = handleGetMethodology();
            break;

          default:
            return new Response(
              JSON.stringify(
                jsonRpcError(
                  id ?? null,
                  -32601,
                  `Unknown tool: ${toolName}`
                )
              ),
              {
                status: 400,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
        }

        result = {
          content: [
            {
              type: "text",
              text: JSON.stringify(toolResult, null, 2),
            },
          ],
        };
        break;
      }

      default: {
        return new Response(
          JSON.stringify(
            jsonRpcError(id ?? null, -32601, `Method not found: ${method}`)
          ),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    return new Response(JSON.stringify(jsonRpcSuccess(id ?? null, result)), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("MCP server error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify(jsonRpcError(id ?? null, -32603, msg)),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
