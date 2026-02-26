/**
 * Invoke crm-migrate to schedule sequence-processor cron (every 5 min).
 * Requires x-migration-key: crm_migrate_2026 and Bearer token.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const env = readFileSync(envPath, 'utf-8');
  for (const line of env.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}

loadEnv();

const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const url = base.replace(/\/$/, '') + '/functions/v1/crm-migrate';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
    'x-migration-key': 'crm_migrate_2026',
  },
  body: '{}',
});

const text = await res.text();
console.log('Status:', res.status);
console.log('Response:', text);

if (!res.ok) {
  process.exit(1);
}
