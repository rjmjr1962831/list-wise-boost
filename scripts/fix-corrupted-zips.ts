import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client - STAGING instance where corruption exists
const supabaseUrl = 'https://wiotrvoirdgzfacuuiem.supabase.co';
const supabaseKey = 'sb_publishable_wBATLek3bsYZp7iUDwvp9w_7ii2-zDZ';
const supabase = createClient(supabaseUrl, supabaseKey);

interface Neighborhood {
  id: string;
  neighborhood: string;
  city_area: string;
  neighborhood_slug: string;
  lat: number;
  lon: number;
  primary_zip: string;
}

// Free reverse geocoding using Nominatim (OpenStreetMap)
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Top10Lists-ZipFix/1.0'
      }
    });

    if (!response.ok) {
      console.error(`Geocoding failed for ${lat},${lon}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const zipCode = data.address?.postcode;
    
    if (zipCode) {
      console.log(`✓ Found zip ${zipCode} for coordinates ${lat},${lon}`);
      return zipCode;
    } else {
      console.warn(`⚠ No zip code found for ${lat},${lon}`);
      return null;
    }
  } catch (error) {
    console.error(`Error geocoding ${lat},${lon}:`, error);
    return null;
  }
}

// Rate limit: Nominatim allows 1 request per second
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fixCorruptedZips() {
  console.log('🔍 Fetching neighborhoods with corrupted zip code 85033...\n');

  // Fetch all corrupted neighborhoods
  const { data: neighborhoods, error } = await supabase
    .from('neighborhood_catalog')
    .select('id, neighborhood, city_area, neighborhood_slug, lat, lon, primary_zip')
    .eq('primary_zip', '85033')
    .order('city_area', { ascending: true });

  if (error) {
    console.error('Error fetching neighborhoods:', error);
    return;
  }

  if (!neighborhoods || neighborhoods.length === 0) {
    console.log('✓ No corrupted neighborhoods found!');
    return;
  }

  console.log(`Found ${neighborhoods.length} corrupted neighborhoods:\n`);
  
  // Group by city for reporting
  const byCity = neighborhoods.reduce((acc, n) => {
    acc[n.city_area] = (acc[n.city_area] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(byCity).forEach(([city, count]) => {
    console.log(`  ${city}: ${count} neighborhoods`);
  });

  console.log('\n🔧 Starting zip code correction...\n');

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < neighborhoods.length; i++) {
    const neighborhood = neighborhoods[i];
    
    console.log(`[${i + 1}/${neighborhoods.length}] ${neighborhood.neighborhood} (${neighborhood.city_area})`);

    // Check if we have valid coordinates
    if (!neighborhood.lat || !neighborhood.lon) {
      console.log(`  ⚠ Skipping - no coordinates\n`);
      skippedCount++;
      continue;
    }

    // Reverse geocode to get correct zip
    const correctZip = await reverseGeocode(neighborhood.lat, neighborhood.lon);

    if (correctZip) {
      // Update the database
      const { error: updateError } = await supabase
        .from('neighborhood_catalog')
        .update({ primary_zip: correctZip })
        .eq('id', neighborhood.id);

      if (updateError) {
        console.log(`  ✗ Failed to update: ${updateError.message}\n`);
        failCount++;
      } else {
        console.log(`  ✓ Updated: 85033 → ${correctZip}\n`);
        successCount++;
      }
    } else {
      console.log(`  ✗ Could not find zip code\n`);
      failCount++;
    }

    // Rate limit: wait 1.1 seconds between requests (Nominatim limit)
    if (i < neighborhoods.length - 1) {
      await delay(1100);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✓ Successfully fixed: ${successCount}`);
  console.log(`  ✗ Failed: ${failCount}`);
  console.log(`  ⚠ Skipped (no coords): ${skippedCount}`);
  console.log(`  📝 Total processed: ${neighborhoods.length}`);
}

// Run the fix
fixCorruptedZips().catch(console.error);
