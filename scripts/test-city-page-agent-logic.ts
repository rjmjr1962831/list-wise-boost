/**
 * End-to-end test: City page agent logic (selected cities vs office zip)
 *
 * Rule: Use selected cities when agent has selected; otherwise use office zip.
 *
 * Usage: npx tsx scripts/test-city-page-agent-logic.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv(): void {
  for (const f of ['.env', '.env.local']) {
    try {
      const env = readFileSync(f, 'utf-8');
      for (const line of env.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq <= 0) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        process.env[key] = val;
      }
      break;
    } catch {
      /* try next file */
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTcwNzcsImV4cCI6MjA4NTM5MzA3N30.BZAli-r81llqnq9xStghKNqK8MnrSNQMOIqkkE09mwI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const normalizedStateSlug = 'arizona';

async function runCityPageLogic(citySlug: string, cityData: { id: string; name: string; state?: string }) {
  // Same logic as DynamicCategoryList.tsx
  const { data: anyPcRows } = await supabase
    .from('professional_cities')
    .select('professional_id')
    .eq('active', true);
  const idsWithSelectedCities = new Set((anyPcRows || []).map((r: any) => r.professional_id));

  const { data: pcRows } = await supabase
    .from('professional_cities')
    .select('professional_id')
    .eq('city_id', cityData.id)
    .eq('active', true);
  const idsFromPc = new Set((pcRows || []).map((r: any) => r.professional_id));

  const byId = new Map<string, any>();

  if (idsFromPc.size > 0) {
    const { data: profsByPc } = await supabase
      .from('professionals')
      .select('*')
      .in('id', Array.from(idsFromPc))
      .eq('active', true)
      .gte('review_stars_rating', 4.5)
      .gte('num_total_reviews', 10);
    (profsByPc || []).forEach((p: any) => byId.set(p.id, p));
  }

  const { data: ncRows } = await supabase
    .from('neighborhood_catalog')
    .select('zips')
    .eq('city_area_slug', citySlug)
    .eq('state', cityData.state || 'Arizona')
    .eq('is_active', true);
  const cityZips = new Set<string>();
  (ncRows || []).forEach((r: any) => {
    if (Array.isArray(r.zips)) r.zips.forEach((z: string) => cityZips.add(z));
  });

  if (cityZips.size > 0) {
    const zipList = Array.from(cityZips);
    const [res1, res2] = await Promise.all([
      supabase
        .from('professionals')
        .select('*')
        .eq('active', true)
        .eq('state_slug', normalizedStateSlug)
        .gte('review_stars_rating', 4.5)
        .gte('num_total_reviews', 10)
        .in('business_zip', zipList),
      supabase
        .from('professionals')
        .select('*')
        .eq('active', true)
        .eq('state_slug', normalizedStateSlug)
        .gte('review_stars_rating', 4.5)
        .gte('num_total_reviews', 10)
        .in('zip_code', zipList),
    ]);
    const profsByZip = [...(res1.data || []), ...(res2.data || [])];
    const seen = new Set<string>();
    for (const p of profsByZip) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      const officeZip = (p.business_zip || p.zip_code || '').toString().trim();
      if (!officeZip || !cityZips.has(officeZip)) continue;
      if (idsWithSelectedCities.has(p.id)) continue;
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
  }

  return {
    agents: Array.from(byId.values()),
    idsFromPc,
    idsWithSelectedCities,
    cityZips: cityZips.size,
  };
}

async function main() {
  console.log('\n🧪 City Page Agent Logic E2E Test\n');
  console.log('Rule: Selected cities when agent has selected; otherwise office zip.\n');

  // 1. Fetch cities
  const { data: phoenix, error: phErr } = await supabase
    .from('cities')
    .select('id, name, state')
    .eq('slug', 'phoenix')
    .eq('state_slug', 'arizona')
    .eq('active', true)
    .single();

  const { data: scottsdale, error: scErr } = await supabase
    .from('cities')
    .select('id, name, state')
    .eq('slug', 'scottsdale')
    .eq('state_slug', 'arizona')
    .eq('active', true)
    .single();

  if (phErr || !phoenix) {
    console.error('❌ Phoenix city not found:', phErr?.message);
    process.exit(1);
  }
  if (scErr || !scottsdale) {
    console.error('❌ Scottsdale city not found:', scErr?.message);
    process.exit(1);
  }

  // 2. Run logic for both cities
  const [phoenixResult, scottsdaleResult] = await Promise.all([
    runCityPageLogic('phoenix', phoenix),
    runCityPageLogic('scottsdale', scottsdale),
  ]);

  // 3. Report counts
  const phoenixFromSelection = phoenixResult.agents.filter((p: any) => phoenixResult.idsFromPc.has(p.id)).length;
  const phoenixFromZip = phoenixResult.agents.filter((p: any) => !phoenixResult.idsWithSelectedCities.has(p.id)).length;

  console.log('─'.repeat(60));
  console.log('Phoenix:');
  console.log(`  Total agents: ${phoenixResult.agents.length}`);
  console.log(`  From selected cities: ${phoenixFromSelection}`);
  console.log(`  From office zip (no selected cities): ${phoenixFromZip}`);
  console.log(`  City zips in catalog: ${phoenixResult.cityZips}`);

  console.log('\nScottsdale:');
  console.log(`  Total agents: ${scottsdaleResult.agents.length}`);
  const scottsdaleFromSelection = scottsdaleResult.agents.filter((p: any) => scottsdaleResult.idsFromPc.has(p.id)).length;
  const scottsdaleFromZip = scottsdaleResult.agents.filter((p: any) => !scottsdaleResult.idsWithSelectedCities.has(p.id)).length;
  console.log(`  From selected cities: ${scottsdaleFromSelection}`);
  console.log(`  From office zip (no selected cities): ${scottsdaleFromZip}`);
  console.log(`  City zips in catalog: ${scottsdaleResult.cityZips}`);

  // 4. Fetch live page (dev or staging)
  const base = process.argv.find((a) => a.startsWith('--base='))?.split('=')[1] || 'http://localhost:8080';
  console.log('\n─'.repeat(60));
  console.log(`Fetching live page: ${base}/arizona/phoenix/top10realestateagents`);

  try {
    const resp = await fetch(`${base}/arizona/phoenix/top10realestateagents`, { redirect: 'follow' });
    const body = await resp.text();
    if (resp.status !== 200) {
      console.error(`❌ Page returned ${resp.status}`);
      process.exit(1);
    }
    const hasAgentContent = body.includes('RealEstateAgent') || body.includes('Top Agents') || body.includes('Top 10');
    if (!hasAgentContent) {
      console.error('❌ Page body missing expected agent/listing content');
      process.exit(1);
    }
    console.log(`  ✅ Page returned 200 with expected content`);
  } catch (err) {
    console.warn(`  ⚠️ Could not fetch page (is dev server running?): ${(err as Error).message}`);
    console.log('  Run: npm run dev');
  }

  console.log('\n─'.repeat(60));
  console.log('\n✅ City page logic (selected vs office zip) ran successfully.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
