/**
 * Quick script to query Arcadia neighborhood and nearby neighborhoods
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bgdtekbhelormzbymkhh.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHRla2JoZWxvcm16Ynlta2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjMxOTEsImV4cCI6MjA3ODA5OTE5MX0.pCRa4kAOE2tKzs7JNkoPtfT24sq-50KG7Eopz1-8oCk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('Querying Arcadia neighborhood...\n');

  const { data, error } = await supabase
    .from('neighborhood_catalog')
    .select('neighborhood, city_area, state, neighborhood_slug, nearby_neighborhoods')
    .ilike('neighborhood', '%arcadia%')
    .eq('state', 'Arizona')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No Arcadia neighborhoods found.');
    return;
  }

  console.log(`Found ${data.length} Arcadia neighborhood(s):\n`);

  for (const neighborhood of data) {
    console.log('='.repeat(60));
    console.log(`Neighborhood: ${neighborhood.neighborhood}`);
    console.log(`City: ${neighborhood.city_area}, ${neighborhood.state}`);
    console.log(`Slug: ${neighborhood.neighborhood_slug}`);
    console.log('\nNearby Neighborhoods:');
    
    if (neighborhood.nearby_neighborhoods && Array.isArray(neighborhood.nearby_neighborhoods)) {
      if (neighborhood.nearby_neighborhoods.length === 0) {
        console.log('  (None set)');
      } else {
        neighborhood.nearby_neighborhoods.forEach((nearby: any, index: number) => {
          console.log(`  ${index + 1}. ${nearby.neighborhood || nearby.name || JSON.stringify(nearby)}`);
        });
      }
    } else {
      console.log('  (None set)');
    }
    console.log('='.repeat(60));
    console.log();
  }
}

main().catch(console.error);
