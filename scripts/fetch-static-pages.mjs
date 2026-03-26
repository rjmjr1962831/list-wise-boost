/**
 * fetch-static-pages.mjs — Prebuild step that pulls pre-rendered HTML
 * and coverage counts from the static_pages table.
 *
 * Fetches:
 *   - crawl-stats → public/crawl-stats.html
 *   - coverage-counts → .coverage-counts.json (used by generate-dynamic-counts
 *     and generate-ai-feeds so all surfaces use the same snapshot)
 *
 * Run by: npm run prebuild (via package.json)
 */
import { writeFileSync } from "fs";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!KEY) {
  console.warn("[fetch-static-pages] No Supabase key found, skipping.");
  process.exit(0);
}

// Fetch HTML pages
const HTML_PAGES = [
  { slug: "crawl-stats", outPath: "public/crawl-stats.html" },
];

for (const page of HTML_PAGES) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/static_pages?slug=eq.${page.slug}&select=html,rendered_at`,
      { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } }
    );
    const data = await res.json();
    if (data[0]?.html) {
      writeFileSync(page.outPath, data[0].html);
      console.log(`[fetch-static-pages] ${page.slug} → ${page.outPath} (${data[0].html.length} bytes, rendered ${data[0].rendered_at})`);
    } else {
      console.warn(`[fetch-static-pages] No pre-rendered HTML for ${page.slug}, keeping existing file.`);
    }
  } catch (err) {
    console.warn(`[fetch-static-pages] Failed to fetch ${page.slug}:`, err.message);
  }
}

// Fetch coverage counts snapshot
try {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/static_pages?slug=eq.coverage-counts&select=html,rendered_at`,
    { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } }
  );
  const data = await res.json();
  if (data[0]?.html) {
    writeFileSync(".coverage-counts.json", data[0].html);
    const snapshot = JSON.parse(data[0].html);
    console.log(`[fetch-static-pages] coverage-counts → .coverage-counts.json (agents: ${snapshot.agents?.total}, updated: ${snapshot.updated_at})`);

    // Also generate static stats.json from the snapshot
    const statsJson = JSON.stringify({
      agents_total: snapshot.agents?.total || 0,
      agents_by_state: {
        AZ: snapshot.agents?.az || 0,
        CA: snapshot.agents?.ca || 0,
        TX: snapshot.agents?.tx || 0,
      },
      cities_total: snapshot.cities?.total || 0,
      neighborhoods_total: snapshot.neighborhoods?.total || 0,
      updated_at: snapshot.updated_at,
      source: "daily-snapshot",
    }, null, 2);
    writeFileSync("public/stats.json", statsJson);
    console.log(`[fetch-static-pages] stats.json → public/stats.json (from coverage snapshot)`);
  } else {
    console.warn("[fetch-static-pages] No coverage-counts snapshot found. Generators will query DB directly.");
  }
} catch (err) {
  console.warn("[fetch-static-pages] Failed to fetch coverage-counts:", err.message);
}
