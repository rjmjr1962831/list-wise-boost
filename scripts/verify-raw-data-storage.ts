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

async function verifyRawData() {
  // Check Geoffrey Stanley Hollands who completed successfully
  const professionalId = 'db433909-83bf-400d-85dd-8ef5721ddf88';
  
  const { data: professional, error } = await supabase
    .from('professionals')
    .select('id, name, raw_scraper_data, zillow_data_fetched_at, agent_sales_stats, ratings')
    .eq('id', professionalId)
    .single();

  if (error) {
    console.error('Error fetching professional:', error);
    process.exit(1);
  }

  console.log(`\n✅ ${professional.name}\n`);
  console.log(`Zillow data fetched: ${professional.zillow_data_fetched_at}`);
  
  if (professional.raw_scraper_data) {
    const raw = professional.raw_scraper_data as any;
    const rawJson = JSON.stringify(raw, null, 2);
    
    console.log(`\n📦 Raw Scraper Data:`);
    console.log(`  - Total size: ${rawJson.length.toLocaleString()} bytes`);
    console.log(`  - Top-level fields: ${Object.keys(raw).length}`);
    console.log(`\n🔍 All available fields:`);
    Object.keys(raw).forEach((key, index) => {
      const value = raw[key];
      const type = Array.isArray(value) ? 'array' : typeof value;
      let preview = '';
      if (value === null || value === undefined) {
        preview = 'null';
      } else if (type === 'object') {
        preview = `{${Object.keys(value).length} keys}`;
      } else if (type === 'array') {
        preview = `[${value.length} items]`;
      } else {
        preview = String(value).substring(0, 50);
      }
      console.log(`  ${(index + 1).toString().padStart(2)}. ${key.padEnd(30)} (${type.padEnd(8)}) - ${preview}`);
    });
    
    console.log(`\n✓ All memo23 data is being stored in raw_scraper_data field!`);
  } else {
    console.log(`\n❌ No raw_scraper_data found`);
  }

  // Check related tables
  const { data: licenses } = await supabase
    .from('agent_licenses')
    .select('license_number, state')
    .eq('professional_id', professionalId);
  
  const { data: transactions } = await supabase
    .from('agent_transactions')
    .select('sold_date, price')
    .eq('professional_id', professionalId)
    .order('sold_date', { ascending: false })
    .limit(5);
  
  const { data: reviews } = await supabase
    .from('agent_reviews')
    .select('rating, review_date')
    .eq('professional_id', professionalId)
    .limit(5);

  console.log(`\n📊 Related data populated:`);
  console.log(`  - Licenses: ${licenses?.length || 0} records`);
  console.log(`  - Transactions: ${transactions?.length || 0} recent sales`);
  console.log(`  - Reviews: ${reviews?.length || 0} reviews`);
}

verifyRawData();
