/**
 * save-supplements.ts
 *
 * Writes DFW and SA supplement neighborhood arrays to JSON files
 * in tmp/ for use by enrich-texas-catalog.ts.
 *
 * Run:  npx tsx scripts/save-supplements.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TMP = path.resolve(__dirname, "..", "tmp");

interface SupplementEntry {
  name: string;
  city: string;
  lat: number;
  lon: number;
}

// ── DFW Supplement ──────────────────────────────────────────────────────
const dfwSupplement: SupplementEntry[] = [
  // Dallas neighborhoods
  { name: "Downtown Dallas", city: "Dallas", lat: 32.7810, lon: -96.7970 },
  { name: "Deep Ellum", city: "Dallas", lat: 32.7834, lon: -96.7838 },
  { name: "Uptown", city: "Dallas", lat: 32.7990, lon: -96.8020 },
  { name: "Turtle Creek", city: "Dallas", lat: 32.8080, lon: -96.8080 },
  { name: "Oak Lawn", city: "Dallas", lat: 32.8100, lon: -96.8200 },
  { name: "Knox-Henderson", city: "Dallas", lat: 32.8030, lon: -96.7900 },
  { name: "Highland Park", city: "Dallas", lat: 32.8335, lon: -96.7920 },
  { name: "University Park", city: "Dallas", lat: 32.8510, lon: -96.7980 },
  { name: "Preston Hollow", city: "Dallas", lat: 32.8700, lon: -96.8200 },
  { name: "Lakewood", city: "Dallas", lat: 32.8170, lon: -96.7500 },
  { name: "Lower Greenville", city: "Dallas", lat: 32.8180, lon: -96.7680 },
  { name: "M Streets", city: "Dallas", lat: 32.8180, lon: -96.7570 },
  { name: "Lake Highlands", city: "Dallas", lat: 32.8900, lon: -96.7300 },
  { name: "White Rock Lake", city: "Dallas", lat: 32.8400, lon: -96.7280 },
  { name: "Kessler Park", city: "Dallas", lat: 32.7530, lon: -96.8450 },
  { name: "Bishop Arts District", city: "Dallas", lat: 32.7478, lon: -96.8270 },
  { name: "Oak Cliff", city: "Dallas", lat: 32.7260, lon: -96.8450 },
  { name: "The Cedars", city: "Dallas", lat: 32.7690, lon: -96.7920 },
  { name: "Fair Park", city: "Dallas", lat: 32.7790, lon: -96.7620 },
  { name: "Victory Park", city: "Dallas", lat: 32.7890, lon: -96.8100 },
  { name: "Far North Dallas", city: "Dallas", lat: 32.9300, lon: -96.7700 },
  { name: "Bent Tree", city: "Dallas", lat: 32.9450, lon: -96.8200 },
  { name: "Prestonwood", city: "Dallas", lat: 32.9400, lon: -96.8000 },
  { name: "Pleasant Grove", city: "Dallas", lat: 32.7310, lon: -96.7000 },

  // Fort Worth neighborhoods
  { name: "Stockyards", city: "Fort Worth", lat: 32.7875, lon: -97.3470 },
  { name: "Sundance Square", city: "Fort Worth", lat: 32.7555, lon: -97.3310 },
  { name: "Cultural District", city: "Fort Worth", lat: 32.7490, lon: -97.3630 },
  { name: "Near Southside", city: "Fort Worth", lat: 32.7370, lon: -97.3310 },
  { name: "Arlington Heights", city: "Fort Worth", lat: 32.7520, lon: -97.3640 },
  { name: "Ridglea Hills", city: "Fort Worth", lat: 32.7260, lon: -97.3950 },
  { name: "TCU-Westcliff", city: "Fort Worth", lat: 32.7100, lon: -97.3620 },
  { name: "Mistletoe Heights", city: "Fort Worth", lat: 32.7290, lon: -97.3420 },
  { name: "Ryan Place", city: "Fort Worth", lat: 32.7220, lon: -97.3360 },
  { name: "Fairmount", city: "Fort Worth", lat: 32.7300, lon: -97.3370 },
  { name: "Wedgwood", city: "Fort Worth", lat: 32.6580, lon: -97.3830 },
  { name: "Alliance", city: "Fort Worth", lat: 32.9600, lon: -97.3200 },
  { name: "Mira Vista", city: "Fort Worth", lat: 32.6570, lon: -97.4250 },
  { name: "Walsh Ranch", city: "Fort Worth", lat: 32.6730, lon: -97.5100 },

  // Plano
  { name: "Willow Bend", city: "Plano", lat: 33.0100, lon: -96.7500 },
  { name: "Legacy", city: "Plano", lat: 33.0760, lon: -96.7500 },
  { name: "West Plano", city: "Plano", lat: 33.0350, lon: -96.7700 },
  { name: "Downtown Plano", city: "Plano", lat: 33.0190, lon: -96.6990 },
  { name: "Chase Oaks", city: "Plano", lat: 33.0500, lon: -96.7100 },

  // Irving
  { name: "Las Colinas", city: "Irving", lat: 32.8770, lon: -96.9430 },
  { name: "Valley Ranch", city: "Irving", lat: 32.9210, lon: -96.9620 },

  // McKinney
  { name: "Stonebridge Ranch", city: "McKinney", lat: 33.1630, lon: -96.6500 },
  { name: "Craig Ranch", city: "McKinney", lat: 33.1550, lon: -96.6100 },
  { name: "Downtown McKinney", city: "McKinney", lat: 33.1970, lon: -96.6400 },
  { name: "Trinity Falls", city: "McKinney", lat: 33.2500, lon: -96.6100 },

  // Frisco
  { name: "The Grove", city: "Frisco", lat: 33.1600, lon: -96.8050 },
  { name: "Richwoods", city: "Frisco", lat: 33.1900, lon: -96.8600 },
  { name: "Stonebriar", city: "Frisco", lat: 33.1190, lon: -96.8070 },
  { name: "Phillips Creek Ranch", city: "Frisco", lat: 33.1800, lon: -96.8900 },
  { name: "Downtown Frisco", city: "Frisco", lat: 33.1510, lon: -96.8240 },

  // Other DFW suburbs
  { name: "Firewheel", city: "Garland", lat: 32.9530, lon: -96.5900 },
  { name: "Robson Ranch", city: "Denton", lat: 33.1670, lon: -97.1650 },
  { name: "Castle Hills", city: "Carrollton", lat: 33.0100, lon: -96.9200 },
  { name: "Twin Creeks", city: "Allen", lat: 33.1280, lon: -96.6500 },
  { name: "Canyon Falls", city: "Flower Mound", lat: 33.0850, lon: -97.1300 },
];

// ── SA Supplement ───────────────────────────────────────────────────────
const saSupplement: SupplementEntry[] = [
  { name: "Downtown", city: "San Antonio", lat: 29.4241, lon: -98.4936 },
  { name: "Alamo Heights", city: "San Antonio", lat: 29.4840, lon: -98.4660 },
  { name: "Stone Oak", city: "San Antonio", lat: 29.6230, lon: -98.4800 },
  { name: "The Pearl", city: "San Antonio", lat: 29.4420, lon: -98.4810 },
  { name: "Southtown", city: "San Antonio", lat: 29.4160, lon: -98.4930 },
  { name: "King William", city: "San Antonio", lat: 29.4130, lon: -98.4940 },
  { name: "Monte Vista", city: "San Antonio", lat: 29.4590, lon: -98.5010 },
  { name: "Tobin Hill", city: "San Antonio", lat: 29.4530, lon: -98.4900 },
  { name: "Medical Center", city: "San Antonio", lat: 29.5100, lon: -98.5700 },
  { name: "Olmos Park", city: "San Antonio", lat: 29.4740, lon: -98.4870 },
  { name: "Terrell Hills", city: "San Antonio", lat: 29.4780, lon: -98.4510 },
  { name: "The Dominion", city: "San Antonio", lat: 29.5900, lon: -98.6960 },
  { name: "Sonterra", city: "San Antonio", lat: 29.6100, lon: -98.4730 },
  { name: "Shavano Park", city: "San Antonio", lat: 29.5810, lon: -98.5540 },
  { name: "Castle Hills", city: "San Antonio", lat: 29.5230, lon: -98.5170 },
  { name: "La Cantera", city: "San Antonio", lat: 29.6040, lon: -98.6150 },
  { name: "Alamo Ranch", city: "San Antonio", lat: 29.5100, lon: -98.6950 },
  { name: "Government Hill", city: "San Antonio", lat: 29.4380, lon: -98.4640 },
  { name: "Dignowity Hill", city: "San Antonio", lat: 29.4280, lon: -98.4740 },
  { name: "Brackenridge Park", city: "San Antonio", lat: 29.4620, lon: -98.4730 },
  { name: "Leon Valley", city: "San Antonio", lat: 29.4950, lon: -98.6140 },
  { name: "Converse", city: "San Antonio", lat: 29.5170, lon: -98.3160 },
  { name: "Boerne", city: "San Antonio", lat: 29.7947, lon: -98.7320 },
  { name: "Fair Oaks Ranch", city: "San Antonio", lat: 29.7460, lon: -98.6440 },
  { name: "Bulverde", city: "San Antonio", lat: 29.7440, lon: -98.4530 },
  { name: "Gruene", city: "New Braunfels", lat: 29.7380, lon: -98.1070 },
  { name: "River Chase", city: "New Braunfels", lat: 29.7200, lon: -98.0800 },
  { name: "Downtown New Braunfels", city: "New Braunfels", lat: 29.7030, lon: -98.1250 },
];

// ── Write files ─────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(TMP, "supplement-dfw.json"),
  JSON.stringify(dfwSupplement, null, 2),
  "utf8"
);
console.log(`Wrote ${dfwSupplement.length} DFW neighborhoods to tmp/supplement-dfw.json`);

fs.writeFileSync(
  path.join(TMP, "supplement-sa.json"),
  JSON.stringify(saSupplement, null, 2),
  "utf8"
);
console.log(`Wrote ${saSupplement.length} SA neighborhoods to tmp/supplement-sa.json`);
