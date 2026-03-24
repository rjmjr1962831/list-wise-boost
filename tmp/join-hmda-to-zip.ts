/**
 * Join HMDA tract-level data to zip codes using Census crosswalk,
 * then write to neighborhood_catalog via Supabase.
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://wiotrvoirdgzfacuuiem.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Step 1: Build tract → zip mapping from Census crosswalk
console.log('Loading crosswalk...');
const crosswalkRaw = readFileSync('tmp/tract-zip-az-ca.csv', 'utf-8');
const tractToZips = new Map<string, string[]>();
const zipToTracts = new Map<string, string[]>();

for (const line of crosswalkRaw.split('\n').slice(1)) {
  const parts = line.split('|');
  const zip = parts[1]?.trim();  // GEOID_ZCTA5_20
  const tract = parts[9]?.trim(); // GEOID_TRACT_20
  if (!zip || !tract || zip.length < 5) continue;

  if (!tractToZips.has(tract)) tractToZips.set(tract, []);
  tractToZips.get(tract)!.push(zip);

  if (!zipToTracts.has(zip)) zipToTracts.set(zip, []);
  zipToTracts.get(zip)!.push(tract);
}
console.log(`Crosswalk: ${tractToZips.size} tracts → ${zipToTracts.size} zips`);

// Step 2: Load HMDA aggregated data (by tract)
function loadHmda(path: string): Map<string, { total: number; va: number; vaAmt: number; conv: number; fha: number }> {
  const m = new Map();
  const lines = readFileSync(path, 'utf-8').split('\n').slice(1);
  for (const line of lines) {
    const [tract, total, va, vaAmt, conv, fha] = line.split(',');
    if (!tract) continue;
    m.set(tract.trim(), {
      total: parseInt(total) || 0,
      va: parseInt(va) || 0,
      vaAmt: parseInt(vaAmt) || 0,
      conv: parseInt(conv) || 0,
      fha: parseInt(fha) || 0,
    });
  }
  return m;
}

console.log('Loading HMDA data...');
const azHmda = loadHmda('tmp/hmda-az-by-tract.csv');
const caHmda = loadHmda('tmp/hmda-ca-by-tract.csv');
const allHmda = new Map([...azHmda, ...caHmda]);
console.log(`HMDA: ${azHmda.size} AZ tracts, ${caHmda.size} CA tracts`);

// Step 3: Aggregate HMDA by zip (a zip may span multiple tracts)
interface ZipStats {
  total: number;
  va: number;
  vaAmt: number;
  conv: number;
  fha: number;
}

const zipStats = new Map<string, ZipStats>();

for (const [zip, tracts] of zipToTracts) {
  const stats: ZipStats = { total: 0, va: 0, vaAmt: 0, conv: 0, fha: 0 };
  for (const tract of tracts) {
    const h = allHmda.get(tract);
    if (h) {
      stats.total += h.total;
      stats.va += h.va;
      stats.vaAmt += h.vaAmt;
      stats.conv += h.conv;
      stats.fha += h.fha;
    }
  }
  if (stats.total > 0) {
    zipStats.set(zip, stats);
  }
}
console.log(`Zip stats computed: ${zipStats.size} zips with mortgage data`);

// Step 4: Get all neighborhood primary_zips from DB
console.log('Fetching neighborhoods...');
const allNeighborhoods: { id: string; primary_zip: string }[] = [];
let offset = 0;
while (true) {
  const { data, error } = await sb.from('neighborhood_catalog')
    .select('id, primary_zip')
    .eq('is_active', true)
    .not('primary_zip', 'is', null)
    .in('state', ['Arizona', 'California'])
    .range(offset, offset + 999);
  if (error) { console.error('DB error:', error.message); break; }
  if (!data || data.length === 0) break;
  allNeighborhoods.push(...data);
  offset += 1000;
  if (data.length < 1000) break;
}
console.log(`Neighborhoods with zip: ${allNeighborhoods.length}`);

// Step 5: Match and batch update
let matched = 0;
let unmatched = 0;
const batchSize = 100;

for (let i = 0; i < allNeighborhoods.length; i += batchSize) {
  const batch = allNeighborhoods.slice(i, i + batchSize);
  const updates: Promise<any>[] = [];

  for (const nh of batch) {
    const stats = zipStats.get(nh.primary_zip);
    if (!stats || stats.total === 0) {
      unmatched++;
      continue;
    }

    matched++;
    const vaShare = stats.total > 0 ? ((stats.va / stats.total) * 100) : 0;
    const vaAvg = stats.va > 0 ? Math.round(stats.vaAmt / stats.va) : null;

    updates.push(
      sb.from('neighborhood_catalog')
        .update({
          hmda_total_originations: stats.total,
          hmda_va_originations: stats.va,
          hmda_va_share: parseFloat(vaShare.toFixed(2)),
          hmda_va_avg_amount: vaAvg,
          hmda_va_total_volume: stats.va > 0 ? stats.vaAmt : null,
          hmda_conv_originations: stats.conv,
          hmda_fha_originations: stats.fha,
          hmda_year: 2023,
        })
        .eq('id', nh.id)
    );
  }

  await Promise.all(updates);

  if ((i + batchSize) % 1000 === 0 || i + batchSize >= allNeighborhoods.length) {
    console.log(`Progress: ${Math.min(i + batchSize, allNeighborhoods.length)}/${allNeighborhoods.length} (matched: ${matched}, unmatched: ${unmatched})`);
  }
}

console.log(`\nDone! ${matched} neighborhoods updated, ${unmatched} had no HMDA data for their zip.`);

// Step 6: Verify with sample
const { data: sample } = await sb.from('neighborhood_catalog')
  .select('neighborhood, city_area, primary_zip, hmda_total_originations, hmda_va_originations, hmda_va_share, hmda_va_avg_amount')
  .eq('state', 'Arizona')
  .gt('hmda_va_originations', 0)
  .order('hmda_va_share', { ascending: false })
  .limit(10);

console.log('\nTop 10 AZ neighborhoods by VA share:');
console.table(sample);
