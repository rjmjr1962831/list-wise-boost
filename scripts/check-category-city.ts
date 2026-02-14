import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv(): void {
  const env = readFileSync('.env', 'utf-8');
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('VITE_SUPABASE_PUBLISHABLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkCategoryAndCity() {
  console.log('Checking category and city for Arcadia page...\n');
  
  // Check category
  const { data: category, error: catError } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', 'top10realestateagents')
    .maybeSingle();

  if (catError) {
    console.error('❌ Category error:', catError);
  } else if (!category) {
    console.error('❌ Category "top10realestateagents" not found!');
  } else {
    console.log('✅ Category found:', category.name, `(${category.slug})`);
  }

  // Check city
  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('*')
    .eq('slug', 'phoenix')
    .eq('state_slug', 'arizona')
    .eq('active', true)
    .maybeSingle();

  if (cityError) {
    console.error('❌ City error:', cityError);
  } else if (!city) {
    console.error('❌ Phoenix, Arizona not found!');
  } else {
    console.log('✅ City found:', city.name, city.state, `(${city.slug})`);
  }
}

checkCategoryAndCity();
