/**
 * Check if cloudflare_request_logs has data.
 * Run: npx tsx scripts/check-cloudflare-logs.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv(): void {
  try {
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
  } catch {
    // no .env
  }
}
loadEnv();

const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://wiotrvoirdgzfacuuiem.supabase.co';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!key) {
  console.error(
    'Need Supabase key in .env (SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY)'
  );
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log('Checking cloudflare_request_logs...\n');

  const { count: total, error: e1 } = await supabase
    .from('cloudflare_request_logs')
    .select('*', { count: 'exact', head: true });

  if (e1) {
    console.error('Error:', e1.message);
    return;
  }

  const { count: botCount, error: e2 } = await supabase
    .from('cloudflare_request_logs')
    .select('*', { count: 'exact', head: true })
    .eq('is_bot', true);

  if (e2) {
    console.error('Bot count error:', e2.message);
  }

  const { count: withAgent, error: e3 } = await supabase
    .from('cloudflare_request_logs')
    .select('*', { count: 'exact', head: true })
    .eq('is_bot', true)
    .not('agent_id', 'is', null);

  if (e3) {
    console.error('Agent count error:', e3.message);
  }

  const { data: sample, error: e4 } = await supabase
    .from('cloudflare_request_logs')
    .select('id, timestamp, path, is_bot, bot_type, agent_id')
    .order('timestamp', { ascending: false })
    .limit(3);

  console.log('Total rows:              ', total ?? '?');
  console.log('Rows with is_bot = true: ', botCount ?? '?');
  console.log('Bot rows with agent_id:  ', withAgent ?? '?');
  console.log('');
  if (sample?.length) {
    console.log('Latest 3 rows (sample):');
    sample.forEach((r: Record<string, unknown>, i: number) => {
      console.log(`  ${i + 1}. ${r.timestamp} | bot=${r.is_bot} ${r.bot_type ?? ''} | ${r.path} | agent_id=${r.agent_id ?? 'null'}`);
    });
  } else if (e4) {
    console.log('Sample error:', e4.message);
  }
}

main();
