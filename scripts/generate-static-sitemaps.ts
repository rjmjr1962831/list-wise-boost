/**
 * Build-time script to generate static sitemaps and coverage.json
 * Fetches all active cities, neighborhoods, and agents (paginated); supports 50k+ URLs with split files.
 * Run: npx tsx scripts/generate-static-sitemaps.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTcwNzcsImV4cCI6MjA4NTM5MzA3N30.BZAli-r81llqnq9xStghKNqK8MnrSNQMOIqkkE09mwI';
const BASE_URL = 'https://www.top10lists.us';
const MAX_URLS_PER_SITEMAP = 50000; // Sitemap spec limit

/** Only AZ and CA in sitemaps. All other states: noindex, not in sitemap. */
const SITEMAP_STATES = ['arizona', 'california'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface City {
  id: string;
  slug: string;
  state_slug: string;
  name: string;
  state: string;
}

interface Neighborhood {
  neighborhood_slug: string;
  city_area_slug: string;
  primary_zip: string | null;
  state: string;
  neighborhood: string;
  city_area: string;
}

interface Agent {
  state_slug: string;
  canonical_slug: string;
  current_tier?: string;
  badge_tier?: string;
  updated_at?: string;
}

// Normalize state to URL slug (neighborhood_catalog.state can be "Arizona", "TX", "New York", etc.)
function stateToSlug(state: string): string {
  const map: Record<string, string> = {
    Arizona: 'arizona', California: 'california', Texas: 'texas', Florida: 'florida',
    Colorado: 'colorado', 'New York': 'new-york', NY: 'new-york',
    AZ: 'arizona', CA: 'california', TX: 'texas', FL: 'florida', CO: 'colorado',
  };
  return map[state] ?? state.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Fetch the set of city IDs that have at least one qualified agent (Sitemap Rule A).
 * Uses run_sql RPC to JOIN professional_cities -> professionals -> cities.
 */
async function fetchCityIdsWithQualifiedAgents(): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const { data, error } = await supabase.rpc('run_sql', {
      query: `
        SELECT DISTINCT p.city_id::text AS city_id
        FROM professionals p
        WHERE p.active = true
          AND p.city_id IS NOT NULL
          AND p.review_stars_rating >= 4.5
          AND p.num_total_reviews >= 10
          AND p.state_slug IN ('arizona', 'california')
      `
    });
    if (error) { console.error('Error fetching qualified city IDs:', error); return ids; }
    for (const row of data || []) {
      ids.add(row.city_id);
    }
  } catch (err) {
    console.error('RPC error fetching qualified cities:', err);
  }
  console.log(`  Found ${ids.size} cities with qualified agents`);
  return ids;
}

