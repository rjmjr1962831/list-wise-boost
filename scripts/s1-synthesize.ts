/**
 * s1 -- Update COMPREHENSIVE_KNOWLEDGE_DOCUMENT metadata and Section 21.
 *
 * Usage: npm run s1
 *
 * What it does:
 * 1. Updates "Last consolidated" date
 * 2. Updates live agent counts from Supabase (Section 1 coverage line)
 * 3. Appends NEW takeaways (since last synthesis) to Section 21
 *    - Only includes files newer than the "Last synthesized" date in Section 21
 *    - Groups by the 5 t1 template sections, deduplicates by content
 *    - Preserves any hand-curated content already in Section 21
 * 4. Copies updated COMPREHENSIVE to docs/prompts/claude-web-project-knowledge.md
 * 5. Commits locally (does NOT push -- Robert batches pushes with pts)
 *
 * IMPORTANT: Section 21 should be periodically hand-curated to stay compact.
 * This script only appends incremental updates. Run a manual synthesis when
 * Section 21 exceeds ~300 lines.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from 'fs';
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
const CLAUDE_WEB_PATH = resolve(process.cwd(), 'docs/prompts/claude-web-project-knowledge.md');
const TAKEAWAYS_GLOB = /^[A-Z_]+_TAKEAWAYS_\d{4}-\d{2}-\d{2}(_\d{4})?\.md$/;

// t1 template section headers -> canonical names
const SECTION_NAMES = [
  'Key Outcomes',
  'Config / Infrastructure',
  'New Rules or Docs',
  'New Functions / Scripts',
  'Deprecated or Removed',
];

function classifyHeading(heading: string): string | null {
  const lower = heading.toLowerCase();
  if (lower.includes('key outcomes')) return 'Key Outcomes';
  if (lower.includes('config') && lower.includes('infrastructure')) return 'Config / Infrastructure';
  if (lower.includes('new rules') || lower.includes('new docs')) return 'New Rules or Docs';
  if (lower.includes('new functions') || lower.includes('new scripts')) return 'New Functions / Scripts';
  if (lower.includes('deprecated') || lower.includes('removed')) return 'Deprecated or Removed';
  return null;
}

function getLastSynthesizedDate(): string | null {
  if (!existsSync(COMPREHENSIVE_PATH)) return null;
  const doc = readFileSync(COMPREHENSIVE_PATH, 'utf-8');
  const match = doc.match(/\*Last synthesized: (\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function getNewTakeawaysFiles(sinceDate: string | null): string[] {
  if (!existsSync(TAKEAWAYS_DIR)) return [];
  const files = readdirSync(TAKEAWAYS_DIR)
    .filter((f) => TAKEAWAYS_GLOB.test(f))
    .sort();

  if (!sinceDate) return files;

  return files.filter((f) => {
    const dateMatch = f.match(/(\d{4}-\d{2}-\d{2})/);
    return dateMatch ? dateMatch[1] > sinceDate : false;
  });
}

interface SectionBullets {
  section: string;
  bullets: string[];
}

function parseTakeawaysFile(filePath: string): SectionBullets[] {
  const content = readFileSync(filePath, 'utf-8');
  const result: SectionBullets[] = [];
  let currentSection = 'Key Outcomes';
  let currentBullets: string[] = [];

  for (const line of content.split('\n')) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      const heading = headingMatch[1];
      if (heading.toLowerCase().includes('takeaways')) continue;
      const classified = classifyHeading(heading);
      if (classified && classified !== currentSection) {
        if (currentBullets.length > 0) {
          result.push({ section: currentSection, bullets: [...currentBullets] });
          currentBullets = [];
        }
        currentSection = classified;
      }
      continue;
    }

    if (/^\s*[-*]\s+/.test(line) && line.trim().length > 10) {
      currentBullets.push(line.trim());
    }
  }

  if (currentBullets.length > 0) {
    result.push({ section: currentSection, bullets: currentBullets });
  }

  return result;
}

function buildIncrementalSection(files: string[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const sectionBullets = new Map<string, string[]>();
  const seen = new Set<string>();

  for (const name of SECTION_NAMES) {
    sectionBullets.set(name, []);
  }

  // Process newest first to keep latest phrasing
  const sortedFiles = [...files].reverse();
  for (const f of sortedFiles) {
    const parsed = parseTakeawaysFile(resolve(TAKEAWAYS_DIR, f));
    for (const { section, bullets } of parsed) {
      const bucket = sectionBullets.get(section) ?? sectionBullets.get('Key Outcomes')!;
      for (const bullet of bullets) {
        const normalized = bullet.replace(/^[-*]\s+/, '').trim().toLowerCase().slice(0, 60);
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        bucket.push(bullet);
      }
    }
  }

  // Only emit sections that have content
  const lines: string[] = [
    ``,
    `### Incremental Updates (${today})`,
    ``,
    `*${files.length} sessions since last synthesis*`,
    ``,
  ];

  let hasContent = false;
  for (const name of SECTION_NAMES) {
    const bullets = sectionBullets.get(name) ?? [];
    if (bullets.length === 0) continue;
    hasContent = true;
    lines.push(`#### ${name}`, ``);
    for (const b of bullets) {
      lines.push(b);
    }
    lines.push(``);
  }

  return hasContent ? lines.join('\n') : '';
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

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  let doc = readFileSync(COMPREHENSIVE_PATH, 'utf-8');

  // 1. Update Last consolidated date
  doc = doc.replace(
    /\*\*Last consolidated:\*\* .+/,
    `**Last consolidated:** ${today}`
  );

  // 2. Update live agent counts
  const counts = await getLiveCounts();
  if (counts) {
    doc = doc.replace(
      /[\d,]+ active \([\d,]+ AZ \+ [\d,]+ CA\)/,
      `${fmt(counts.total)} active (${fmt(counts.az)} AZ + ${fmt(counts.ca)} CA)`
    );
    console.log(`s1: Updated coverage counts -> ${fmt(counts.total)} active (${fmt(counts.az)} AZ + ${fmt(counts.ca)} CA)`);
  }

  // 3. Find new takeaways since last synthesis
  const lastSynth = getLastSynthesizedDate();
  const newFiles = getNewTakeawaysFiles(lastSynth);
  console.log(`s1: Last synthesized: ${lastSynth ?? 'never'}. Found ${newFiles.length} new takeaway files.`);

  if (newFiles.length > 0) {
    const incremental = buildIncrementalSection(newFiles);
    if (incremental) {
      // Append incremental section before the final newline
      doc = doc.trimEnd() + '\n' + incremental + '\n';
      console.log(`s1: Appended incremental updates from ${newFiles.length} sessions.`);
    } else {
      console.log('s1: New takeaways had no unique bullets to add.');
    }
  } else {
    console.log('s1: No new takeaways since last synthesis. Only updated date and counts.');
  }

  // Check Section 21 size and warn if manual synthesis needed
  const section21Match = doc.match(/## 21\. Recent Updates[\s\S]*$/);
  if (section21Match) {
    const s21Lines = section21Match[0].split('\n').length;
    if (s21Lines > 300) {
      console.warn(`\n⚠️  Section 21 is ${s21Lines} lines. Consider a manual synthesis to keep it under 300 lines.`);
    }
  }

  // 4. Write updated COMPREHENSIVE
  writeFileSync(COMPREHENSIVE_PATH, doc, 'utf-8');

  // 5. Copy to claude-web-project-knowledge.md
  copyFileSync(COMPREHENSIVE_PATH, CLAUDE_WEB_PATH);
  console.log('s1: Copied to docs/prompts/claude-web-project-knowledge.md');

  // 6. Commit locally -- do NOT push
  execSync('git add docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md docs/prompts/claude-web-project-knowledge.md', { stdio: 'inherit' });
  // Check if there are staged changes before trying to commit
  const status = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim();
  if (status.length === 0) {
    console.log('No changes to commit; COMPREHENSIVE already up to date.');
  } else {
    execSync('git commit -m "s1: update COMPREHENSIVE metadata and Section 21"', { stdio: 'inherit' });
    console.log('s1: committed locally. Run pts when ready to push.');
  }
}

main();
