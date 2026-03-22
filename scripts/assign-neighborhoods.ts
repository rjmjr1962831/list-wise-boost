/**
 * Assign served_neighborhoods to professionals based on service_areas, zip codes, and served_cities.
 *
 * Tier 1: Parse service_areas text → match against neighborhood_catalog (78% of agents)
 * Tier 2: Zip code proximity fallback for agents without service_areas
 * Tier 3: City-level fallback → empty served_neighborhoods array
 *
 * Run: npx tsx scripts/assign-neighborhoods.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// ENV
// ---------------------------------------------------------------------------
function loadEnv(): void {
  const env = readFileSync('.env', 'utf-8');
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
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/['']/g, '')           // strip apostrophes
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')    // non-alphanum → hyphen
    .replace(/^-+|-+$/g, '');       // trim leading/trailing hyphens
}

/**
 * Paginate a Supabase table select. Returns all rows.
 */
async function paginateSelect<T>(
  table: string,
  columns: string,
  filters?: (q: any) => any,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from(table).select(columns).range(offset, offset + pageSize - 1);
    if (filters) query = filters(query);
    const { data, error } = await query;
    if (error) throw new Error(`paginateSelect(${table}) offset=${offset}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

/**
 * Call run_sql RPC (SELECT only).
 */
async function runSql(query: string): Promise<any[]> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`run_sql failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NeighborhoodRow {
  id: string;
  neighborhood: string;
  neighborhood_slug: string;
  city_area: string;
  city_area_slug: string;
  state: string;
  zips: string | null;
  primary_zip: string | null;
  nearby_neighborhoods: any;
}

interface ProfessionalRow {
  id: string;
  service_areas: string[] | null;
  zip_code: string | null;
  business_zip: string | null;
  served_cities: string[] | null;
}

// ---------------------------------------------------------------------------
// Indexes built from neighborhood_catalog
// ---------------------------------------------------------------------------
// slug → neighborhood rows (multiple neighborhoods can share a slug across cities)
let slugIndex: Map<string, NeighborhoodRow[]>;
// city_area_slug → neighborhood rows
let cityIndex: Map<string, NeighborhoodRow[]>;
// zip → neighborhood rows
let zipIndex: Map<string, NeighborhoodRow[]>;
// neighborhood name (lowercased) → rows
let nameIndex: Map<string, NeighborhoodRow[]>;

function buildIndexes(catalog: NeighborhoodRow[]): void {
  slugIndex = new Map();
  cityIndex = new Map();
  zipIndex = new Map();
  nameIndex = new Map();

  for (const row of catalog) {
    // slug index
    const slugKey = row.neighborhood_slug;
    if (!slugIndex.has(slugKey)) slugIndex.set(slugKey, []);
    slugIndex.get(slugKey)!.push(row);

    // city index
    const cityKey = row.city_area_slug;
    if (!cityIndex.has(cityKey)) cityIndex.set(cityKey, []);
    cityIndex.get(cityKey)!.push(row);

    // name index (lowercased)
    const nameLower = row.neighborhood.toLowerCase().trim();
    if (!nameIndex.has(nameLower)) nameIndex.set(nameLower, []);
    nameIndex.get(nameLower)!.push(row);

    // zip index — parse the zips field (comma-separated string, JSON array, or other)
    if (row.zips) {
      const rawZips = typeof row.zips === 'string' ? row.zips
        : Array.isArray(row.zips) ? row.zips.join(',')
        : String(row.zips);
      const zips = rawZips.split(/[,\s]+/).map((z: string) => z.trim()).filter(Boolean);
      for (const z of zips) {
        if (!zipIndex.has(z)) zipIndex.set(z, []);
        zipIndex.get(z)!.push(row);
      }
    }
    if (row.primary_zip) {
      const pz = row.primary_zip.trim();
      if (!zipIndex.has(pz)) zipIndex.set(pz, []);
      // avoid duplicates
      if (!zipIndex.get(pz)!.includes(row)) {
        zipIndex.get(pz)!.push(row);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tier 1: service_areas text matching
// ---------------------------------------------------------------------------
function matchServiceAreas(
  serviceAreas: string[],
  servedCities: string[] | null,
): string[] {
  const matched = new Set<string>();

  for (const area of serviceAreas) {
    // Parse "Hollywood, Los Angeles, CA" or "Scottsdale, AZ"
    const parts = area.split(',').map((p) => p.trim()).filter(Boolean);

    if (parts.length === 0) continue;

    if (parts.length >= 3) {
      // Format: "Neighborhood, City, State" — e.g., "Hollywood, Los Angeles, CA"
      const neighborhoodName = parts[0];
      const cityName = parts[1];
      const neighborhoodSlug = slugify(neighborhoodName);
      const citySlug = slugify(cityName);
      const nameLower = neighborhoodName.toLowerCase().trim();

      // Try exact slug match within the city
      const bySlug = slugIndex.get(neighborhoodSlug);
      if (bySlug) {
        for (const row of bySlug) {
          if (row.city_area_slug === citySlug) {
            matched.add(row.neighborhood_slug);
          }
        }
      }

      // Try name match within the city
      const byName = nameIndex.get(nameLower);
      if (byName) {
        for (const row of byName) {
          if (row.city_area_slug === citySlug) {
            matched.add(row.neighborhood_slug);
          }
        }
      }

      // Also treat the neighborhood name as a potential city-level entry
      // e.g., "Glendale, Los Angeles, CA" where Glendale is its own city
      const asCitySlug = slugify(neighborhoodName);
      const cityNeighborhoods = cityIndex.get(asCitySlug);
      if (cityNeighborhoods) {
        // If the service_area neighborhood name IS a city in our catalog, add all its neighborhoods
        // but cap at 15 to avoid over-assignment
        const cityNSlice = cityNeighborhoods.slice(0, 15);
        for (const row of cityNSlice) {
          matched.add(row.neighborhood_slug);
        }
      }
    } else if (parts.length === 2) {
      // Format: "City, State" — e.g., "Scottsdale, AZ"
      const cityOrNeighborhood = parts[0];
      const slug = slugify(cityOrNeighborhood);

      // First check if it's a city in our catalog
      const cityNeighborhoods = cityIndex.get(slug);
      if (cityNeighborhoods) {
        const cityNSlice = cityNeighborhoods.slice(0, 15);
        for (const row of cityNSlice) {
          matched.add(row.neighborhood_slug);
        }
      }

      // Also check if it's a neighborhood name (could be "Hollywood, CA")
      const nameLower = cityOrNeighborhood.toLowerCase().trim();
      const byName = nameIndex.get(nameLower);
      if (byName) {
        for (const row of byName) {
          matched.add(row.neighborhood_slug);
        }
      }

      // And try slug match
      const bySlug = slugIndex.get(slug);
      if (bySlug) {
        for (const row of bySlug) {
          matched.add(row.neighborhood_slug);
        }
      }
    } else {
      // Single token — try as neighborhood name or city
      const slug = slugify(parts[0]);
      const nameLower = parts[0].toLowerCase().trim();

      const bySlug = slugIndex.get(slug);
      if (bySlug) {
        for (const row of bySlug) matched.add(row.neighborhood_slug);
      }

      const byName = nameIndex.get(nameLower);
      if (byName) {
        for (const row of byName) matched.add(row.neighborhood_slug);
      }

      const cityNeighborhoods = cityIndex.get(slug);
      if (cityNeighborhoods) {
        for (const row of cityNeighborhoods.slice(0, 15)) {
          matched.add(row.neighborhood_slug);
        }
      }
    }
  }

  // Also cross-reference with served_cities — if agent has served_cities, restrict matches
  // to neighborhoods within those cities (unless served_cities is empty/null)
  if (servedCities && servedCities.length > 0 && matched.size > 0) {
    const citySet = new Set(servedCities.map((c) => slugify(c)));
    const filtered = new Set<string>();
    for (const slug of matched) {
      const rows = slugIndex.get(slug);
      if (rows) {
        for (const row of rows) {
          if (citySet.has(row.city_area_slug)) {
            filtered.add(slug);
            break;
          }
        }
      }
    }
    // Only apply filter if it doesn't wipe out all matches
    if (filtered.size > 0) {
      return Array.from(filtered);
    }
  }

  return Array.from(matched);
}

// ---------------------------------------------------------------------------
// Tier 2: zip code proximity
// ---------------------------------------------------------------------------
function matchByZip(
  zipCode: string | null,
  businessZip: string | null,
  catalog: NeighborhoodRow[],
): string[] {
  const matched = new Set<string>();
  const zipsToCheck = [zipCode, businessZip].filter(Boolean) as string[];

  for (const zip of zipsToCheck) {
    const z = zip.trim();
    const byZip = zipIndex.get(z);
    if (byZip) {
      for (const row of byZip) {
        matched.add(row.neighborhood_slug);

        // Also add nearby_neighborhoods from matched neighborhoods
        if (row.nearby_neighborhoods && Array.isArray(row.nearby_neighborhoods)) {
          for (const nearby of row.nearby_neighborhoods) {
            const nearbySlug =
              typeof nearby === 'string'
                ? slugify(nearby)
                : nearby.slug || nearby.neighborhood_slug || slugify(nearby.name || nearby.neighborhood || '');
            if (nearbySlug) {
              matched.add(nearbySlug);
            }
          }
        }
      }
    }
  }

  // Cap at 15 neighborhoods
  const result = Array.from(matched);
  if (result.length > 15) {
    return result.slice(0, 15);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(70));
  console.log('  ASSIGN SERVED NEIGHBORHOODS TO PROFESSIONALS');
  console.log('='.repeat(70));
  console.log();

  // -----------------------------------------------------------------------
  // Step 1: Fetch entire neighborhood_catalog (paginated)
  // -----------------------------------------------------------------------
  console.log('[1/4] Fetching neighborhood_catalog...');
  const catalog = await paginateSelect<NeighborhoodRow>(
    'neighborhood_catalog',
    'id, neighborhood, neighborhood_slug, city_area, city_area_slug, state, zips, primary_zip, nearby_neighborhoods',
    (q) => q.eq('is_active', true),
  );
  console.log(`  -> ${catalog.length} active neighborhoods loaded`);

  // Build lookup indexes
  console.log('  Building indexes...');
  buildIndexes(catalog);
  console.log(`  -> slugIndex: ${slugIndex.size} entries`);
  console.log(`  -> cityIndex: ${cityIndex.size} cities`);
  console.log(`  -> zipIndex: ${zipIndex.size} zip codes`);
  console.log(`  -> nameIndex: ${nameIndex.size} name entries`);
  console.log();

  // -----------------------------------------------------------------------
  // Step 2: Fetch all active professionals (paginated)
  // -----------------------------------------------------------------------
  console.log('[2/4] Fetching active professionals...');
  const professionals = await paginateSelect<ProfessionalRow>(
    'professionals',
    'id, service_areas, zip_code, business_zip, served_cities',
    (q) => q.eq('active', true),
  );
  console.log(`  -> ${professionals.length} active professionals loaded`);
  console.log();

  // -----------------------------------------------------------------------
  // Step 3: Match neighborhoods per agent
  // -----------------------------------------------------------------------
  console.log('[3/4] Matching neighborhoods...');

  const stats = {
    tier1: 0,
    tier2: 0,
    tier3: 0,
    totalNeighborhoods: 0,
    zeroMatches: 0,
    maxNeighborhoods: 0,
    maxAgent: '' as string,
  };

  const updates: { id: string; served_neighborhoods: string[]; tier: number }[] = [];

  for (const agent of professionals) {
    const hasServiceAreas =
      agent.service_areas && Array.isArray(agent.service_areas) && agent.service_areas.length > 0;
    const hasZip = !!(agent.zip_code || agent.business_zip);
    const hasServedCities =
      agent.served_cities && Array.isArray(agent.served_cities) && agent.served_cities.length > 0;

    let neighborhoods: string[] = [];
    let tier = 3;

    // Tier 1: service_areas text matching
    if (hasServiceAreas) {
      neighborhoods = matchServiceAreas(agent.service_areas!, agent.served_cities);
      if (neighborhoods.length > 0) {
        tier = 1;
        stats.tier1++;
      }
    }

    // Tier 2: zip code fallback (only if Tier 1 yielded nothing)
    if (neighborhoods.length === 0 && hasZip) {
      neighborhoods = matchByZip(agent.zip_code, agent.business_zip, catalog);
      if (neighborhoods.length > 0) {
        tier = 2;
        stats.tier2++;
      }
    }

    // Tier 3: city-level fallback (empty array)
    if (neighborhoods.length === 0) {
      stats.tier3++;
      tier = 3;
    }

    // De-duplicate
    neighborhoods = [...new Set(neighborhoods)];

    stats.totalNeighborhoods += neighborhoods.length;
    if (neighborhoods.length === 0) stats.zeroMatches++;
    if (neighborhoods.length > stats.maxNeighborhoods) {
      stats.maxNeighborhoods = neighborhoods.length;
      stats.maxAgent = agent.id;
    }

    updates.push({ id: agent.id, served_neighborhoods: neighborhoods, tier });
  }

  console.log('  Matching complete.');
  console.log();

  // -----------------------------------------------------------------------
  // Step 4: Write updates in batches
  // -----------------------------------------------------------------------
  console.log('[4/4] Writing served_neighborhoods to database...');

  const BATCH_SIZE = 50;
  let written = 0;
  let errors = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    // Use individual updates (Supabase JS doesn't support bulk upsert on arbitrary columns easily)
    const promises = batch.map(async (u) => {
      const { error } = await supabase
        .from('professionals')
        .update({ served_neighborhoods: u.served_neighborhoods })
        .eq('id', u.id);

      if (error) {
        console.error(`  ERROR updating ${u.id}: ${error.message}`);
        errors++;
      } else {
        written++;
      }
    });

    await Promise.all(promises);

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= updates.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length} agents processed`);
    }
  }

  console.log();

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------
  console.log('='.repeat(70));
  console.log('  RESULTS');
  console.log('='.repeat(70));
  console.log();
  console.log(`  Total agents:          ${professionals.length}`);
  console.log(`  Written successfully:  ${written}`);
  console.log(`  Write errors:          ${errors}`);
  console.log();
  console.log(`  Tier 1 (service_areas): ${stats.tier1} agents`);
  console.log(`  Tier 2 (zip fallback):  ${stats.tier2} agents`);
  console.log(`  Tier 3 (city-only):     ${stats.tier3} agents`);
  console.log();
  console.log(
    `  Avg neighborhoods/agent: ${professionals.length > 0 ? (stats.totalNeighborhoods / professionals.length).toFixed(1) : 0}`,
  );
  console.log(
    `  Avg neighborhoods (matched only): ${
      stats.tier1 + stats.tier2 > 0
        ? (stats.totalNeighborhoods / (stats.tier1 + stats.tier2)).toFixed(1)
        : 0
    }`,
  );
  console.log(`  Agents with 0 matches:  ${stats.zeroMatches}`);
  console.log(`  Max neighborhoods:      ${stats.maxNeighborhoods} (agent ${stats.maxAgent})`);
  console.log();

  // -----------------------------------------------------------------------
  // Sample output for verification
  // -----------------------------------------------------------------------
  console.log('-'.repeat(70));
  console.log('  SAMPLE ASSIGNMENTS (first 10 with matches)');
  console.log('-'.repeat(70));
  const samples = updates.filter((u) => u.served_neighborhoods.length > 0).slice(0, 10);
  for (const s of samples) {
    const agent = professionals.find((p) => p.id === s.id);
    console.log(
      `  [Tier ${s.tier}] ${s.id.slice(0, 8)}... => ${s.served_neighborhoods.length} neighborhoods: [${s.served_neighborhoods.slice(0, 5).join(', ')}${s.served_neighborhoods.length > 5 ? '...' : ''}]`,
    );
    if (agent?.service_areas) {
      console.log(`    service_areas: ${agent.service_areas.slice(0, 3).join(' | ')}${agent.service_areas.length > 3 ? ' ...' : ''}`);
    }
  }
  console.log();
  console.log('Done.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
