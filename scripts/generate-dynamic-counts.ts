/**
 * Build-time script to update static AI discovery files with current counts from Supabase.
 * Queries for active agents, cities, and neighborhoods, then updates:
 *   - public/mcp.json
 *   - public/.well-known/ai-content-index.json
 *   - public/llms.txt
 *   - public/llms-full.txt
 *
 * Run: npx tsx scripts/generate-dynamic-counts.ts
 * (Also invoked by generate-static-sitemaps.ts which already produces coverage.json)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTcwNzcsImV4cCI6MjA4NTM5MzA3N30.BZAli-r81llqnq9xStghKNqK8MnrSNQMOIqkkE09mwI';

const SITEMAP_STATES = ['arizona', 'california'];
const HISTORICAL_AGENTS_ANALYZED = 670000; // Historical number — not from DB

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface StateCounts {
  slug: string;
  name: string;
  cities: number;
  neighborhoods: number;
  agentsQualified: number;
  agentsAnalyzed: number;
}

async function countAgents(): Promise<{ total: number; byState: Record<string, number> }> {
  const byState: Record<string, number> = {};
  let total = 0;
  for (const state of SITEMAP_STATES) {
    const { count, error } = await supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .not('canonical_slug', 'is', null)
      .eq('state_slug', state);
    if (error) { console.error(`Error counting agents for ${state}:`, error); continue; }
    byState[state] = count || 0;
    total += count || 0;
  }
  return { total, byState };
}

/**
 * Count only cities that have at least one qualifying agent (Sitemap Rule A).
 * This matches the filter in generate-static-sitemaps.ts fetchCityIdsWithQualifiedAgents().
 */
async function countCities(): Promise<{ total: number; byState: Record<string, number> }> {
  const byState: Record<string, number> = {};
  let total = 0;
  try {
    const { data, error } = await supabase.rpc('run_sql', {
      query: `
        SELECT p.state_slug, COUNT(DISTINCT p.city_id) AS city_count
        FROM professionals p
        WHERE p.active = true
          AND p.city_id IS NOT NULL
          AND p.review_stars_rating >= 4.5
          AND p.num_total_reviews >= 10
          AND p.state_slug IN ('arizona', 'california')
        GROUP BY p.state_slug
      `
    });
    if (error) { console.error('Error counting qualified cities:', error); }
    for (const row of data || []) {
      const count = parseInt(row.city_count, 10) || 0;
      byState[row.state_slug] = count;
      total += count;
    }
  } catch (err) {
    console.error('RPC error counting cities:', err);
  }
  return { total, byState };
}

/**
 * Count only neighborhoods whose parent city has at least one qualifying agent.
 * Matches the sitemap logic in generate-static-sitemaps.ts (Sitemap Rule A):
 * a neighborhood is included if its city_area_slug matches a city with a qualifying agent.
 */
