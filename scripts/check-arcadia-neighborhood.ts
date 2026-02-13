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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkNeighborhood() {
  console.log('Checking Arcadia neighborhood in Phoenix...\n');
  
  const { data, error } = await supabase
    .from('neighborhood_catalog')
    .select('*')
    .eq('city_area_slug', 'phoenix')
    .eq('neighborhood_slug', 'arcadia')
    .maybeSingle();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data) {
    console.log('❌ Arcadia not found in neighborhood_catalog');
    
    // Check if there are any Phoenix neighborhoods
    const { data: phoenixNeighborhoods, error: phoenixError } = await supabase
      .from('neighborhood_catalog')
      .select('neighborhood, neighborhood_slug, is_active, primary_zip')
      .eq('city_area_slug', 'phoenix')
      .limit(10);
    
    if (!phoenixError && phoenixNeighborhoods) {
      console.log(`\nFound ${phoenixNeighborhoods.length} Phoenix neighborhoods:`);
      phoenixNeighborhoods.forEach(n => {
        console.log(`  - ${n.neighborhood} (${n.neighborhood_slug}) - Active: ${n.is_active} - ZIP: ${n.primary_zip}`);
      });
    }
    return;
  }

  console.log('✅ Found Arcadia:');
  console.log(`  Name: ${data.neighborhood}`);
  console.log(`  Slug: ${data.neighborhood_slug}`);
  console.log(`  City: ${data.city_area_slug}`);
  console.log(`  Active: ${data.is_active}`);
  console.log(`  Primary ZIP: ${data.primary_zip}`);
  console.log(`  All ZIPs: ${data.zips}`);
  
  if (!data.is_active) {
    console.log('\n⚠️ Neighborhood is INACTIVE - this is why it\'s not rendering!');
  }
  
  if (!data.primary_zip && (!data.zips || data.zips.length === 0)) {
    console.log('\n⚠️ Neighborhood has NO ZIP codes - this would cause routing issues!');
  }
}

checkNeighborhood();
