/**
 * Run qualified-at-4.5 report and print the answer.
 * Loads .env from project root. Requires SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const env = readFileSync(envPath, 'utf-8');
  for (const line of env.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
  }
}
loadEnv();

const url = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!key) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}
const supabase = createClient(url, key);

async function main() {
  // --- Legacy rule (pre-Merit Gate): 4.8+ stars, 20+ reviews ---
  const { count: currentActive } = await supabase
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .eq('active', true);
  const { count: wouldQualify45_20 } = await supabase
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .eq('active', false)
    .gte('review_stars_rating', 4.5)
    .lt('review_stars_rating', 4.8)
    .gte('num_total_reviews', 20);

  const cur = currentActive ?? 0;
  const add45_20 = wouldQualify45_20 ?? 0;
  console.log('--- Legacy rule: 4.8+ stars, 20+ reviews ---');
  console.log('Current active:', cur);
  console.log('Additional at 4.5 min, 20+ reviews (inactive, 4.5–4.8):', add45_20);
  console.log('Total active if 4.5 min, 20+ reviews:', cur + add45_20);
  console.log('');

  // --- Alternative: 4.5+ stars, 10+ reviews ---
  const { count: totalQualified45_10 } = await supabase
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .gte('review_stars_rating', 4.5)
    .gte('num_total_reviews', 10);
  const { count: wouldQualify45_10 } = await supabase
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .eq('active', false)
    .gte('review_stars_rating', 4.5)
    .gte('num_total_reviews', 10);

  const total45_10 = totalQualified45_10 ?? 0;
  const add45_10 = wouldQualify45_10 ?? 0;
  console.log('--- If we used: 4.5+ stars, 10+ reviews ---');
  console.log('Current active (unchanged):', cur);
  console.log('Additional would be active (inactive, 4.5+ stars, 10+ reviews):', add45_10);
  console.log('Total active if 4.5 min, 10+ reviews:', total45_10);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
