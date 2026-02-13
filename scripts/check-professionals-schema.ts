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

async function checkSchema() {
  console.log('Fetching one agent to see all available columns...\n');
  
  const { data, error } = await supabase
    .from('professionals')
    .select('*')
    .eq('active', true)
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (data) {
    console.log('Available columns in professionals table:');
    Object.keys(data).sort().forEach(key => {
      const value = data[key];
      const type = typeof value;
      const preview = Array.isArray(value) ? `[${value.length} items]` : 
                     value === null ? 'null' :
                     type === 'string' ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` :
                     JSON.stringify(value).substring(0, 50);
      console.log(`  - ${key} (${type}): ${preview}`);
    });
    
    // Check if they have Phoenix
    const { count, error: countError } = await supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);
    
    if (!countError) {
      console.log(`\n✅ Total active agents: ${count}`);
    }
    
    // Try to find Phoenix city
    const { data: phoenixCity, error: cityError } = await supabase
      .from('cities')
      .select('*')
      .eq('slug', 'phoenix')
      .maybeSingle();
    
    if (!cityError && phoenixCity) {
      console.log(`\n✅ Phoenix city found:`, phoenixCity);
      
      // Count agents in Phoenix
      const { count: phoenixCount, error: phoenixCountError } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .eq('city_id', phoenixCity.id);
      
      if (!phoenixCountError) {
        console.log(`\n✅ Phoenix agents: ${phoenixCount}`);
      }
    }
  }
}

checkSchema();
