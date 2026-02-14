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

async function pollBatchStatus() {
  // Get the 5 agents we're tracking
  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('id, name, zillow_profile_url, zillow_scrape_status, raw_scraper_data')
    .eq('active', true)
    .not('zillow_profile_url', 'is', null)
    .limit(5);

  if (error || !professionals) {
    console.error('Error fetching professionals:', error);
    process.exit(1);
  }

  console.log(`Polling enrichment status for ${professionals.length} agents every 15 seconds...\n`);

  for (let i = 0; i < 40; i++) { // Poll for up to 10 minutes
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] Status Check #${i + 1}:\n`);

    let processing = 0;
    let success = 0;
    let failed = 0;
    let other = 0;

    for (const prof of professionals) {
      const { data: updated, error: fetchError } = await supabase
        .from('professionals')
        .select('zillow_scrape_status, raw_scraper_data, zillow_scrape_error')
        .eq('id', prof.id)
        .single();

      if (fetchError || !updated) continue;

      const status = updated.zillow_scrape_status || 'unknown';
      const hasRawData = !!updated.raw_scraper_data;
      
      let icon = '⏳';
      if (status === 'success') { icon = '✅'; success++; }
      else if (status === 'failed') { icon = '❌'; failed++; }
      else if (status === 'processing') { icon = '⏳'; processing++; }
      else { icon = '❓'; other++; }

      console.log(`  ${icon} ${prof.name.padEnd(30)} - ${status.padEnd(10)} - Raw data: ${hasRawData ? 'Yes' : 'No'}`);
      
      if (updated.zillow_scrape_error) {
        console.log(`      Error: ${updated.zillow_scrape_error}`);
      }
    }

    console.log(`\n  Summary: ${success} success, ${processing} processing, ${failed} failed, ${other} other\n`);

    if (processing === 0 && other === 0) {
      console.log('✅ All enrichments completed!\n');
      
      // Show detailed results
      console.log('Detailed Results:\n');
      for (const prof of professionals) {
        const { data: final, error: fetchError } = await supabase
          .from('professionals')
          .select('name, zillow_scrape_status, raw_scraper_data')
          .eq('id', prof.id)
          .single();

        if (fetchError || !final) continue;

        console.log(`${final.name}:`);
        if (final.raw_scraper_data) {
          const raw = final.raw_scraper_data as any;
          console.log(`  ✓ Raw data size: ${JSON.stringify(raw).length} bytes`);
          console.log(`  ✓ Top-level fields: ${Object.keys(raw).length}`);
          console.log(`  ✓ Sample fields: ${Object.keys(raw).slice(0, 5).join(', ')}`);
        } else {
          console.log(`  ✗ No raw data stored`);
        }
        console.log('');
      }
      
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
  }

  console.log('\n⏱️ Timeout: Some enrichments still not complete after 10 minutes');
}

pollBatchStatus();
