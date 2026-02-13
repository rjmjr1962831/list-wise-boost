/**
 * Sync daily_takeaways from Supabase to docs/cursor-daily-updates.md
 * Run: npm run takeaways:sync
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const OUTPUT_FILE = 'docs/cursor-daily-updates.md';

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  loadEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY required in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('daily_takeaways').select('report_date, content').order('report_date', { ascending: false });

  if (error) {
    console.error('Fetch error:', error.message);
    process.exit(1);
  }

  const outPath = resolve(process.cwd(), OUTPUT_FILE);
  mkdirSync(resolve(process.cwd(), 'docs'), { recursive: true });

  const sections: string[] = ['# Cursor Daily Updates\n\n'];
  for (const row of data || []) {
    const content = row.content || `(Empty)`;
    sections.push(`## ${row.report_date}\n\n${content}\n\n`);
  }

  writeFileSync(outPath, sections.join(''), 'utf-8');
  console.log(`Synced ${(data || []).length} reports to ${OUTPUT_FILE}`);
}

main();
