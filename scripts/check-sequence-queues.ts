/**
 * Check crm_sequence_enrollments queue: counts by assigned_account and status,
 * and whether any are on the old top10lists.us accounts (would never be sent).
 * Requires SUPABASE_SERVICE_ROLE_KEY (and URL) in .env.
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

const now = new Date().toISOString();

// All enrollments: count by assigned_account and status
const { data: all, error: e1 } = await supabase
  .from('crm_sequence_enrollments')
  .select('id, assigned_account, status, next_send_at, sequence_id');

if (e1) {
  console.error('Error fetching enrollments:', e1.message);
  process.exit(1);
}

const byAccountAndStatus: Record<string, Record<string, number>> = {};
const dueByAccount: Record<string, number> = {};
const accountsUsed = new Set<string>();

for (const row of all ?? []) {
  const acc = row.assigned_account || 'null';
  accountsUsed.add(acc);
  byAccountAndStatus[acc] = byAccountAndStatus[acc] || {};
  byAccountAndStatus[acc][row.status] = (byAccountAndStatus[acc][row.status] || 0) + 1;
  if (row.status === 'active' && row.next_send_at && row.next_send_at <= now) {
    dueByAccount[acc] = (dueByAccount[acc] || 0) + 1;
  }
}

const validAccounts = ['robert@toptenlists.us', 'hello@toptenlists.us'];
const orphanedAccounts = [...accountsUsed].filter((a) => !validAccounts.includes(a));

console.log('--- Enrollment counts by assigned_account and status ---');
for (const acc of [...validAccounts, ...orphanedAccounts].filter((a) => byAccountAndStatus[a])) {
  const statuses = byAccountAndStatus[acc];
  const active = statuses.active ?? 0;
  const due = dueByAccount[acc] ?? 0;
  const warn = orphanedAccounts.includes(acc) ? '  ⚠ ORPHANED (processor only sends from toptenlists.us)' : '';
  console.log(acc);
  Object.entries(statuses).forEach(([s, c]) => console.log(`  ${s}: ${c}`));
  if (statuses.active) console.log(`  → active due now (next_send_at <= now): ${due}`);
  console.log(warn);
}

if (orphanedAccounts.length) {
  console.log('\n--- Fix ---');
  console.log('Enrollments with assigned_account in', orphanedAccounts.join(', '), 'will never be sent.');
  console.log('To reassign to the two sending accounts, run in Supabase SQL Editor:');
  for (const bad of orphanedAccounts) {
    const idx = orphanedAccounts.indexOf(bad) % 2;
    const good = validAccounts[idx];
    console.log(`  UPDATE crm_sequence_enrollments SET assigned_account = '${good}' WHERE assigned_account = '${bad}';`);
  }
} else {
  console.log('\nQueues are aligned: all enrollments use robert@toptenlists.us or hello@toptenlists.us.');
}
