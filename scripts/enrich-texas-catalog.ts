/**
 * enrich-texas-catalog.ts
 *
 * Merges DFW & SA supplement neighborhoods into the Texas catalog,
 * adds HMDA mortgage data, computes nearby neighborhoods, and writes
 * the final enriched catalog.
 *
 * Run:  npx tsx scripts/enrich-texas-catalog.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tmp");

// ── Types ───────────────────────────────────────────────────────────────
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
  zip_count: number;
  matched_zip_count: number;
  price_derived: number;
  price_source: string;
  price_legacy: number;
  price_legacy_mismatch: boolean;
  hmda_total_originations?: number;
  hmda_va_originations?: number;
  hmda_va_share?: number;
  hmda_va_avg_amount?: number;
  hmda_conv_originations?: number;
  hmda_fha_originations?: number;
  hmda_year?: number;
  nearby_neighborhoods?: { name: string; distance_mi: number }[];
}

interface Catalog {
  schema_version: string;
  generated_at: string;
  source_file: string;
  items: CatalogItem[];
}

interface SupplementEntry {
  name: string;
  city: string;
  lat: number;
  lon: number;
}

interface ZipCentroid {
  zip: string;
  lat: number;
  lon: number;
}

interface CensusRecord {
  zip: string;
  median_income: number;
  median_home_value: number;
}

interface HmdaRecord {
  total_originations: number;
  conventional: number;
  fha: number;
  va: number;
  other: number;
  avg_loan_amount: number;
  avg_va_loan_amount: number;
  va_share_pct: number;
}

// ── Haversine ───────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Tier classification (same as build-texas-catalog.ts) ────────────────
function getTier(score: number): string {
  if (score >= 0.8) return "Luxury";
  if (score >= 0.45) return "Prime";
  return "Main";
}

function getTierPrice(tier: string): number {
  if (tier === "Luxury") return 99;
  if (tier === "Prime") return 69;
  return 49;
}

// ── Load ZCTA centroids ────────────────────────────────────────────────
function loadZctaCentroids(txZips: Set<string>): ZipCentroid[] {
  const raw = fs.readFileSync(path.join(TMP, "2020_Gaz_zcta_national.txt"), "utf8");
  const lines = raw.split("\n");
  const centroids: ZipCentroid[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("\t");
    const zip = parts[0]?.trim();
    if (!zip || !txZips.has(zip)) continue;
    const lat = parseFloat(parts[5]?.trim());
    const lon = parseFloat(parts[6]?.trim());
    if (isNaN(lat) || isNaN(lon)) continue;
    centroids.push({ zip, lat, lon });
  }
  return centroids;
}

// ── Load Census ACS data ──────────────────────────────────────────────
function loadCensusData(): Map<string, CensusRecord> {
  const raw = JSON.parse(
    fs.readFileSync(path.join(TMP, "census-tx-income-value.json"), "utf8")
  );
  const map = new Map<string, CensusRecord>();
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const zip = row[3];
    const median_income = parseInt(row[1], 10);
    const median_home_value = parseInt(row[2], 10);
    if (!zip) continue;
    map.set(zip, { zip, median_income, median_home_value });
  }
  return map;
}

// ── Find nearest ZIP ──────────────────────────────────────────────────
function findNearestZip(lat: number, lon: number, centroids: ZipCentroid[]): ZipCentroid | null {
  let best: ZipCentroid | null = null;
  let bestDist = Infinity;
  for (const c of centroids) {
    const d = haversine(lat, lon, c.lat, c.lon);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// ── Normalize name for dedup ──────────────────────────────────────────
function normalizeKey(neighborhood: string, cityArea: string): string {
  return `${neighborhood.toLowerCase().trim()}|${cityArea.toLowerCase().trim()}`;
}

// ── MAIN ──────────────────────────────────────────────────────────────
function main() {
  // Step 1: Load existing catalog
  console.log("Step 1: Loading base catalog...");
  const catalog: Catalog = JSON.parse(
    fs.readFileSync(path.join(TMP, "texasNeighborhoodCatalog.json"), "utf8")
  );
  const baseCount = catalog.items.length;
  console.log(`  Base catalog: ${baseCount} neighborhoods`);

  // Step 2: Load supplement files
  console.log("\nStep 2: Loading supplement files...");
  const dfwSupplement: SupplementEntry[] = JSON.parse(
    fs.readFileSync(path.join(TMP, "supplement-dfw.json"), "utf8")
  );
  const saSupplement: SupplementEntry[] = JSON.parse(
    fs.readFileSync(path.join(TMP, "supplement-sa.json"), "utf8")
  );
  console.log(`  DFW supplement: ${dfwSupplement.length} neighborhoods`);
  console.log(`  SA supplement: ${saSupplement.length} neighborhoods`);

  // Step 3: Merge supplements (dedup by normalized name + city_area)
  console.log("\nStep 3: Merging supplements...");

  // Build existing lookup set
  const existingKeys = new Set<string>();
  for (const item of catalog.items) {
    existingKeys.add(normalizeKey(item.neighborhood, item.city_area));
  }

  // Load census + centroids for ZIP lookup
  const censusMap = loadCensusData();
  const txZips = new Set(censusMap.keys());
  const centroids = loadZctaCentroids(txZips);
  console.log(`  Loaded ${centroids.length} TX ZIP centroids, ${censusMap.size} census ZCTAs`);

  // Collect all incomes/values from base catalog for percentile computation
  // We'll recompute percentiles after adding supplements
  const allSupplements = [...dfwSupplement, ...saSupplement];
  let newCount = 0;
  let skippedDupes = 0;
  let skippedNoData = 0;

  const newRecords: {
    name: string;
    city: string;
    lat: number;
    lon: number;
    zip: string;
    median_income: number;
    median_home_value: number;
  }[] = [];

  for (const s of allSupplements) {
    const key = normalizeKey(s.name, s.city);
    if (existingKeys.has(key)) {
      skippedDupes++;
      continue;
    }

    const nearestZip = findNearestZip(s.lat, s.lon, centroids);
    if (!nearestZip) {
      skippedNoData++;
      continue;
    }
    const census = censusMap.get(nearestZip.zip);
    if (!census || census.median_income === -666666666 || census.median_home_value === -666666666) {
      skippedNoData++;
      continue;
    }

    existingKeys.add(key);
    newRecords.push({
      name: s.name,
      city: s.city,
      lat: s.lat,
      lon: s.lon,
      zip: nearestZip.zip,
      median_income: census.median_income,
      median_home_value: census.median_home_value,
    });
    newCount++;
  }

  console.log(`  New from supplements: ${newCount}`);
  console.log(`  Skipped (already in catalog): ${skippedDupes}`);
  console.log(`  Skipped (no census data): ${skippedNoData}`);

  // Recompute percentile ranks over the full dataset
  const allIncomes = [
    ...catalog.items.map((i) => i.median_income),
    ...newRecords.map((r) => r.median_income),
  ].sort((a, b) => a - b);

  const allValues = [
    ...catalog.items.map((i) => i.median_home_value),
    ...newRecords.map((r) => r.median_home_value),
  ].sort((a, b) => a - b);

  function percentileRank(sorted: number[], val: number): number {
    let count = 0;
    for (const v of sorted) {
      if (v < val) count++;
      else break;
    }
    return sorted.length > 1 ? count / (sorted.length - 1) : 0;
  }

  // Add new supplement neighborhoods as catalog items
  for (const r of newRecords) {
    const income_pct = parseFloat(percentileRank(allIncomes, r.median_income).toFixed(4));
    const value_pct = parseFloat(percentileRank(allValues, r.median_home_value).toFixed(4));
    const score = parseFloat(((income_pct + value_pct) / 2).toFixed(4));
    const tier = getTier(score);
    const price_derived = getTierPrice(tier);

    catalog.items.push({
      state: "TX",
      city_area: r.city,
      neighborhood: r.name,
      zips: r.zip,
      median_income: r.median_income,
      median_home_value: r.median_home_value,
      tier,
      income_pct,
      value_pct,
      score,
      lat: r.lat,
      lon: r.lon,
      zip_count: 1,
      matched_zip_count: 1,
      price_derived,
      price_source: "tier_prices",
      price_legacy: price_derived,
      price_legacy_mismatch: false,
    });
  }

  // Also update percentiles for existing items (since the distribution changed)
  for (const item of catalog.items) {
    item.income_pct = parseFloat(percentileRank(allIncomes, item.median_income).toFixed(4));
    item.value_pct = parseFloat(percentileRank(allValues, item.median_home_value).toFixed(4));
    item.score = parseFloat(((item.income_pct + item.value_pct) / 2).toFixed(4));
    const newTier = getTier(item.score);
    const newPrice = getTierPrice(newTier);
    item.tier = newTier;
    item.price_derived = newPrice;
    item.price_legacy = newPrice;
  }

  console.log(`  Total after merge: ${catalog.items.length}`);

  // Step 4: Load HMDA data
  console.log("\nStep 4: Adding HMDA mortgage data...");
  const hmdaData: Record<string, HmdaRecord> = JSON.parse(
    fs.readFileSync(path.join(TMP, "hmda-tx-by-zip.json"), "utf8")
  );
  console.log(`  HMDA data covers ${Object.keys(hmdaData).length} ZIPs`);

  let hmdaMatchCount = 0;
  for (const item of catalog.items) {
    const hmda = hmdaData[item.zips];
    if (hmda) {
      item.hmda_total_originations = hmda.total_originations;
      item.hmda_va_originations = hmda.va;
      item.hmda_va_share = hmda.va_share_pct;
      item.hmda_va_avg_amount = hmda.avg_va_loan_amount;
      item.hmda_conv_originations = hmda.conventional;
      item.hmda_fha_originations = hmda.fha;
      item.hmda_year = 2022;
      hmdaMatchCount++;
    }
  }
  console.log(`  Neighborhoods with HMDA data: ${hmdaMatchCount}/${catalog.items.length}`);

  // Step 5: Compute nearby neighborhoods (within 3 miles, max 10)
  console.log("\nStep 5: Computing nearby neighborhoods...");
  let totalNearby = 0;

  for (let i = 0; i < catalog.items.length; i++) {
    const item = catalog.items[i];
    const nearby: { name: string; distance_mi: number }[] = [];

    for (let j = 0; j < catalog.items.length; j++) {
      if (i === j) continue;
      const other = catalog.items[j];
      const dist = haversine(item.lat, item.lon, other.lat, other.lon);
      if (dist <= 3.0) {
        nearby.push({
          name: other.neighborhood,
          distance_mi: parseFloat(dist.toFixed(2)),
        });
      }
    }

    // Sort by distance, take top 10
    nearby.sort((a, b) => a.distance_mi - b.distance_mi);
    item.nearby_neighborhoods = nearby.slice(0, 10);
    totalNearby += item.nearby_neighborhoods.length;
  }

  const avgNearby = (totalNearby / catalog.items.length).toFixed(1);
  console.log(`  Average nearby count: ${avgNearby}`);

  // Sort by city_area then neighborhood
  catalog.items.sort((a, b) =>
    a.city_area === b.city_area
      ? a.neighborhood.localeCompare(b.neighborhood)
      : a.city_area.localeCompare(b.city_area)
  );

  // Update metadata
  catalog.generated_at = new Date().toISOString().split("T")[0];
  catalog.source_file = "osm_census_acs_2023_hmda_2022";

  // Step 6: Write output
  console.log("\nStep 6: Writing output...");
  const finalPath = path.join(TMP, "texasNeighborhoodCatalog-final.json");
  fs.writeFileSync(finalPath, JSON.stringify(catalog, null, 2), "utf8");
  console.log(`  Wrote ${finalPath}`);

  const srcDataPath = path.join(ROOT, "src", "data", "texasNeighborhoodCatalog.json");
  fs.writeFileSync(srcDataPath, JSON.stringify(catalog, null, 2), "utf8");
  console.log(`  Wrote ${srcDataPath}`);

  // ── Report ────────────────────────────────────────────────────────────
  const tierBreakdown: Record<string, number> = {};
  for (const item of catalog.items) {
    tierBreakdown[item.tier] = (tierBreakdown[item.tier] || 0) + 1;
  }

  console.log("\n══════════════════════════════════════════════");
  console.log("  ENRICHMENT REPORT");
  console.log("══════════════════════════════════════════════");
  console.log(`  Total neighborhoods:       ${catalog.items.length}`);
  console.log(`  Base catalog:              ${baseCount}`);
  console.log(`  New from supplements:      ${newCount}`);
  console.log(`  Neighborhoods with HMDA:   ${hmdaMatchCount}`);
  console.log(`  Average nearby count:      ${avgNearby}`);
  console.log(`  Tier breakdown:            ${Object.entries(tierBreakdown).map(([t, c]) => `${t}=${c}`).join(", ")}`);
  console.log("══════════════════════════════════════════════");
}

main();
