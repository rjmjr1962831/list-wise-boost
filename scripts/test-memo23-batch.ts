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

async function enrichSingleAgent(professionalId: string, name: string) {
  console.log(`🚀 Starting enrichment for ${name}...`);
  
  const { data, error } = await supabase.functions.invoke('enrich-agent-memo23', {
    body: { professionalId }
  });

  if (error) {
    console.error(`❌ ${name}: Error - ${error.message}`);
    return { success: false, name, error: error.message };
  }

  console.log(`✓ ${name}: ${data.message}`);
  return { success: true, name, data };
}

async function batchEnrichAgents() {
  console.log('Fetching 5 active professionals with Zillow profiles...\n');
  
  const { data: professionals, error } = await supabase
    .from('professionals')
    .select('id, name, zillow_profile_url')
    .eq('active', true)
    .not('zillow_profile_url', 'is', null)
    .limit(5);

  if (error || !professionals) {
    console.error('Error fetching professionals:', error);
    process.exit(1);
  }

  console.log(`Found ${professionals.length} professionals:\n`);
  professionals.forEach(p => {
    console.log(`  - ${p.name}`);
  });

  console.log('\n🔄 Starting concurrent enrichment (5 at a time)...\n');
  const startTime = Date.now();

  // Run all 5 enrichments concurrently
  const results = await Promise.all(
    professionals.map(p => enrichSingleAgent(p.id, p.name))
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️ All enrichments started in ${elapsed}s`);

  const successful = results.filter(r => r.success).length;
  console.log(`\n✅ Successfully started: ${successful}/${results.length}`);

  console.log('\n📊 Results:');
  results.forEach(r => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
  });

  console.log('\n💡 Enrichments are running in background. Use poll-memo23-batch-status.ts to check progress.');
}

batchEnrichAgents();
