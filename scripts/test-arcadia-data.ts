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

async function testArcadiaQuery() {
  console.log('Testing Arcadia neighborhood page data fetch...\n');
  
  const neighborhoodSlug = 'arcadia';
  const citySlug = 'phoenix';
  const stateSlug = 'arizona';
  
  // Step 1: Get neighborhood
  const { data: neighborhood, error: neighborhoodError } = await supabase
    .from('neighborhood_catalog')
    .select('id, primary_zip, zips, nearby_neighborhoods, city_area, city_area_slug')
    .eq('neighborhood_slug', neighborhoodSlug)
    .eq('city_area_slug', citySlug)
    .eq('is_active', true)
    .maybeSingle();

  if (neighborhoodError || !neighborhood) {
    console.error('❌ Neighborhood not found:', neighborhoodError);
    return;
  }

  console.log('✅ Neighborhood found:', neighborhood.city_area, '(', neighborhood.primary_zip, ')');
  console.log('   ID:', neighborhood.id);

  // Step 2: Check for paid experts
  const { data: subscriptions, error: subError } = await supabase
    .from('agent_neighborhood_subscriptions')
    .select(`
      professional_id,
      professionals (
        id, name, company, active
      )
    `)
    .eq('neighborhood_id', neighborhood.id)
    .eq('is_active', true);

  if (subError) {
    console.error('❌ Error fetching subscriptions:', subError);
  } else {
    console.log(`\n✅ Found ${subscriptions?.length || 0} paid experts`);
    if (subscriptions && subscriptions.length > 0) {
      subscriptions.forEach((sub: any) => {
        console.log(`   - ${sub.professionals.name} (${sub.professionals.company})`);
      });
    }
  }

  // Step 3: Check zip_adjacency
  const primaryZip = neighborhood.primary_zip;
  const { data: adjacentZips, error: adjacencyError } = await supabase
    .from('zip_adjacency')
    .select('adjacent_zip, distance_miles')
    .eq('zip_code', primaryZip)
    .lte('distance_miles', 5);

  if (adjacencyError) {
    console.error('❌ Error fetching adjacent zips:', adjacencyError);
  } else {
    console.log(`\n✅ Found ${adjacentZips?.length || 0} adjacent ZIPs within 5 miles of ${primaryZip}`);
  }

  // Step 4: Check agent_zip_activity
  const allZips = [primaryZip, ...(adjacentZips || []).map(z => z.adjacent_zip)];
  const { data: activities, error: activityError } = await supabase
    .from('agent_zip_activity')
    .select('license_number, zip_code, transaction_count')
    .in('zip_code', allZips);

  if (activityError) {
    console.error('❌ Error fetching agent activity:', activityError);
  } else {
    console.log(`\n✅ Found ${activities?.length || 0} agent activity records in ${allZips.length} ZIPs`);
    
    // Count unique agents
    const uniqueAgents = new Set((activities || []).map(a => a.license_number));
    console.log(`   ${uniqueAgents.size} unique agent license numbers`);
  }

  // Step 5: Fallback - try to find agents in Phoenix metro
  console.log('\n--- Testing Fallback Query ---');
  
  const { data: fallbackAgents, error: fallbackError } = await supabase
    .from('professionals')
    .select('id, name, company, business_city, business_zip, state_slug, review_stars_rating, num_total_reviews')
    .eq('active', true)
    .eq('state_slug', stateSlug)
    .gte('review_stars_rating', 4.5)
    .gte('num_total_reviews', 10)
    .order('num_total_reviews', { ascending: false })
    .limit(10);

  if (fallbackError) {
    console.error('❌ Fallback query error:', fallbackError);
  } else {
    console.log(`\n✅ Fallback found ${fallbackAgents?.length || 0} high-rated Arizona agents:`);
    fallbackAgents?.forEach(a => {
      console.log(`   - ${a.name} (${a.business_city || 'No city'}) - ${a.review_stars_rating}★ (${a.num_total_reviews} reviews)`);
    });
  }
}

testArcadiaQuery();
