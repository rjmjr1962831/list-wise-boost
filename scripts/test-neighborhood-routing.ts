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

async function testNeighborhoodRouting() {
  console.log('Testing neighborhood routing logic...\n');
  
  const stateSlug = 'arizona';
  const citySlug = 'phoenix';
  const neighborhoodSlug = 'arcadia';
  const categorySlug = 'top10realestateagents';
  
  console.log(`URL: /${stateSlug}/${citySlug}/${neighborhoodSlug}/${categorySlug}\n`);
  
  // Step 1: Check if neighborhood exists (NeighborhoodCategoryRouter logic)
  const { data: neighborhood, error } = await supabase
    .from('neighborhood_catalog')
    .select('neighborhood, neighborhood_slug, city_area_slug, primary_zip, zips')
    .eq('city_area_slug', citySlug)
    .eq('neighborhood_slug', neighborhoodSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('❌ Database error:', error);
    return;
  }

  if (!neighborhood) {
    console.log('❌ Neighborhood not found or inactive');
    return;
  }

  console.log('✅ Step 1: Neighborhood found');
  console.log(`  Should redirect to: /${stateSlug}/${citySlug}/${neighborhood.primary_zip}/${neighborhoodSlug}/${categorySlug}\n`);
  
  // Step 2: Test the 5-segment route (NeighborhoodZipCategoryRouter logic)
  const zipCode = neighborhood.primary_zip;
  
  console.log(`Testing 5-segment route with ZIP: ${zipCode}\n`);
  
  // Step 3: Try different queries to see what works
  
  // First, check if we can query professionals at all
  const { count: totalCount, error: totalError } = await supabase
    .from('professionals')
    .select('*', { count: 'exact', head: true });
  
  if (totalError) {
    console.error('❌ Error counting all professionals:', totalError);
    console.log('This suggests RLS (Row Level Security) is blocking the query');
  } else {
    console.log(`✅ Total professionals in database: ${totalCount}`);
  }
  
  // Try querying with active filter
  const { count: activeCount, error: activeError } = await supabase
    .from('professionals')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);
  
  if (activeError) {
    console.error('❌ Error counting active professionals:', activeError);
  } else {
    console.log(`✅ Active professionals: ${activeCount}`);
  }
  
  // Try getting some sample data
  const { data: sampleAgents, error: sampleError } = await supabase
    .from('professionals')
    .select('id, name, city_slug, neighborhoods')
    .eq('active', true)
    .eq('city_slug', citySlug)
    .limit(5);
  
  if (sampleError) {
    console.error('❌ Error fetching sample agents:', sampleError);
  } else if (sampleAgents && sampleAgents.length > 0) {
    console.log(`\n✅ Found ${sampleAgents.length} sample Phoenix agents:`);
    sampleAgents.forEach(a => {
      console.log(`  - ${a.name}: ${JSON.stringify(a.neighborhoods)}`);
    });
  } else {
    console.log('\n⚠️ No Phoenix agents found');
  }
}

testNeighborhoodRouting();