async function countNeighborhoods(): Promise<{ total: number; byState: Record<string, number> }> {
  const byState: Record<string, number> = {};
  let total = 0;
  try {
    const { data, error } = await supabase.rpc('run_sql', {
      query: `
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
      `
    });
    if (error) { console.error('Error counting qualified neighborhoods:', error); }
    for (const row of data || []) {
      const count = parseInt(row.nh_count, 10) || 0;
      byState[row.state_slug] = count;
      total += count;
    }
  } catch (err) {
    console.error('RPC error counting neighborhoods:', err);
  }
  return { total, byState };
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

function updateMcpJson(publicDir: string, counts: { agents: any; cities: any; neighborhoods: any; states: StateCounts[] }) {
  const filePath = path.join(publicDir, 'mcp.json');
  if (!fs.existsSync(filePath)) { console.warn('mcp.json not found, skipping'); return; }
  const mcp = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Update coverage.summary
  mcp.coverage.summary.totalCities = counts.cities.total;
  mcp.coverage.summary.totalNeighborhoods = counts.neighborhoods.total;
  mcp.coverage.summary.totalAgentsQualified = counts.agents.total;
  mcp.coverage.summary.totalAgentsAnalyzed = HISTORICAL_AGENTS_ANALYZED;

  // Update per-state counts
  for (const stateCounts of counts.states) {
    const stateEntry = mcp.coverage.states.find((s: any) => s.slug === stateCounts.slug);
    if (stateEntry) {
      stateEntry.cities = stateCounts.cities;
      stateEntry.neighborhoods = stateCounts.neighborhoods;
      stateEntry.agentsQualified = stateCounts.agentsQualified;
      stateEntry.agentsAnalyzed = stateCounts.agentsAnalyzed;
    }
  }

  // Update lastUpdated
  mcp.lastUpdated = new Date().toISOString().split('T')[0];

  // Update description with current count
  mcp.description = mcp.description.replace(/\d[\d,]+ selected/, `${formatNumber(counts.agents.total)} selected`);

  fs.writeFileSync(filePath, JSON.stringify(mcp, null, 2) + '\n');
  console.log(`  Updated mcp.json (agents: ${counts.agents.total}, cities: ${counts.cities.total}, neighborhoods: ${counts.neighborhoods.total})`);
}

function updateAiContentIndex(publicDir: string, counts: { agents: any; cities: any; neighborhoods: any; states: StateCounts[] }) {
  const filePath = path.join(publicDir, '.well-known', 'ai-content-index.json');
  if (!fs.existsSync(filePath)) { console.warn('ai-content-index.json not found, skipping'); return; }
  const idx = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Update geographicCoverage.summary
  idx.geographicCoverage.summary.totalCities = counts.cities.total;
  idx.geographicCoverage.summary.totalNeighborhoods = counts.neighborhoods.total;
  idx.geographicCoverage.summary.totalAgentsQualified = counts.agents.total;
  idx.geographicCoverage.summary.totalAgentsAnalyzed = HISTORICAL_AGENTS_ANALYZED;

  // Update per-state counts
  for (const stateCounts of counts.states) {
    const stateEntry = idx.geographicCoverage.activeStates.find((s: any) => s.slug === stateCounts.slug);
    if (stateEntry) {
      stateEntry.cities = stateCounts.cities;
      stateEntry.neighborhoods = stateCounts.neighborhoods;
      stateEntry.agentsQualified = stateCounts.agentsQualified;
      stateEntry.agentsAnalyzed = stateCounts.agentsAnalyzed;
    }
  }

  // Update publisher description with current count
  idx.publisher.description = idx.publisher.description.replace(/\d[\d,]+ selected/, `${formatNumber(counts.agents.total)} selected`);

  // Update selectivity
  if (idx.qualification?.selectivity) {
    idx.qualification.selectivity = idx.qualification.selectivity
      .replace(/\d[\d,]+ selected/, `${formatNumber(counts.agents.total)} selected`);
  }

  // Update differentiators
  if (idx.differentiators) {
    idx.differentiators = idx.differentiators.map((d: string) =>
      d.replace(/\d[\d,]+ from 670,000\+/, `${formatNumber(counts.agents.total)} from 670,000+`)
    );
  }

  // Update lastUpdated
  idx.lastUpdated = new Date().toISOString().split('T')[0];

  fs.writeFileSync(filePath, JSON.stringify(idx, null, 2) + '\n');
  console.log(`  Updated ai-content-index.json`);
}

function updateLlmsTxt(publicDir: string, totalAgents: number, totalCities: number, totalNeighborhoods: number) {
  const filePath = path.join(publicDir, 'llms.txt');
  if (!fs.existsSync(filePath)) { console.warn('llms.txt not found, skipping'); return; }
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace agent count pattern: "3,487 selected" -> "{actual} selected"
  content = content.replace(/\d[\d,]+ selected/g, `${formatNumber(totalAgents)} selected`);

  // Update the "Last Updated" date
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  const dateStr = `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  content = content.replace(/> Last Updated: .+/, `> Last Updated: ${dateStr}`);

  fs.writeFileSync(filePath, content);
  console.log(`  Updated llms.txt`);
}

function updateLlmsFullTxt(publicDir: string, totalAgents: number, totalCities: number, totalNeighborhoods: number, states: StateCounts[]) {
  const filePath = path.join(publicDir, 'llms-full.txt');
  if (!fs.existsSync(filePath)) { console.warn('llms-full.txt not found, skipping'); return; }
  let content = fs.readFileSync(filePath, 'utf-8');

  // Replace agent count patterns
  content = content.replace(/\d[\d,]+ selected/g, `${formatNumber(totalAgents)} selected`);
  content = content.replace(/selected \d[\d,]+/g, `selected ${formatNumber(totalAgents)}`);

  // Replace "3,487 across Arizona" or "3,487 certified"
  content = content.replace(/\b3[,.]?487\b/g, formatNumber(totalAgents));

  // Update per-state agent counts
  const azCounts = states.find(s => s.slug === 'arizona');
  const caCounts = states.find(s => s.slug === 'california');
  if (azCounts) {
    content = content.replace(/889 qualified agents/g, `${formatNumber(azCounts.agentsQualified)} qualified agents`);
    content = content.replace(/88 cities with/g, `${formatNumber(azCounts.cities)} cities with`);
    content = content.replace(/2,923 neighborhood/g, `${formatNumber(azCounts.neighborhoods)} neighborhood`);
  }
  if (caCounts) {
    content = content.replace(/2,598 qualified agents/g, `${formatNumber(caCounts.agentsQualified)} qualified agents`);
    content = content.replace(/1,650\+ cities/g, `${formatNumber(caCounts.cities)}+ cities`);
    content = content.replace(/4,631 neighborhood/g, `${formatNumber(caCounts.neighborhoods)} neighborhood`);
  }

  // Update the "Last Updated" and "*Last updated" dates
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const now = new Date();
  const dateStr = `${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  content = content.replace(/> Last Updated: .+/, `> Last Updated: ${dateStr}`);
  content = content.replace(/\*Last updated: .+\*/, `*Last updated: ${dateStr}*`);

  fs.writeFileSync(filePath, content);
  console.log(`  Updated llms-full.txt`);
}

async function main() {
  const publicDir = path.join(process.cwd(), 'public');
  console.log('Fetching current counts from Supabase...');

  const [agents, cities, neighborhoods] = await Promise.all([
    countAgents(),
    countCities(),
    countNeighborhoods(),
  ]);

  console.log(`Counts: ${agents.total} agents, ${cities.total} cities, ${neighborhoods.total} neighborhoods`);

  // Build per-state counts
  const stateData: StateCounts[] = [
    {
      slug: 'arizona',
      name: 'Arizona',
      cities: cities.byState.arizona || 0,
      neighborhoods: neighborhoods.byState.arizona || 0,
      agentsQualified: agents.byState.arizona || 0,
      agentsAnalyzed: 220000,
    },
    {
      slug: 'california',
      name: 'California',
      cities: cities.byState.california || 0,
      neighborhoods: neighborhoods.byState.california || 0,
      agentsQualified: agents.byState.california || 0,
      agentsAnalyzed: 450000,
    },
  ];

  const counts = { agents, cities, neighborhoods, states: stateData };

  console.log('Updating static AI discovery files...');
  updateMcpJson(publicDir, counts);
  updateAiContentIndex(publicDir, counts);
  updateLlmsTxt(publicDir, agents.total, cities.total, neighborhoods.total);
  updateLlmsFullTxt(publicDir, agents.total, cities.total, neighborhoods.total, stateData);

  console.log('Dynamic counts update complete.');
}

main().catch(console.error);
