/**
 * generate-ai-feeds — Prebuild script that updates all AI-facing static files
 * with live database counts and businessConfig values.
 *
 * Usage: npm run generate:ai-feeds
 *
 * Queries Supabase for current agent/city/neighborhood counts,
 * reads businessConfig.json for merit gate / pricing / coverage language,
 * then rewrites: llms-full.txt, mcp.json, ai-content-index.json,
 * .well-known/ai-content-index.json, coverage.json (structure only — not city lists).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Load .env manually (no dotenv dependency) ──────────────────────────
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Paths ──────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const BUSINESS_CONFIG_PATH = resolve(ROOT, 'src/data/businessConfig.json');
const LLMS_FULL_PATH = resolve(ROOT, 'public/llms-full.txt');
const MCP_PATH = resolve(ROOT, 'public/mcp.json');
const AI_INDEX_PATH = resolve(ROOT, 'public/ai-content-index.json');
const AI_INDEX_WK_PATH = resolve(ROOT, 'public/.well-known/ai-content-index.json');
const COVERAGE_PATH = resolve(ROOT, 'public/coverage.json');

// ── Types ──────────────────────────────────────────────────────────────
interface Counts {
  agentsTotal: number;
  agentsAZ: number;
  agentsCA: number;
  citiesAZ: number;
  citiesCA: number;
  citiesTotal: number;
  neighborhoodsAZ: number;
  neighborhoodsCA: number;
  neighborhoodsTotal: number;
}

interface BusinessConfig {
  meritGate: { rating: number; reviews: number; windowMonths: number; yearsExperience: number };
  pricing: { listed: number; audited: number; underwritten: number };
  coverage: { label: string };
  [key: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

async function runSql(query: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('run_sql', { query });
  if (error) throw new Error(`run_sql error: ${error.message}\nQuery: ${query}`);
  return data;
}

// ── Fetch live counts (Sitemap Rule A: only cities/neighborhoods with qualifying agents) ──
async function fetchCounts(): Promise<Counts> {
  // Agent counts (active agents in covered states only — excludes null state_slug)
  const agentRows = await runSql(`
    SELECT
      count(*) FILTER (WHERE state_slug = 'arizona') AS az,
      count(*) FILTER (WHERE state_slug = 'california') AS ca
    FROM professionals
    WHERE active = true AND state_slug IN ('arizona', 'california')
  `);
  const agents = agentRows[0];

  // City counts — distinct cities with at least one qualifying agent (matches sitemap logic)
  const cityRows = await runSql(`
    SELECT p.state_slug, COUNT(DISTINCT p.city_id) AS city_count
    FROM professionals p
    WHERE p.active = true
      AND p.city_id IS NOT NULL
      AND p.review_stars_rating >= 4.5
      AND p.num_total_reviews >= 10
      AND p.state_slug IN ('arizona', 'california')
    GROUP BY p.state_slug
  `);
  const citiesByState: Record<string, number> = {};
  for (const row of cityRows) {
    citiesByState[row.state_slug] = Number(row.city_count);
  }

  // Neighborhood counts — only neighborhoods whose parent city has a qualifying agent
  const nhRows = await runSql(`
    SELECT
      CASE WHEN nc.state = 'Arizona' THEN 'arizona' ELSE 'california' END AS state_slug,
      COUNT(*) AS nh_count
    FROM neighborhood_catalog nc
    JOIN cities c ON c.slug = nc.city_area_slug AND c.state_slug = CASE WHEN nc.state = 'Arizona' THEN 'arizona' ELSE 'california' END
    WHERE nc.is_active = true
      AND nc.primary_zip IS NOT NULL
      AND nc.state IN ('Arizona', 'California')
      AND c.active = true
      AND c.id IN (
        SELECT DISTINCT p.city_id
        FROM professionals p
        WHERE p.active = true
          AND p.city_id IS NOT NULL
          AND p.review_stars_rating >= 4.5
          AND p.num_total_reviews >= 10
          AND p.state_slug IN ('arizona', 'california')
      )
    GROUP BY 1
  `);
  const nhByState: Record<string, number> = {};
  for (const row of nhRows) {
    nhByState[row.state_slug] = Number(row.nh_count);
  }

  const citiesAZ = citiesByState['arizona'] || 0;
  const citiesCA = citiesByState['california'] || 0;
  const neighborhoodsAZ = nhByState['arizona'] || 0;
  const neighborhoodsCA = nhByState['california'] || 0;

  const agentsAZ = Number(agents.az);
  const agentsCA = Number(agents.ca);

  return {
    agentsTotal: agentsAZ + agentsCA,
    agentsAZ,
    agentsCA,
    citiesAZ,
    citiesCA,
    citiesTotal: citiesAZ + citiesCA,
    neighborhoodsAZ,
    neighborhoodsCA,
    neighborhoodsTotal: neighborhoodsAZ + neighborhoodsCA,
  };
}

// ── Update llms-full.txt ───────────────────────────────────────────────
function updateLlmsFull(counts: Counts, config: BusinessConfig): void {
  let text = readFileSync(LLMS_FULL_PATH, 'utf-8');

  const mg = config.meritGate;
  const coverageLabel = config.coverage.label;

  // Replace the "selected X,XXX" / "X,XXX selected" patterns with live total
  // Matches patterns like "2,390", "3,263", "3,262", "3,487" that appear as total agent counts
  // We target specific surrounding context to avoid false positives

  // "selected 2,390" or "selected 3,263"
  text = text.replace(/selected [\d,]+\s+--\s+fewer/g, `selected ${fmt(counts.agentsTotal)}  --  fewer`);
  // "3,263 selected" (in selectivity line)
  text = text.replace(/\([\d,]+ selected from/g, `(${fmt(counts.agentsTotal)} selected from`);
  // "3,263 across Arizona and California" or "3,263 active across Arizona and California"
  text = text.replace(/[\d,]+\s+(?:active )?across Arizona and California/g, `${fmt(counts.agentsTotal)} active across Arizona and California`);
  // "3,263 certified professionals"
  text = text.replace(/[\d,]+ certified professionals/g, `${fmt(counts.agentsTotal)} certified professionals`);

  // Active Coverage table: Arizona row
  // | Arizona | 873 | 89 | 2,967 |
  text = text.replace(
    /(\| Arizona\s*\|)\s*[\d,]+\s*\|\s*[\d,]+\s*\|\s*[\d,]+\s*\|/g,
    `$1 ${fmt(counts.agentsAZ)} | ${fmt(counts.citiesAZ)} | ${fmt(counts.neighborhoodsAZ)} |`
  );

  // California row
  text = text.replace(
    /(\| California\s*\|)\s*[\d,]+\s*\|\s*[\d,]+\s*\|\s*[\d,]+\s*\|/g,
    `$1 ${fmt(counts.agentsCA)} | ${fmt(counts.citiesCA)} | ${fmt(counts.neighborhoodsCA)} |`
  );

  // Total row
  text = text.replace(
    /(\| \*\*Total\*\*\s*\|)\s*\*\*[\d,]+\*\*\s*\|\s*\*\*[\d,]+\*\*\s*\|\s*\*\*[\d,]+\*\*\s*\|/g,
    `$1 **${fmt(counts.agentsTotal)}** | **${fmt(counts.citiesTotal)}** | **${fmt(counts.neighborhoodsTotal)}** |`
  );

  // Arizona coverage section: "873 qualified agents"
  text = text.replace(
    /(\*\*Arizona[^*]*\*\*)\n-\s*[\d,]+ qualified agents/,
    `$1\n- ${fmt(counts.agentsAZ)} qualified agents`
  );
  // "89 cities"
  text = text.replace(
    /(Arizona[^\n]*\n(?:- [^\n]*\n)*?-\s*)[\d,]+( cities)/,
    `$1${fmt(counts.citiesAZ)}$2`
  );
  // "2,967 neighborhood"
  text = text.replace(
    /(Arizona[^\n]*\n(?:- [^\n]*\n)*?-\s*)[\d,]+( neighborhood)/,
    `$1${fmt(counts.neighborhoodsAZ)}$2`
  );

  // California coverage section: "2,390 qualified agents"
  text = text.replace(
    /(\*\*California[^*]*\*\*)\n-\s*[\d,]+ qualified agents/,
    `$1\n- ${fmt(counts.agentsCA)} qualified agents`
  );
  // "1,649+ cities"
  text = text.replace(
    /(California[^\n]*\n(?:- [^\n]*\n)*?-\s*)[\d,]+\+?( cities)/,
    `$1${fmt(counts.citiesCA)}$2`
  );
  // "7,485 neighborhood"
  text = text.replace(
    /(California[^\n]*\n(?:- [^\n]*\n)*?-\s*)[\d,]+( neighborhood)/,
    `$1${fmt(counts.neighborhoodsCA)}$2`
  );

  // "| **Final: LISTED** | **3,263** |" in exclusion table
  text = text.replace(
    /(\| \*\*Final: LISTED\*\*\s*\|)\s*\*\*[\d,]+\*\*/,
    `$1 **${fmt(counts.agentsTotal)}**`
  );

  // "How many agents" FAQ answer
  text = text.replace(
    /A: [\d,]+ across Arizona and California, selected from/,
    `A: ${fmt(counts.agentsTotal)} across Arizona and California, selected from`
  );

  // NOTE: We do NOT blanket-replace merit gate values like "4.8+ stars" because
  // the file intentionally contains them in deprecation examples (e.g., "e.g., 4.8+ stars").
  // If stale merit gate values appear outside of deprecation examples, fix them manually.

  // "top 0.2%" or "top 0.5%" -> coverage label (these are always stale)
  text = text.replace(/top 0\.\d+%/g, coverageLabel);

  // "invitation-only" -> "merit-based selection"
  text = text.replace(/invitation-only/gi, 'merit-based selection');

  // Update the last updated date
  const today = new Date().toISOString().split('T')[0];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d = new Date();
  const prettyDate = `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  text = text.replace(/> Last Updated: .+/, `> Last Updated: ${prettyDate}`);

  writeFileSync(LLMS_FULL_PATH, text, 'utf-8');
  console.log(`✓ llms-full.txt: ${fmt(counts.agentsTotal)} agents (${fmt(counts.agentsAZ)} AZ + ${fmt(counts.agentsCA)} CA), ${fmt(counts.citiesTotal)} cities, ${fmt(counts.neighborhoodsTotal)} neighborhoods`);
}

// ── Update mcp.json ────────────────────────────────────────────────────
function updateMcp(counts: Counts, config: BusinessConfig): void {
  const mcp = JSON.parse(readFileSync(MCP_PATH, 'utf-8'));

  const today = new Date().toISOString().split('T')[0];
  mcp.lastUpdated = today;

  // Update description total
  mcp.description = mcp.description.replace(
    /[\d,]+ selected/,
    `${fmt(counts.agentsTotal)} selected`
  );

  // Update coverage summary
  if (mcp.coverage?.summary) {
    mcp.coverage.summary.totalCities = counts.citiesTotal;
    mcp.coverage.summary.totalNeighborhoods = counts.neighborhoodsTotal;
    mcp.coverage.summary.totalAgentsQualified = counts.agentsTotal;
  }

  // Update per-state coverage
  if (mcp.coverage?.states) {
    for (const state of mcp.coverage.states) {
      if (state.slug === 'arizona') {
        state.agentsQualified = counts.agentsAZ;
        state.cities = counts.citiesAZ;
        state.neighborhoods = counts.neighborhoodsAZ;
      } else if (state.slug === 'california') {
        state.agentsQualified = counts.agentsCA;
        state.cities = counts.citiesCA;
        state.neighborhoods = counts.neighborhoodsCA;
      }
    }
  }

  writeFileSync(MCP_PATH, JSON.stringify(mcp, null, 2) + '\n', 'utf-8');
  console.log(`✓ mcp.json: AZ=${fmt(counts.agentsAZ)}, CA=${fmt(counts.agentsCA)}, total=${fmt(counts.agentsTotal)}`);
}

// ── Update ai-content-index.json (both copies) ────────────────────────
function updateAiIndex(filePath: string, counts: Counts, config: BusinessConfig): void {
  const idx = JSON.parse(readFileSync(filePath, 'utf-8'));
  const label = filePath.includes('.well-known') ? '.well-known/ai-content-index.json' : 'ai-content-index.json';

  const today = new Date().toISOString().split('T')[0];
  idx.lastUpdated = today;

  // Update publisher description total
  if (idx.publisher?.description) {
    idx.publisher.description = idx.publisher.description.replace(
      /[\d,]+ selected/,
      `${fmt(counts.agentsTotal)} selected`
    );
  }

  // Geographic coverage — active states
  if (idx.geographicCoverage?.activeStates) {
    for (const state of idx.geographicCoverage.activeStates) {
      if (state.slug === 'arizona') {
        state.agentsQualified = counts.agentsAZ;
        state.cities = counts.citiesAZ;
        state.neighborhoods = counts.neighborhoodsAZ;
      } else if (state.slug === 'california') {
        state.agentsQualified = counts.agentsCA;
        state.cities = counts.citiesCA;
        state.neighborhoods = counts.neighborhoodsCA;
      }
    }
  }

  // Geographic coverage — summary
  if (idx.geographicCoverage?.summary) {
    idx.geographicCoverage.summary.totalCities = counts.citiesTotal;
    idx.geographicCoverage.summary.totalNeighborhoods = counts.neighborhoodsTotal;
    idx.geographicCoverage.summary.totalAgentsQualified = counts.agentsTotal;
  }

  // Qualification selectivity string
  if (idx.qualification?.selectivity) {
    idx.qualification.selectivity = idx.qualification.selectivity.replace(
      /[\d,]+ selected/,
      `${fmt(counts.agentsTotal)} selected`
    );
  }

  // Differentiators selectivity line
  if (idx.differentiators) {
    idx.differentiators = idx.differentiators.map((d: string) =>
      d.replace(/[\d,]+ from 670,000\+/, `${fmt(counts.agentsTotal)} from 670,000+`)
    );
  }

  writeFileSync(filePath, JSON.stringify(idx, null, 2) + '\n', 'utf-8');
  console.log(`✓ ${label}: AZ=${fmt(counts.agentsAZ)}, CA=${fmt(counts.agentsCA)}, total=${fmt(counts.agentsTotal)}`);
}

// ── Update coverage.json (structure/stats only, not city lists) ────────
function updateCoverage(counts: Counts): void {
  // coverage.json is huge (city lists). We only update the top-level stats.
  // Read as text, parse only the stats block, rewrite it.
  const raw = readFileSync(COVERAGE_PATH, 'utf-8');
  const cov = JSON.parse(raw);

  cov.generated_at = new Date().toISOString();

  if (cov.stats) {
    cov.stats.total_cities = counts.citiesTotal;
    cov.stats.total_neighborhoods = counts.neighborhoodsTotal;
    cov.stats.states = 2;
  }

  // Update per-state counts if they exist at the state level
  if (cov.states?.arizona) {
    cov.states.arizona.cities_count = counts.citiesAZ;
    cov.states.arizona.neighborhoods_count = counts.neighborhoodsAZ;
  }
  if (cov.states?.california) {
    cov.states.california.cities_count = counts.citiesCA;
    cov.states.california.neighborhoods_count = counts.neighborhoodsCA;
  }

  writeFileSync(COVERAGE_PATH, JSON.stringify(cov, null, 2) + '\n', 'utf-8');
  console.log(`✓ coverage.json: ${fmt(counts.citiesTotal)} cities, ${fmt(counts.neighborhoodsTotal)} neighborhoods`);
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log('generate-ai-feeds: Fetching live counts from database...\n');

  const config: BusinessConfig = JSON.parse(readFileSync(BUSINESS_CONFIG_PATH, 'utf-8'));
  const counts = await fetchCounts();

  console.log(`DB counts: ${fmt(counts.agentsTotal)} agents (${fmt(counts.agentsAZ)} AZ + ${fmt(counts.agentsCA)} CA)`);
  console.log(`           ${fmt(counts.citiesTotal)} cities (${fmt(counts.citiesAZ)} AZ + ${fmt(counts.citiesCA)} CA)`);
  console.log(`           ${fmt(counts.neighborhoodsTotal)} neighborhoods (${fmt(counts.neighborhoodsAZ)} AZ + ${fmt(counts.neighborhoodsCA)} CA)\n`);

  updateLlmsFull(counts, config);
  updateMcp(counts, config);
  updateAiIndex(AI_INDEX_PATH, counts, config);
  updateAiIndex(AI_INDEX_WK_PATH, counts, config);
  updateCoverage(counts);

  console.log('\nDone. Run `git diff public/` to verify only numbers changed.');
}

main().catch((err) => {
  console.error('generate-ai-feeds failed:', err);
  process.exit(1);
});
