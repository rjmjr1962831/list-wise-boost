/**
 * s1 — Master Synthesis. Gathers all per-AI takeaways and updates COMPREHENSIVE_KNOWLEDGE_DOCUMENT.
 *
 * Usage: npm run s1
 *
 * 1. Reads all *TAKEAWAYS*.md in docs/takeaways/
 * 2. Consolidates them by date and AI source
 * 3. Updates docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md:
 *    - Sets "Last consolidated" to today
 *    - Updates live agent counts from Supabase (Section 1 coverage line)
 *    - Adds/updates "## 21. Recent Updates (from t1)" with synthesized content
 *    - Preserves all other sections
 * 4. Commits locally (does NOT push — Robert batches pushes with pts)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env manually (no dotenv dependency)
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const TAKEAWAYS_DIR = resolve(process.cwd(), 'docs/takeaways');
const COMPREHENSIVE_PATH = resolve(process.cwd(), 'docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md');
const TAKEAWAYS_GLOB = /^[A-Z_]+_TAKEAWAYS_\d{4}-\d{2}-\d{2}(_\d{4})?\.md$/;

function getTakeawaysFiles(): string[] {
  if (!existsSync(TAKEAWAYS_DIR)) return [];
  return readdirSync(TAKEAWAYS_DIR)
    .filter((f) => TAKEAWAYS_GLOB.test(f))
    .sort()
    .reverse();
}

function parseTakeawaysFile(filePath: string): { ai: string; date: string; content: string } {
  const content = readFileSync(filePath, 'utf-8');
  const match = filePath.match(/([A-Z_]+)_TAKEAWAYS_(\d{4}-\d{2}-\d{2})(_\d{4})?\.md$/);
  const ai = match?.[1] ?? 'UNKNOWN';
  const date = match?.[2] ?? '';
  return { ai, date, content };
}

function synthesizeTakeaways(files: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const sections: string[] = [`## 21. Recent Updates (from t1)\n\n*Last synthesized: ${today}*\n\n`];

  for (const f of files) {
    const path = resolve(TAKEAWAYS_DIR, f);
    const { ai, date, content } = parseTakeawaysFile(path);
    sections.push(`### ${ai} — ${date}\n\n${content.trim()}\n\n`);
  }

  return sections.join('---\n\n');
}

async function getLiveCounts(): Promise<{ total: number; az: number; ca: number } | null> {
  try {
    const url = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) { console.warn('s1: SUPABASE_SERVICE_ROLE_KEY not set, skipping live count update'); return null; }
    const sb = createClient(url, key);
    const { data, error } = await sb.rpc('run_sql', {
      query: `SELECT
        count(*) FILTER (WHERE active = true) AS total,
        count(*) FILTER (WHERE active = true AND state_slug = 'arizona') AS az,
        count(*) FILTER (WHERE active = true AND state_slug = 'california') AS ca
      FROM professionals`
    });
    if (error || !data?.[0]) { console.warn('s1: DB query failed, skipping live count update'); return null; }
    const r = data[0];
    return { total: Number(r.total), az: Number(r.az), ca: Number(r.ca) };
  } catch (e) {
    console.warn('s1: Could not fetch live counts:', e);
    return null;
  }
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

async function updateComprehensive(synthesis: string): Promise<void> {
  let doc = readFileSync(COMPREHENSIVE_PATH, 'utf-8');
  const today = new Date().toISOString().slice(0, 10);

  // Update Last consolidated date
  doc = doc.replace(
    /\*\*Last consolidated:\*\* .+/,
    `**Last consolidated:** ${today}`
  );

  // Update live agent counts in Section 1 coverage line
  const counts = await getLiveCounts();
  if (counts) {
    doc = doc.replace(
      /[\d,]+ active \([\d,]+ AZ \+ [\d,]+ CA\)/,
      `${fmt(counts.total)} active (${fmt(counts.az)} AZ + ${fmt(counts.ca)} CA)`
    );
    console.log(`s1: Updated coverage counts → ${fmt(counts.total)} active (${fmt(counts.az)} AZ + ${fmt(counts.ca)} CA)`);
  }

  // Remove ALL existing "## 21. Recent Updates" sections (may be duplicated from prior bugs)
  doc = doc.replace(/\n---\s*\n+## 21\. Recent Updates \(from t1\)[\s\S]*$/, '');

  // Append new synthesis at end
  doc = doc.trimEnd() + '\n\n---\n\n' + synthesis.trim() + '\n';

  writeFileSync(COMPREHENSIVE_PATH, doc, 'utf-8');
}

async function main() {
  const files = getTakeawaysFiles();
  if (files.length === 0) {
    console.log('No t1 takeaways files found in docs/takeaways/. Run "t1" on each AI first.');
    process.exit(0);
    return;
  }

  console.log(`Found ${files.length} takeaways: ${files.join(', ')}`);
  const synthesis = synthesizeTakeaways(files);
  await updateComprehensive(synthesis);
  console.log(`Updated docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md with synthesis from ${files.length} AI(s).`);

  // Commit locally only — do NOT push. Robert will batch pushes with pts.
  execSync('git add docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md', { stdio: 'inherit' });
  try {
    execSync('git commit -m "s1: update COMPREHENSIVE Section 21 from takeaways"', { stdio: 'inherit' });
    console.log('s1: committed locally. Run pts when ready to push.');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('nothing to commit') || msg.includes('no changes added')) {
      console.log('No changes to commit; COMPREHENSIVE already up to date.');
    } else {
      throw e;
    }
  }
}

main();
