/**
 * s1 -- Master Synthesis. Gathers all per-AI takeaways and updates COMPREHENSIVE_KNOWLEDGE_DOCUMENT.
 *
 * Usage: npm run s1
 *
 * Strategy:
 * 1. Reads all *TAKEAWAYS*.md in docs/takeaways/
 * 2. Splits each into sections (Key Outcomes, Config, New Rules, New Functions, Deprecated)
 * 3. Deduplicates bullet points across all files (keeps first occurrence)
 * 4. Groups by topic, not by session/date
 * 5. Drops files older than RETENTION_DAYS from synthesis (they stay on disk for audit)
 * 6. Updates Section 21 of COMPREHENSIVE with compact, topic-grouped output
 * 7. Commits locally (does NOT push -- Robert batches pushes with pts)
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
const RETENTION_DAYS = 14;

// Canonical topic buckets that map to t1 template sections
const TOPIC_MAP: Record<string, string> = {
  'key outcomes': 'Key Outcomes',
  'config / infrastructure': 'Config / Infrastructure',
  'config/infrastructure': 'Config / Infrastructure',
  'new rules or docs': 'New Rules or Docs',
  'new functions / scripts': 'New Functions / Scripts',
  'new functions/scripts': 'New Functions / Scripts',
  'deprecated or removed': 'Deprecated or Removed',
};

interface ParsedTakeaway {
  ai: string;
  date: string;
  sections: Map<string, string[]>; // topic -> bullet lines
}

function getTakeawaysFiles(): string[] {
  if (!existsSync(TAKEAWAYS_DIR)) return [];
  return readdirSync(TAKEAWAYS_DIR)
    .filter((f) => TAKEAWAYS_GLOB.test(f))
    .sort();
}

function filterByRetention(files: string[]): string[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return files.filter((f) => {
    const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[1] >= cutoffStr : false;
  });
}

function normalizeLine(line: string): string {
  return line.replace(/^[-*]\s+/, '').trim().toLowerCase();
}

function classifySection(heading: string): string {
  const lower = heading.toLowerCase().trim();
  for (const [key, canonical] of Object.entries(TOPIC_MAP)) {
    if (lower.includes(key)) return canonical;
  }
  // Anything else goes into Key Outcomes
  return 'Key Outcomes';
}

function parseTakeawaysFile(filePath: string): ParsedTakeaway {
  const content = readFileSync(filePath, 'utf-8');
  const match = filePath.match(/([A-Z_]+)_TAKEAWAYS_(\d{4}-\d{2}-\d{2})(_\d{4})?\.md$/);
  const ai = match?.[1] ?? 'UNKNOWN';
  const date = match?.[2] ?? '';

  const sections = new Map<string, string[]>();
  let currentTopic = 'Key Outcomes';

  for (const line of content.split('\n')) {
    // Detect section headers (## Key Outcomes, ## Config / Infrastructure, etc.)
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1];
      // Skip the file title line (e.g., "# Claude Code Takeaways -- 2026-03-14")
      if (heading.toLowerCase().includes('takeaways')) continue;
      currentTopic = classifySection(heading);
      continue;
    }

    // Only keep bullet lines (- or *)
    if (/^\s*[-*]\s+/.test(line) && line.trim().length > 5) {
      if (!sections.has(currentTopic)) sections.set(currentTopic, []);
      sections.get(currentTopic)!.push(line.trim());
    }
  }

  return { ai, date, sections };
}

function synthesizeTakeaways(files: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const allParsed = files.map((f) => parseTakeawaysFile(resolve(TAKEAWAYS_DIR, f)));

  // Collect all bullets per topic, deduplicating by normalized content
  const topicBullets = new Map<string, string[]>();
  const seen = new Set<string>();
  const topicOrder = ['Key Outcomes', 'Config / Infrastructure', 'New Rules or Docs', 'New Functions / Scripts', 'Deprecated or Removed'];

  for (const topic of topicOrder) {
    topicBullets.set(topic, []);
  }

  // Process newest first so we keep the most recent phrasing
  for (const parsed of [...allParsed].reverse()) {
    for (const [topic, bullets] of parsed.sections) {
      const canonicalTopic = topicOrder.includes(topic) ? topic : 'Key Outcomes';
      if (!topicBullets.has(canonicalTopic)) topicBullets.set(canonicalTopic, []);

      for (const bullet of bullets) {
        const normalized = normalizeLine(bullet);
        // Skip very short or generic lines
        if (normalized.length < 10) continue;
        // Deduplicate by first 80 chars of normalized content
        const dedupeKey = normalized.slice(0, 80);
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        topicBullets.get(canonicalTopic)!.push(bullet);
      }
    }
  }

  // Build output
  const dateRange = allParsed.length > 0
    ? `${allParsed[0].date} to ${allParsed[allParsed.length - 1].date}`
    : today;

  const lines: string[] = [
    `## 21. Recent Updates (from t1)`,
    ``,
    `*Last synthesized: ${today} -- covering ${files.length} sessions from ${dateRange}*`,
    ``,
  ];

  for (const topic of topicOrder) {
    const bullets = topicBullets.get(topic) ?? [];
    if (bullets.length === 0) continue;
    lines.push(`### ${topic}`, ``);
    for (const b of bullets) {
      lines.push(b);
    }
    lines.push(``);
  }

  return lines.join('\n');
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
    console.log(`s1: Updated coverage counts -> ${fmt(counts.total)} active (${fmt(counts.az)} AZ + ${fmt(counts.ca)} CA)`);
  }

  // Remove ALL existing "## 21. Recent Updates" sections (may be duplicated from prior bugs)
  doc = doc.replace(/\n---\s*\n+## 21\. Recent Updates \(from t1\)[\s\S]*$/, '');

  // Append new synthesis at end
  doc = doc.trimEnd() + '\n\n---\n\n' + synthesis.trim() + '\n';

  writeFileSync(COMPREHENSIVE_PATH, doc, 'utf-8');
}

async function main() {
  const allFiles = getTakeawaysFiles();
  if (allFiles.length === 0) {
    console.log('No t1 takeaways files found in docs/takeaways/. Run "t1" on each AI first.');
    process.exit(0);
    return;
  }

  const recentFiles = filterByRetention(allFiles);
  console.log(`Found ${allFiles.length} total takeaways, ${recentFiles.length} within ${RETENTION_DAYS}-day retention window.`);

  if (recentFiles.length === 0) {
    console.log('No recent takeaways within retention window. Section 21 will be empty.');
    const today = new Date().toISOString().slice(0, 10);
    await updateComprehensive(`## 21. Recent Updates (from t1)\n\n*Last synthesized: ${today} -- no recent sessions*\n`);
  } else {
    console.log(`Synthesizing: ${recentFiles.join(', ')}`);
    const synthesis = synthesizeTakeaways(recentFiles);
    const lineCount = synthesis.split('\n').length;
    await updateComprehensive(synthesis);
    console.log(`Section 21: ${lineCount} lines from ${recentFiles.length} sessions (deduped, topic-grouped).`);
  }

  console.log(`Updated docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md.`);

  // Commit locally only -- do NOT push. Robert will batch pushes with pts.
  execSync('git add docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md', { stdio: 'inherit' });
  try {
    execSync('git commit -m "s1: synthesize Section 21 from takeaways"', { stdio: 'inherit' });
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
