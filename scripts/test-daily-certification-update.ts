/**
 * Test daily-certification-update: dry run then optional live run with limit 1.
 * Usage: npx tsx scripts/test-daily-certification-update.ts [--live]
 * Requires .env with SUPABASE_SERVICE_ROLE_KEY (SUPABASE_URL optional; defaults to project ref).
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  try {
    const p = resolve(process.cwd(), ".env");
    const s = readFileSync(p, "utf8");
    for (const line of s.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    // no .env
  }
}
loadEnv();

const url = process.env.SUPABASE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const live = process.argv.includes("--live");
const fn = `${url}/functions/v1/daily-certification-update`;

async function main() {
  const body = live ? { limit: 1 } : { dryRun: true };
  console.log(live ? "Live run (limit 1)..." : "Dry run...");
  const res = await fetch(fn, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Enrichment-Key": "t10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log("Status:", res.status);
  try {
    const data = JSON.parse(text);
    console.log(JSON.stringify(data, null, 2));
  } catch {
    console.log("Body:", text);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
