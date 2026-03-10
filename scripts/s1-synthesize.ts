/**
 * s1 — Master Synthesis. Gathers all per-AI takeaways and updates COMPREHENSIVE_KNOWLEDGE_DOCUMENT.
 *
 * Usage: npm run s1
 *
 * 1. Reads all *TAKEAWAYS*.md in docs/takeaways/
 * 2. Consolidates them by date and AI source
 * 3. Updates docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md:
 *    - Sets "Last consolidated" to today
 *    - Adds/updates "## 21. Recent Updates (from t1)" with synthesized content
 *    - Preserves all other sections
 * 4. pts: commits and pushes updated COMPREHENSIVE to staging
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

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

function updateComprehensive(synthesis: string): void {
  let doc = readFileSync(COMPREHENSIVE_PATH, 'utf-8');
  const today = new Date().toISOString().slice(0, 10);

  // Update Last consolidated date
  doc = doc.replace(
    /\*\*Last consolidated:\*\* .+/,
    `**Last consolidated:** ${today}`
  );

  // Remove ALL existing "## 21. Recent Updates" sections (may be duplicated from prior bugs)
  doc = doc.replace(/\n---\s*\n+## 21\. Recent Updates \(from t1\)[\s\S]*$/, '');

  // Append new synthesis at end
  doc = doc.trimEnd() + '\n\n---\n\n' + synthesis.trim() + '\n';

  writeFileSync(COMPREHENSIVE_PATH, doc, 'utf-8');
}

function main() {
  const files = getTakeawaysFiles();
  if (files.length === 0) {
    console.log('No t1 takeaways files found in docs/takeaways/. Run "t1" on each AI first.');
    process.exit(0);
    return;
  }

  console.log(`Found ${files.length} takeaways: ${files.join(', ')}`);
  const synthesis = synthesizeTakeaways(files);
  updateComprehensive(synthesis);
  console.log(`Updated docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md with synthesis from ${files.length} AI(s).`);

  // pts: push to staging
  execSync('git add docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md', { stdio: 'inherit' });
  try {
    execSync('git commit -m "s1: update COMPREHENSIVE Section 21 from takeaways"', { stdio: 'inherit' });
    execSync('git push origin staging', { stdio: 'inherit' });
    console.log('pts: pushed to staging.');
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
