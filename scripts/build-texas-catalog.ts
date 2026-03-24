/**
 * build-texas-catalog.ts
 *
 * Builds the Texas neighborhood catalog JSON by combining:
 *   - OSM neighborhood data (name, lat, lon, type)
 *   - Census Gazetteer ZCTA centroids (for ZIP matching)
 *   - Census ACS data (median_income, median_home_value)
 *
 * Output: tmp/texasNeighborhoodCatalog.json  (AZ v4 format)
 *
 * Run:  npx tsx scripts/build-texas-catalog.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "tmp");

// ── Haversine ──────────────────────────────────────────────────────────
function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

// ── 47 TX cities with approximate coords ───────────────────────────────
interface CityDef {
  name: string;
  lat: number;
  lon: number;
}

const TX_CITIES: CityDef[] = [
  // Houston metro
  { name: "Houston", lat: 29.7604, lon: -95.3698 },
  { name: "Pasadena", lat: 29.6911, lon: -95.2091 },
  { name: "Pearland", lat: 29.5636, lon: -95.286 },
  { name: "The Woodlands", lat: 30.1658, lon: -95.4613 },
  { name: "League City", lat: 29.5075, lon: -95.095 },
  { name: "Sugar Land", lat: 29.6197, lon: -95.635 },
  { name: "Conroe", lat: 30.3119, lon: -95.456 },
  { name: "Atascocita", lat: 29.9988, lon: -95.1766 },
  { name: "Baytown", lat: 29.7355, lon: -94.9774 },
  { name: "Missouri City", lat: 29.6186, lon: -95.5377 },
  { name: "Spring", lat: 30.0799, lon: -95.4172 },
  { name: "Galveston", lat: 29.3013, lon: -94.7977 },
  { name: "Texas City", lat: 29.3838, lon: -94.9027 },
  // DFW metro
  { name: "Dallas", lat: 32.7767, lon: -96.797 },
  { name: "Fort Worth", lat: 32.7555, lon: -97.3308 },
  { name: "Arlington", lat: 32.7357, lon: -97.1081 },
  { name: "Plano", lat: 33.0198, lon: -96.6989 },
  { name: "Irving", lat: 32.814, lon: -96.9489 },
  { name: "Garland", lat: 32.9126, lon: -96.6389 },
  { name: "Grand Prairie", lat: 32.746, lon: -96.9978 },
  { name: "McKinney", lat: 33.1972, lon: -96.6397 },
  { name: "Frisco", lat: 33.1507, lon: -96.8236 },
  { name: "Mesquite", lat: 32.7668, lon: -96.5992 },
  { name: "Denton", lat: 33.2148, lon: -97.1331 },
  { name: "Carrollton", lat: 32.9537, lon: -96.8903 },
  { name: "Lewisville", lat: 33.0462, lon: -96.994 },
  { name: "Allen", lat: 33.1032, lon: -96.6706 },
  { name: "Flower Mound", lat: 33.0146, lon: -97.097 },
  { name: "Mansfield", lat: 32.5632, lon: -97.1417 },
  { name: "North Richland Hills", lat: 32.8343, lon: -97.2289 },
  { name: "Rowlett", lat: 32.9029, lon: -96.5639 },
  { name: "Euless", lat: 32.837, lon: -97.082 },
  { name: "Wylie", lat: 33.0151, lon: -96.5389 },
  { name: "DeSoto", lat: 32.5899, lon: -96.857 },
  // Austin metro
  { name: "Austin", lat: 30.2672, lon: -97.7431 },
  { name: "Round Rock", lat: 30.5083, lon: -97.6789 },
  { name: "Cedar Park", lat: 30.505, lon: -97.8203 },
  { name: "Georgetown", lat: 30.6333, lon: -97.6781 },
  { name: "Pflugerville", lat: 30.4394, lon: -97.62 },
  { name: "San Marcos", lat: 29.8833, lon: -97.9414 },
  { name: "Leander", lat: 30.5788, lon: -97.8531 },
  // San Antonio metro
  { name: "San Antonio", lat: 29.4241, lon: -98.4936 },
  { name: "New Braunfels", lat: 29.703, lon: -98.1245 },
  // Standalone
  { name: "El Paso", lat: 31.7619, lon: -106.485 },
  { name: "Corpus Christi", lat: 27.8006, lon: -97.3964 },
  { name: "Lubbock", lat: 33.5779, lon: -101.8552 },
  { name: "Laredo", lat: 27.5036, lon: -99.5076 },
];

// ── Load OSM neighborhoods ─────────────────────────────────────────────
interface RawNeighborhood {
  name: string;
  lat: number;
  lon: number;
  type: string;
  sourceFile: string;
}

function loadOsmFiles(): RawNeighborhood[] {
  const files = [
    "osm-houston-neighborhoods.json",
    "osm-dfw-neighborhoods.json",
    "osm-austin-neighborhoods.json",
    "osm-sanantonio-neighborhoods.json",
    "osm-elpaso-neighborhoods.json",
    "osm-corpuschristi-neighborhoods.json",
    "osm-lubbock-neighborhoods.json",
    "osm-laredo-neighborhoods.json",
  ];
  const neighborhoods: RawNeighborhood[] = [];
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(TMP, f), "utf8"));
    for (const el of data.elements) {
      const name = el.tags?.name;
      if (!name) continue;
      neighborhoods.push({
        name,
        lat: el.lat,
        lon: el.lon,
        type: el.tags?.place || "neighbourhood",
        sourceFile: f,
      });
    }
  }
  return neighborhoods;
}

// ── Load ZCTA centroids (Gazetteer) ────────────────────────────────────
interface ZipCentroid {
  zip: string;
  lat: number;
  lon: number;
}

function loadZctaCentroids(txZips: Set<string>): ZipCentroid[] {
  const raw = fs.readFileSync(
    path.join(TMP, "2020_Gaz_zcta_national.txt"),
    "utf8"
  );
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

// ── Load Census ACS data ───────────────────────────────────────────────
interface CensusRecord {
  zip: string;
  median_income: number;
  median_home_value: number;
}

function loadCensusData(): Map<string, CensusRecord> {
  const raw = JSON.parse(
    fs.readFileSync(path.join(TMP, "census-tx-income-value.json"), "utf8")
  );
  const map = new Map<string, CensusRecord>();
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const zip = row[3]; // ZCTA code
    const median_income = parseInt(row[1], 10);
    const median_home_value = parseInt(row[2], 10);
    if (!zip) continue;
    map.set(zip, { zip, median_income, median_home_value });
  }
  return map;
}

// ── Find nearest city ──────────────────────────────────────────────────
function findNearestCity(lat: number, lon: number): string {
  let best = TX_CITIES[0].name;
  let bestDist = Infinity;
  for (const c of TX_CITIES) {
    const d = haversine(lat, lon, c.lat, c.lon);
    if (d < bestDist) {
      bestDist = d;
      best = c.name;
    }
  }
  return best;
}

// ── Find nearest ZIP ───────────────────────────────────────────────────
function findNearestZip(
  lat: number,
  lon: number,
  centroids: ZipCentroid[]
): ZipCentroid | null {
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

// ── Tier classification ────────────────────────────────────────────────
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

// ── MAIN ───────────────────────────────────────────────────────────────
function main() {
  console.log("Loading OSM neighborhoods...");
  const neighborhoods = loadOsmFiles();
  console.log(`  Loaded ${neighborhoods.length} neighborhoods from OSM files`);

  console.log("Loading Census ACS data...");
  const censusMap = loadCensusData();
  console.log(`  Loaded ${censusMap.size} ZCTAs with income/value data`);

  const txZips = new Set(censusMap.keys());

  console.log("Loading ZCTA centroids...");
  const centroids = loadZctaCentroids(txZips);
  console.log(`  Loaded ${centroids.length} TX ZIP centroids`);

  // Build intermediate records
  interface IntermediateRecord {
    name: string;
    lat: number;
    lon: number;
    city_area: string;
    zip: string;
    median_income: number;
    median_home_value: number;
  }

  const records: IntermediateRecord[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const n of neighborhoods) {
    const city_area = findNearestCity(n.lat, n.lon);
    const nearestZip = findNearestZip(n.lat, n.lon, centroids);
    if (!nearestZip) {
      skipped.push({ name: n.name, reason: "no ZIP centroid match" });
      continue;
    }
    const census = censusMap.get(nearestZip.zip);
    if (!census) {
      skipped.push({ name: n.name, reason: `no census data for ZIP ${nearestZip.zip}` });
      continue;
    }
    // Skip sentinel values
    if (census.median_income === -666666666 || census.median_home_value === -666666666) {
      skipped.push({
        name: n.name,
        reason: `sentinel value in ZIP ${nearestZip.zip} (income=${census.median_income}, value=${census.median_home_value})`,
      });
      continue;
    }
    records.push({
      name: n.name,
      lat: n.lat,
      lon: n.lon,
      city_area,
      zip: nearestZip.zip,
      median_income: census.median_income,
      median_home_value: census.median_home_value,
    });
  }

  console.log(`\n  Valid records: ${records.length}`);
  console.log(`  Skipped: ${skipped.length}`);

  // Compute percentile ranks
  const incomes = records.map((r) => r.median_income).sort((a, b) => a - b);
  const values = records.map((r) => r.median_home_value).sort((a, b) => a - b);

  function percentileRank(sorted: number[], val: number): number {
    let count = 0;
    for (const v of sorted) {
      if (v < val) count++;
      else break;
    }
    return sorted.length > 1 ? count / (sorted.length - 1) : 0;
  }

  // Build output items
  const items = records.map((r) => {
    const income_pct = parseFloat(percentileRank(incomes, r.median_income).toFixed(4));
    const value_pct = parseFloat(percentileRank(values, r.median_home_value).toFixed(4));
    const score = parseFloat(((income_pct + value_pct) / 2).toFixed(4));
    const tier = getTier(score);
    const price_derived = getTierPrice(tier);

    return {
      state: "TX",
      city_area: r.city_area,
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
    };
  });

  // Sort by city_area then neighborhood
  items.sort((a, b) =>
    a.city_area === b.city_area
      ? a.neighborhood.localeCompare(b.neighborhood)
      : a.city_area.localeCompare(b.city_area)
  );

  const output = {
    schema_version: "v4",
    generated_at: new Date().toISOString().split("T")[0],
    source_file: "osm_census_acs_2023",
    items,
  };

  const outPath = path.join(TMP, "texasNeighborhoodCatalog.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`\nWrote ${outPath}`);
  console.log(`Total items: ${items.length}`);

  // ── Breakdown by metro ───────────────────────────────────────────────
  const houstonMetro = new Set([
    "Houston", "Pasadena", "Pearland", "The Woodlands", "League City",
    "Sugar Land", "Conroe", "Atascocita", "Baytown", "Missouri City",
    "Spring", "Galveston", "Texas City",
  ]);
  const dfwMetro = new Set([
    "Dallas", "Fort Worth", "Arlington", "Plano", "Irving", "Garland",
    "Grand Prairie", "McKinney", "Frisco", "Mesquite", "Denton",
    "Carrollton", "Lewisville", "Allen", "Flower Mound", "Mansfield",
    "North Richland Hills", "Rowlett", "Euless", "Wylie", "DeSoto",
  ]);
  const austinMetro = new Set([
    "Austin", "Round Rock", "Cedar Park", "Georgetown", "Pflugerville",
    "San Marcos", "Leander",
  ]);
  const saMetro = new Set(["San Antonio", "New Braunfels"]);

  function getMetro(city: string): string {
    if (houstonMetro.has(city)) return "Houston Metro";
    if (dfwMetro.has(city)) return "DFW Metro";
    if (austinMetro.has(city)) return "Austin Metro";
    if (saMetro.has(city)) return "San Antonio Metro";
    return city; // standalone
  }

  const metroBreakdown: Record<string, number> = {};
  const tierBreakdown: Record<string, number> = {};
  const metroxTier: Record<string, Record<string, number>> = {};

  for (const item of items) {
    const metro = getMetro(item.city_area);
    metroBreakdown[metro] = (metroBreakdown[metro] || 0) + 1;
    tierBreakdown[item.tier] = (tierBreakdown[item.tier] || 0) + 1;
    if (!metroxTier[metro]) metroxTier[metro] = {};
    metroxTier[metro][item.tier] = (metroxTier[metro][item.tier] || 0) + 1;
  }

  console.log("\n── Metro Breakdown ──");
  for (const [metro, count] of Object.entries(metroBreakdown).sort(
    (a, b) => b[1] - a[1]
  )) {
    const tiers = metroxTier[metro];
    const tierStr = Object.entries(tiers)
      .map(([t, c]) => `${t}=${c}`)
      .join(", ");
    console.log(`  ${metro}: ${count}  (${tierStr})`);
  }

  console.log("\n── Tier Breakdown ──");
  for (const [tier, count] of Object.entries(tierBreakdown).sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${tier}: ${count}`);
  }

  if (skipped.length > 0) {
    console.log(`\n── Skipped Neighborhoods (${skipped.length}) ──`);
    for (const s of skipped) {
      console.log(`  ${s.name}: ${s.reason}`);
    }
  }
}

main();