async function fetchAllCities(): Promise<City[]> {
  const all: City[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('cities')
      .select('id, slug, state_slug, name, state')
      .eq('active', true)
      .in('state_slug', SITEMAP_STATES)
      .order('state_slug')
      .order('slug')
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error('Error fetching cities:', error);
      break;
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function fetchAllNeighborhoods(): Promise<Neighborhood[]> {
  const all: Neighborhood[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('neighborhood_catalog')
      .select('neighborhood_slug, city_area_slug, primary_zip, state, neighborhood, city_area')
      .eq('is_active', true)
      .not('primary_zip', 'is', null)
      .in('state', ['Arizona', 'California'])
      .order('state')
      .order('city_area_slug')
      .order('neighborhood_slug')
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error('Error fetching neighborhoods:', error);
      break;
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function fetchAllAgents(): Promise<Agent[]> {
  const all: Agent[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('professionals')
      .select('state_slug, canonical_slug, current_tier, badge_tier, updated_at')
      .eq('active', true)
      .not('canonical_slug', 'is', null)
      .not('state_slug', 'is', null)
      .in('state_slug', SITEMAP_STATES)
      .order('state_slug')
      .order('canonical_slug')
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error('Error fetching agents:', error);
      break;
    }
    if (!data?.length) break;
    all.push(...(data as Agent[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

const today = () => new Date().toISOString().split('T')[0];

function writeUrlsetChunk(
  publicDir: string,
  baseName: string,
  partIndex: number,
  urls: { loc: string }[],
  changefreq: string,
  priority: string
): string {
  const filename = partIndex === 0 ? `${baseName}.xml` : `${baseName}-${partIndex + 1}.xml`;
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  const d = today();
  for (const u of urls) {
    xml += `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${d}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
  }
  xml += '</urlset>';
  fs.writeFileSync(path.join(publicDir, filename), xml);
  return filename;
}

function writeSitemapParts(
  publicDir: string,
  baseName: string,
  locs: string[],
  changefreq: string,
  priority: string
): string[] {
  const files: string[] = [];
  for (let i = 0; i < locs.length; i += MAX_URLS_PER_SITEMAP) {
    const chunk = locs.slice(i, i + MAX_URLS_PER_SITEMAP).map(loc => ({ loc }));
    const partIndex = Math.floor(i / MAX_URLS_PER_SITEMAP);
    const filename = writeUrlsetChunk(publicDir, baseName, partIndex, chunk, changefreq, priority);
    files.push(filename);
  }
  return files;
}

function generateCitySitemap(publicDir: string, cities: City[]): string[] {
  const locs = cities.map(c => `${BASE_URL}/${c.state_slug}/${c.slug}/top10realestateagents`);
  return writeSitemapParts(publicDir, 'sitemap-cities', locs, 'daily', '0.8');
}

function generateNeighborhoodSitemap(publicDir: string, neighborhoods: Neighborhood[]): string[] {
  const locs = neighborhoods
    .filter(n => n.neighborhood_slug && n.city_area_slug)
    .map(n => {
      const stateSlug = stateToSlug(n.state);
      return `${BASE_URL}/${stateSlug}/${n.city_area_slug}/${n.neighborhood_slug}/top10realestateagents`;
    });
  return writeSitemapParts(publicDir, 'sitemap-neighborhoods', locs, 'daily', '0.7');
}

/**
 * Tier-based lastmod for agent pages:
 *   Underwritten: daily (today)
 *   Audited: monthly (1st of current month or updated_at, whichever is newer)
 *   Certified: quarterly (1st of current quarter or updated_at)
 *   Listed: annual (1st of current year or updated_at)
 */
function agentLastmod(a: Agent): string {
  const tier = (a.current_tier || a.badge_tier || 'listed').toLowerCase();
  const d = today();
  if (tier === 'underwritten') return d;
  if (tier === 'audited') {
    const monthStart = d.slice(0, 7) + '-01';
    return a.updated_at ? (a.updated_at.slice(0, 10) > monthStart ? a.updated_at.slice(0, 10) : monthStart) : monthStart;
  }
  if (tier === 'certified') {
    const now = new Date();
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    const quarterStart = `${now.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`;
    return a.updated_at ? (a.updated_at.slice(0, 10) > quarterStart ? a.updated_at.slice(0, 10) : quarterStart) : quarterStart;
  }
  // Listed: annual
  const yearStart = d.slice(0, 4) + '-01-01';
  return a.updated_at ? (a.updated_at.slice(0, 10) > yearStart ? a.updated_at.slice(0, 10) : yearStart) : yearStart;
}

function agentChangefreq(a: Agent): string {
  const tier = (a.current_tier || a.badge_tier || 'listed').toLowerCase();
  if (tier === 'underwritten') return 'daily';
  if (tier === 'audited') return 'monthly';
  if (tier === 'certified') return 'monthly';
  return 'yearly';
}

function generateAgentsSitemap(publicDir: string, agents: Agent[]): string[] {
  // Agent sitemaps use per-agent lastmod and changefreq based on tier
  const files: string[] = [];
  for (let i = 0; i < agents.length; i += MAX_URLS_PER_SITEMAP) {
    const chunk = agents.slice(i, i + MAX_URLS_PER_SITEMAP);
    const partIndex = Math.floor(i / MAX_URLS_PER_SITEMAP);
    const filename = partIndex === 0 ? 'sitemap-agents.xml' : `sitemap-agents-${partIndex + 1}.xml`;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    for (const a of chunk) {
      xml += `  <url>\n    <loc>${BASE_URL}/${a.state_slug}/agents/${a.canonical_slug}</loc>\n    <lastmod>${agentLastmod(a)}</lastmod>\n    <changefreq>${agentChangefreq(a)}</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    }
    xml += '</urlset>';
    fs.writeFileSync(path.join(publicDir, filename), xml);
    files.push(filename);
  }
  return files;
}

function generateSitemapIndex(publicDir: string, cityFiles: string[], neighborhoodFiles: string[], agentFiles: string[]): void {
  const d = today();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Generated: ${d} -->
  <sitemap>
    <loc>${BASE_URL}/sitemap-pages.xml</loc>
    <lastmod>${d}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemap-states.xml</loc>
    <lastmod>${d}</lastmod>
  </sitemap>
`;
  for (const f of cityFiles) {
    xml += `  <sitemap>\n    <loc>${BASE_URL}/${f}</loc>\n    <lastmod>${d}</lastmod>\n  </sitemap>\n`;
  }
  for (const f of neighborhoodFiles) {
    xml += `  <sitemap>\n    <loc>${BASE_URL}/${f}</loc>\n    <lastmod>${d}</lastmod>\n  </sitemap>\n`;
  }
  for (const f of agentFiles) {
    xml += `  <sitemap>\n    <loc>${BASE_URL}/${f}</loc>\n    <lastmod>${d}</lastmod>\n  </sitemap>\n`;
  }
  xml += '</sitemapindex>';
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), xml);
}

function generateCoverageJson(cities: City[], neighborhoods: Neighborhood[]): string {
  const states: Record<string, { name: string; cities_count: number; neighborhoods_count: number; cities: { name: string; slug: string; url: string }[]; neighborhoods: Record<string, { name: string; slug: string; zip: string; url: string }[]> }> = {};
  for (const c of cities) {
    if (!states[c.state_slug]) {
      states[c.state_slug] = {
        name: c.state || c.state_slug,
        cities_count: 0,
        neighborhoods_count: 0,
        cities: [],
        neighborhoods: {},
      };
    }
    states[c.state_slug].cities.push({
      name: c.name,
      slug: c.slug,
      url: `${BASE_URL}/${c.state_slug}/${c.slug}/top10realestateagents`,
    });
  }
  for (const k of Object.keys(states)) {
    states[k].cities_count = states[k].cities.length;
  }
  for (const n of neighborhoods) {
    if (!n.primary_zip) continue;
    const stateSlug = stateToSlug(n.state);
    if (!states[stateSlug]) {
      states[stateSlug] = {
        name: n.state,
        cities_count: 0,
        neighborhoods_count: 0,
        cities: [],
        neighborhoods: {},
      };
    }
    if (!states[stateSlug].neighborhoods[n.city_area_slug]) {
      states[stateSlug].neighborhoods[n.city_area_slug] = [];
    }
    states[stateSlug].neighborhoods[n.city_area_slug].push({
      name: n.neighborhood,
      slug: n.neighborhood_slug,
      zip: n.primary_zip,
      url: `${BASE_URL}/${stateSlug}/${n.city_area_slug}/${n.neighborhood_slug}/top10realestateagents`,
    });
  }
  for (const k of Object.keys(states)) {
    states[k].neighborhoods_count = Object.values(states[k].neighborhoods).flat().length;
  }
  const coverage = {
    generated_at: new Date().toISOString(),
    base_url: BASE_URL,
    stats: {
      total_cities: cities.length,
      total_neighborhoods: neighborhoods.filter(n => n.primary_zip).length,
      states: Object.keys(states).length,
    },
    states,
  };
  return JSON.stringify(coverage, null, 2);
}

function generatePagesSitemap(publicDir: string): void {
  const d = today();
  const pages = [
    { loc: '/', priority: '1.0' },
    { loc: '/about', priority: '0.8' },
    { loc: '/about/ranking-methodology', priority: '0.8' },
    { loc: '/about/founder', priority: '0.7' },
    { loc: '/transparency', priority: '0.8' },
    { loc: '/faq', priority: '0.8' },
    { loc: '/for-ai', priority: '0.9' },
    { loc: '/press', priority: '0.7' },
    { loc: '/crawl-stats', priority: '0.6' },
    { loc: '/privacy', priority: '0.3' },
    { loc: '/terms', priority: '0.3' },
    { loc: '/payments-security', priority: '0.3' },
    { loc: '/ai-citation-whitepaper', priority: '0.6' },
  ];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <!-- Generated: ${d} -->\n`;
  for (const p of pages) {
    xml += `  <url>\n    <loc>${BASE_URL}${p.loc}</loc>\n    <lastmod>${d}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
  }
  xml += '</urlset>';
  fs.writeFileSync(path.join(publicDir, 'sitemap-pages.xml'), xml);
}

function generateStatesSitemap(publicDir: string): void {
  const d = today();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <!-- Generated: ${d} -->\n`;
  for (const state of SITEMAP_STATES) {
    xml += `  <url>\n    <loc>${BASE_URL}/${state}/top10realestateagents</loc>\n    <lastmod>${d}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
  }
  xml += '</urlset>';
  fs.writeFileSync(path.join(publicDir, 'sitemap-states.xml'), xml);
}

async function main() {
  const publicDir = path.join(process.cwd(), 'public');
  console.log('Fetching cities, neighborhoods, and agents from Supabase...');

  const [allCities, allNeighborhoods, agents, qualifiedCityIds] = await Promise.all([
    fetchAllCities(),
    fetchAllNeighborhoods(),
    fetchAllAgents(),
    fetchCityIdsWithQualifiedAgents(),
  ]);

  // Sitemap Rule A: only include cities/neighborhoods with at least one qualified agent
  const cities = allCities.filter(c => qualifiedCityIds.has(c.id));
  // Build a set of city slugs that passed the filter for neighborhood matching
  const qualifiedCitySlugs = new Set(cities.map(c => `${c.state_slug}:${c.slug}`));
  const neighborhoods = allNeighborhoods.filter(n => {
    const stateSlug = stateToSlug(n.state);
    return qualifiedCitySlugs.has(`${stateSlug}:${n.city_area_slug}`);
  });

  const cityCount = cities.length;
  const neighborhoodCount = neighborhoods.filter(n => n.primary_zip).length;
  const agentCount = agents.length;
  console.log(`Fetched ${allCities.length} cities, ${allNeighborhoods.length} neighborhoods, ${agentCount} agents`);
  console.log(`After Sitemap Rule A filter: ${cityCount} cities (removed ${allCities.length - cityCount}), ${neighborhoodCount} neighborhoods (removed ${allNeighborhoods.length - neighborhoodCount})`);

  const cityFiles = generateCitySitemap(publicDir, cities);
  console.log(`✓ Generated city sitemap(s): ${cityFiles.join(', ')} (${cityCount} URLs)`);

  const neighborhoodFiles = generateNeighborhoodSitemap(publicDir, neighborhoods);
  console.log(`✓ Generated neighborhood sitemap(s): ${neighborhoodFiles.join(', ')} (${neighborhoodCount} URLs)`);

  const agentFiles = generateAgentsSitemap(publicDir, agents);
  console.log(`✓ Generated agent sitemap(s): ${agentFiles.join(', ')} (${agentCount} URLs)`);

  generatePagesSitemap(publicDir);
  console.log('✓ Generated sitemap-pages.xml');

  generateStatesSitemap(publicDir);
  console.log('✓ Generated sitemap-states.xml');

  generateSitemapIndex(publicDir, cityFiles, neighborhoodFiles, agentFiles);
  console.log('✓ Generated sitemap.xml index');

  const coverageJson = generateCoverageJson(cities, neighborhoods);
  fs.writeFileSync(path.join(publicDir, 'coverage.json'), coverageJson);
  console.log('✓ Generated coverage.json');

  const totalUrls = cityCount + neighborhoodCount + agentCount + 13 + SITEMAP_STATES.length;
  console.log('\nStatic sitemap generation complete.');
  console.log(`  Total URLs across all sitemaps: ~${totalUrls}`);
}

main().catch(console.error);
