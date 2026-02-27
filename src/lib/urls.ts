/**
 * CANONICAL URL BUILDER — Top10Lists.us
 * =============================================================
 * This is the ONLY place URLs are constructed for:
 *   - CRM email templates (magic links)
 *   - Badge/artifact embeds
 *   - Agent profile links
 *   - Dashboard links
 *   - API endpoint references
 *   - Sitemap generation
 *   - Any link shown to agents, AIs, or consumers
 *
 * RULES:
 *   1. Production host is ALWAYS https://www.top10lists.us
 *   2. No function in this file accepts host/protocol as a parameter
 *   3. If you need a dev-only URL, use buildDevUrl() and NEVER
 *      import it in CRM, email, or agent-facing code
 *   4. Every new URL pattern MUST be registered here first
 * =============================================================
 */

const PROD_BASE = "https://www.top10lists.us";

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean>
): string {
  const url = new URL(path, PROD_BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** Agent profile page: /{state}/agents/{slug} */
export function agentProfileUrl(state: string, slug: string): string {
  return buildUrl(`/${state.toLowerCase()}/agents/${slug}`);
}

/** Artifact page (UUID-based): /artifact/{verification_token} */
export function artifactUrl(verificationToken: string): string {
  return buildUrl(`/artifact/${verificationToken}`);
}

/** Artifact page (slug-based): /artifact/{slug} */
export function artifactSlugUrl(slug: string): string {
  return buildUrl(`/artifact/${slug}`);
}

/** Dashboard magic link: /dashboard/{token} */
export function dashboardUrl(token: string): string {
  return buildUrl(`/dashboard/${token}`);
}

/** Badge widget API: /api/badge/{canonical_slug} */
export function badgeApiUrl(canonicalSlug: string): string {
  return buildUrl(`/api/badge/${canonicalSlug}`);
}

/** Badge v1 API: /api/v1/badge/{agentId} */
export function badgeV1ApiUrl(agentId: string): string {
  return buildUrl(`/api/v1/badge/${agentId}`);
}

/** City rankings: /{state}/{city}/top10realestateagents */
export function cityRankingsUrl(state: string, city: string): string {
  return buildUrl(
    `/${state.toLowerCase()}/${city.toLowerCase()}/top10realestateagents`
  );
}

/** City page: /{state}/{city} */
export function cityUrl(state: string, city: string): string {
  return buildUrl(`/${state.toLowerCase()}/${city.toLowerCase()}`);
}

/** State page: /{state} */
export function stateUrl(state: string): string {
  return buildUrl(`/${state.toLowerCase()}`);
}

/** Unsubscribe link */
export function unsubscribeUrl(token: string): string {
  return buildUrl("/unsubscribe", { token });
}

/** Email verification link */
export function verificationUrl(token: string): string {
  return buildUrl("/verify", { token });
}

/** For-AI guidance page */
export function forAiUrl(): string {
  return buildUrl("/for-ai");
}

/** LLMs discovery file */
export function llmsTxtUrl(): string {
  return buildUrl("/llms.txt");
}

/** Health check */
export function healthUrl(): string {
  return buildUrl("/api/health");
}

/** Dev-only (NEVER import in CRM/email code) */
export function buildDevUrl(path: string): string {
  const devBase =
    (typeof process !== "undefined" && process.env?.DEV_BASE_URL) ||
    "http://localhost:5173";
  return new URL(path, devBase).toString();
}

export interface UrlRegistryEntry {
  name: string;
  pattern: string;
  builder: string;
  routeType: "spa" | "api-route" | "rewrite" | "edge-function";
  authRequired: boolean;
  verifyJwt: boolean;
  envVarsNeeded: string[];
  smokeTestUrl?: string;
  expectedStatus?: number;
  expectedBodyContains?: string;
}

export const URL_REGISTRY: UrlRegistryEntry[] = [
  {
    name: "Agent Profile",
    pattern: "/{state}/agents/{slug}",
    builder: "agentProfileUrl",
    routeType: "spa",
    authRequired: false,
    verifyJwt: false,
    envVarsNeeded: [],
    smokeTestUrl: "https://www.top10lists.us/arizona/agents/a-tom-wood-team-1221",
    expectedStatus: 200,
  },
  {
    name: "Artifact (UUID)",
    pattern: "/artifact/{verification_token}",
    builder: "artifactUrl",
    routeType: "rewrite",
    authRequired: false,
    verifyJwt: false,
    envVarsNeeded: [],
    smokeTestUrl:
      "https://www.top10lists.us/artifact/1afa3413-96eb-4d06-a896-8537c910e3f3",
    expectedStatus: 200,
    expectedBodyContains: "ld+json",
  },
  {
    name: "Badge API",
    pattern: "/api/badge/{canonical_slug}",
    builder: "badgeApiUrl",
    routeType: "api-route",
    authRequired: false,
    verifyJwt: false,
    envVarsNeeded: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
    smokeTestUrl: "https://www.top10lists.us/api/badge/a-tom-wood-team-1221",
    expectedStatus: 200,
    expectedBodyContains: '"agent"',
  },
  {
    name: "Badge V1 API",
    pattern: "/api/v1/badge/{agentId}",
    builder: "badgeV1ApiUrl",
    routeType: "rewrite",
    authRequired: false,
    verifyJwt: false,
    envVarsNeeded: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"],
    smokeTestUrl: "https://www.top10lists.us/api/v1/badge/a-tom-wood-team-1221",
    expectedStatus: 200,
  },
  {
    name: "Dashboard (magic link)",
    pattern: "/dashboard/{token}",
    builder: "dashboardUrl",
    routeType: "spa",
    authRequired: true,
    verifyJwt: false,
    envVarsNeeded: [],
    smokeTestUrl:
      "https://www.top10lists.us/dashboard/e1e71db2-6469-46ec-b777-e009e02133b6",
    expectedStatus: 200,
  },
  {
    name: "City Rankings",
    pattern: "/{state}/{city}/top10realestateagents",
    builder: "cityRankingsUrl",
    routeType: "spa",
    authRequired: false,
    verifyJwt: false,
    envVarsNeeded: [],
    smokeTestUrl:
      "https://www.top10lists.us/arizona/phoenix/top10realestateagents",
    expectedStatus: 200,
  },
  {
    name: "For-AI Page",
    pattern: "/for-ai",
    builder: "forAiUrl",
    routeType: "spa",
    authRequired: false,
    verifyJwt: false,
    envVarsNeeded: [],
    smokeTestUrl: "https://www.top10lists.us/for-ai",
    expectedStatus: 200,
  },
  {
    name: "LLMs.txt",
    pattern: "/llms.txt",
    builder: "llmsTxtUrl",
    routeType: "rewrite",
    authRequired: false,
    verifyJwt: false,
    envVarsNeeded: [],
    smokeTestUrl: "https://www.top10lists.us/llms.txt",
    expectedStatus: 200,
  },
  {
    name: "Health Check",
    pattern: "/api/health",
    builder: "healthUrl",
    routeType: "api-route",
    authRequired: false,
    verifyJwt: false,
    envVarsNeeded: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY"],
    smokeTestUrl: "https://www.top10lists.us/api/health",
    expectedStatus: 200,
    expectedBodyContains: '"ok":true',
  },
];
