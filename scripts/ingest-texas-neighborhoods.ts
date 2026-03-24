/**
 * Ingest Texas neighborhood catalog into Supabase neighborhood_catalog table.
 * Uses REST API with batched upserts (50 per batch).
 *
 * Usage: npx tsx scripts/ingest-texas-neighborhoods.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse .env manually (no dotenv dependency)
const envPath = path.resolve(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const val = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = val;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 50;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface CatalogItem {
  state: string;
  city_area: string;
  neighborhood: string;
  zips: string;
  median_income: number;
  median_home_value: number;
  tier: string;
  income_pct: number;
  value_pct: number;
  score: number;
  lat: number;
  lon: number;
  nearby_neighborhoods?: Array<{ name: string; distance_mi: number }>;
  hmda_total_originations?: number;
  hmda_va_originations?: number;
  hmda_va_share?: number;
  hmda_va_avg_amount?: number;
  hmda_conv_originations?: number;
  hmda_fha_originations?: number;
  hmda_year?: number;
}

function mapItem(item: CatalogItem) {
  return {
    state: 'Texas',
    city_area: item.city_area,
    city_area_slug: slugify(item.city_area),
    neighborhood: item.neighborhood,
    neighborhood_slug: slugify(item.neighborhood),
    zips: [item.zips],
    primary_zip: item.zips,
    lat: item.lat,
    lon: item.lon,
    median_income: item.median_income,
    median_home_value: item.median_home_value,
    tier: item.tier,
    income_pct: Math.round(item.income_pct * 100),
    value_pct: Math.round(item.value_pct * 100),
    score: Math.round(item.score * 100),
    is_verified: true,
    is_active: true,
    source: 'osm_census_2023',
    nearby_neighborhoods: JSON.stringify(item.nearby_neighborhoods ?? []),
    hmda_total_originations: item.hmda_total_originations ?? null,
    hmda_va_originations: item.hmda_va_originations ?? null,
    hmda_va_share: item.hmda_va_share ?? null,
    hmda_va_avg_amount: item.hmda_va_avg_amount ?? null,
    hmda_conv_originations: item.hmda_conv_originations ?? null,
    hmda_fha_originations: item.hmda_fha_originations ?? null,
    hmda_year: item.hmda_year ?? null,
  };
}

async function supabaseRest(endpoint: string, opts: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string> || {}),
    },
  });
  return res;
}

async function runSql(sql: string) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/run_sql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`run_sql failed (${res.status}): ${text}`);
  }
  return text;
}

async function main() {
  // Load catalog
  const catalogPath = path.resolve(__dirname, '..', 'src', 'data', 'texasNeighborhoodCatalog.json');
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  const items: CatalogItem[] = raw.items;
  console.log(`Loaded ${items.length} items from Texas catalog`);

  // Step 1: Delete existing Texas data
  console.log('Deleting existing Texas rows...');
  const delRes = await supabaseRest('/neighborhood_catalog?state=eq.Texas', {
    method: 'DELETE',
  });
  if (!delRes.ok) {
    const errText = await delRes.text();
    console.error(`Delete failed (${delRes.status}): ${errText}`);
    // Try via run_sql as fallback
    console.log('Trying delete via run_sql...');
    await runSql("DELETE FROM neighborhood_catalog WHERE state = 'Texas'");
  }
  console.log('Existing Texas data cleared.');

  // Step 2: Map, deduplicate by composite key, and batch upsert
  const allMapped = items.map(mapItem);
  const deduped = new Map<string, ReturnType<typeof mapItem>>();
  for (const row of allMapped) {
    const key = `${row.state}|${row.city_area_slug}|${row.neighborhood_slug}`;
    deduped.set(key, row); // last wins
  }
  const mapped = Array.from(deduped.values());
  console.log(`After dedup: ${mapped.length} unique rows (removed ${allMapped.length - mapped.length} duplicates)`);
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
    const batch = mapped.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(mapped.length / BATCH_SIZE);

    const res = await supabaseRest('/neighborhood_catalog', {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(batch),
    });

    if (res.ok) {
      inserted += batch.length;
      console.log(`Batch ${batchNum}/${totalBatches}: ${batch.length} rows OK`);
    } else {
      const errText = await res.text();
      console.error(`Batch ${batchNum}/${totalBatches} FAILED (${res.status}): ${errText}`);
      errors += batch.length;
    }
  }

  console.log(`\nInsertion complete: ${inserted} inserted, ${errors} errored.`);

  // Step 3: Verify count
  const countRes = await supabaseRest('/neighborhood_catalog?state=eq.Texas&select=count', {
    method: 'GET',
    headers: {
      'Prefer': 'count=exact',
    },
  });
  const countHeader = countRes.headers.get('content-range');
  const countBody = await countRes.text();
  const match = countHeader?.match(/\/(\d+)/);
  const dbCount = match ? match[1] : countBody;
  console.log(`DB count for Texas: ${dbCount}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
