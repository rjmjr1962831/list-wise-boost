/**
 * Check crm_email_accounts for sequence senders: refresh_token present, token_expiry.
 * Does not log token values. Requires SUPABASE_SERVICE_ROLE_KEY in .env.
 */
import { createClient } from '@supabase/supabase-js';
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

const base =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(base, key);

const ACCOUNTS = ['robert@toptenlists.us', 'hello@toptenlists.us'];

const { data: rows, error } = await supabase
  .from('crm_email_accounts')
  .select('email, refresh_token, token_expiry, updated_at')
  .in('email', ACCOUNTS);

if (error) {
  console.error('Error fetching crm_email_accounts:', error.message);
  process.exit(1);
}

const now = new Date();
console.log('--- Gmail token status (sequence senders) ---\n');

for (const email of ACCOUNTS) {
  const row = (rows ?? []).find((r: { email: string }) => r.email === email);
  if (!row) {
    console.log(`${email}: MISSING ROW – no record in crm_email_accounts. Re-auth in CRM.`);
    continue;
  }
  const hasRefresh = !!row.refresh_token;
  const expiry = row.token_expiry ? new Date(row.token_expiry) : null;
  const expired = !expiry || expiry.getTime() < now.getTime() + 60000; // need refresh if < 1 min left
  const status = !hasRefresh
    ? 'ERROR – no refresh_token. Re-auth in CRM.'
    : expired
      ? 'OK – will refresh on next use (refresh_token present).'
      : `OK – access_token valid until ${expiry.toISOString()}`;
  console.log(`${email}: ${status}`);
  console.log(`  updated_at: ${row.updated_at ?? 'null'}`);
}

console.log('\nIf any account shows ERROR or MISSING ROW, open CRM, go to email settings, and re-connect Gmail for that account.');
