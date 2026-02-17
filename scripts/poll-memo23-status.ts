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

async function checkEnrichmentStatus() {
  const professionalId = 'db433909-83bf-400d-85dd-8ef5721ddf88'; // Geoffrey Stanley Hollands

  console.log('Polling enrichment status every 10 seconds...\n');

  for (let i = 0; i < 30; i++) { // Poll for up to 5 minutes
    const { data: professional, error } = await supabase
      .from('professionals')
      .select('id, name, raw_scraper_data, zillow_scrape_status, zillow_scrape_error, zillow_data_fetched_at')
      .eq('id', professionalId)
      .single();

    if (error) {
      console.error('Error fetching professional:', error);
      process.exit(1);
    }

    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${professional.name}:`);
    console.log(`  Status: ${professional.zillow_scrape_status}`);
    console.log(`  Raw data: ${professional.raw_scraper_data ? 'Yes ✓' : 'No ✗'}`);
    
    if (professional.zillow_scrape_error) {
      console.log(`  Error: ${professional.zillow_scrape_error}`);
    }

    if (professional.raw_scraper_data) {
      const raw = professional.raw_scraper_data as any;
      console.log(`  Raw data size: ${JSON.stringify(raw).length} bytes`);
      console.log(`  Top-level fields: ${Object.keys(raw).length}`);
      console.log(`  Sample fields: ${Object.keys(raw).slice(0, 10).join(', ')}`);
      
      // Check related tables
      const { data: licenses } = await supabase
        .from('agent_licenses')
        .select('license_number')
        .eq('professional_id', professionalId);
      
      const { data: transactions } = await supabase
        .from('agent_transactions')
        .select('id')
        .eq('professional_id', professionalId);
      
      const { data: reviews } = await supabase
        .from('agent_reviews')
        .select('id')
        .eq('professional_id', professionalId);
      
      console.log(`\nRelated data:`);
      console.log(`  Licenses: ${licenses?.length || 0}`);
      console.log(`  Transactions: ${transactions?.length || 0}`);
      console.log(`  Reviews: ${reviews?.length || 0}`);
      
      console.log('\n✅ Enrichment complete!');
      return;
    }

    if (professional.zillow_scrape_status === 'failed') {
      console.log('\n❌ Enrichment failed');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
  }

  console.log('\n⏱️ Timeout: Enrichment took longer than 5 minutes');
}

checkEnrichmentStatus();
