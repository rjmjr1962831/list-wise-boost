/**
 * Add Jerome, AZ to cities (if missing) and run city-content-enrichment for it.
 * Run with: npx tsx scripts/add-jerome-and-enrich.ts
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
if (existsSync(resolve(process.cwd(), '.env'))) {
  for (const line of readFileSync(resolve(process.cwd(), '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY required. Set in .env or run the SQL manually.');
  console.log('\nRun this in Supabase SQL Editor: https://supabase.com/dashboard/project/wiotrvoirdgzfacuuiem/sql/new');
  console.log(`
INSERT INTO cities (name, state, state_slug, slug, active) VALUES
('Jerome', 'Arizona', 'arizona', 'jerome', true)
ON CONFLICT (state_slug, slug) DO NOTHING;
  `);
  console.log('\nThen invoke: curl "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/city-content-enrichment?citySlug=jerome"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  // 1. Ensure Jerome exists
  const { data: existing } = await supabase
    .from('cities')
    .select('id')
    .eq('slug', 'jerome')
    .eq('state_slug', 'arizona')
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('cities').insert({
      name: 'Jerome',
      state: 'Arizona',
      state_slug: 'arizona',
      slug: 'jerome',
      active: true,
    });
    if (error) {
      console.error('Insert failed:', error);
      process.exit(1);
    }
    console.log('✅ Jerome added to cities');
  } else {
    console.log('✅ Jerome already in cities');
  }

  // 2. Invoke city-content-enrichment
  const fnUrl = `${SUPABASE_URL}/functions/v1/city-content-enrichment?citySlug=jerome`;
  const res = await fetch(fnUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  const body = await res.text();
  console.log('Enrichment response:', res.status, body);
  try {
    const json = JSON.parse(body);
    if (json.error) {
      console.error('❌', json.error);
      process.exit(1);
    }
    console.log('✅ Jerome enrichment complete');
  } catch {
    console.log(body);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
