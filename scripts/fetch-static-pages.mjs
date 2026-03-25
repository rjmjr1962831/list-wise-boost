/**
 * fetch-static-pages.mjs — Prebuild step that pulls pre-rendered HTML
 * from the static_pages table and writes to public/ for Vercel to serve.
 *
 * Currently fetches: crawl-stats
 * Run by: npm run prebuild (via package.json)
 */
import { writeFileSync } from "fs";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://wiotrvoirdgzfacuuiem.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!KEY) {
  console.warn("[fetch-static-pages] No Supabase key found, skipping.");
  process.exit(0);
}

const PAGES = [
  { slug: "crawl-stats", outPath: "public/crawl-stats.html" },
];

for (const page of PAGES) {
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
