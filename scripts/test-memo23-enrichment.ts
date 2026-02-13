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

async function testMemo23Enrichment() {
  console.log('Fetching 5 active professionals with Zillow profiles...');
  
  // Get 5 active professionals with zillow_profile_url
  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('id, name, zillow_profile_url, raw_scraper_data')
    .eq('active', true)
    .not('zillow_profile_url', 'is', null)
    .limit(5);

  if (error || !professionals) {
    console.error('Error fetching professionals:', error);
    process.exit(1);
  }

  console.log(`Found ${professionals.length} professionals with Zillow profiles:`);
  professionals.forEach(p => {
    console.log(`  - ${p.name} (${p.id})`);
    console.log(`    Zillow: ${p.zillow_profile_url}`);
    console.log(`    Raw data exists: ${p.raw_scraper_data ? 'Yes' : 'No'}`);
  });

  console.log('\nTesting memo23 enrichment on first agent only (to avoid excessive API costs)...');
  const testProfessional = professionals[0];

  console.log(`\nEnriching: ${testProfessional.name}`);

  // Call the edge function
  const { data, error: fnError } = await supabase.functions.invoke('enrich-agent-memo23', {
    body: {
      professionalId: testProfessional.id
    }
  });

  if (fnError) {
    console.error('Error calling function:', fnError);
    process.exit(1);
  }

  console.log('\nFunction response:');
  console.log(JSON.stringify(data, null, 2));

  if (data.success) {
    console.log(`\n✓ Success! Enriched ${data.name}`);
    
    // Fetch updated record to check raw_scraper_data
    console.log('\nFetching updated record to verify raw data storage...');
    const { data: updated, error: updateError } = await supabase
      .from('professionals')
      .select('id, name, raw_scraper_data, zillow_data_fetched_at, agent_sales_stats, ratings')
      .eq('id', testProfessional.id)
      .single();

    if (!updateError && updated) {
      console.log(`\n${updated.name}:`);
      console.log(`  - Zillow data fetched: ${updated.zillow_data_fetched_at ? new Date(updated.zillow_data_fetched_at).toLocaleString() : 'N/A'}`);
      console.log(`  - Raw scraper data stored: ${updated.raw_scraper_data ? 'Yes ✓' : 'No ✗'}`);
      
      if (updated.raw_scraper_data) {
        const raw = updated.raw_scraper_data as any;
        console.log(`  - Raw data size: ${JSON.stringify(raw).length} bytes`);
        console.log(`  - Raw data keys: ${Object.keys(raw).length} top-level fields`);
        console.log(`  - Sample fields: ${Object.keys(raw).slice(0, 10).join(', ')}`);
      }
      
      if (updated.agent_sales_stats) {
        console.log(`  - Sales stats: ${JSON.stringify(updated.agent_sales_stats)}`);
      }
      
      if (updated.ratings) {
        console.log(`  - Ratings: ${JSON.stringify(updated.ratings)}`);
      }
    }

    // Check if related tables were populated
    console.log('\nChecking related tables...');
    
    const { data: licenses } = await supabase
      .from('agent_licenses')
      .select('license_number, state')
      .eq('professional_id', testProfessional.id);
    console.log(`  - Licenses: ${licenses?.length || 0} records`);
    
    const { data: transactions } = await supabase
      .from('agent_transactions')
      .select('sold_date, price')
      .eq('professional_id', testProfessional.id);
    console.log(`  - Transactions: ${transactions?.length || 0} records`);
    
    const { data: listings } = await supabase
      .from('agent_listings')
      .select('listing_type, price')
      .eq('professional_id', testProfessional.id);
    console.log(`  - Listings: ${listings?.length || 0} records`);
    
    const { data: reviews } = await supabase
      .from('agent_reviews')
      .select('rating, review_date')
      .eq('professional_id', testProfessional.id);
    console.log(`  - Reviews: ${reviews?.length || 0} records`);
  }
}

testMemo23Enrichment();
