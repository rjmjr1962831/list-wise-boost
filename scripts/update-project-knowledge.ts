/**
 * Update project knowledge from GitHub and merge session takeaways.
 *
 * 1. Optionally runs npm run takeaways:sync to pull from daily_takeaways (--sync)
 * 2. Reads takeaways from docs/cursor-daily-updates.md if present
 * 3. Fetches latest PROJECT-KNOWLEDGE.md from GitHub
 * 4. Merges takeaways (from docs, --takeaways, or SESSION_TAKEAWAYS)
 * 5. Writes to docs/PROJECT-KNOWLEDGE.md
 *
 * Run: npm run update
 *      npm run update -- --takeaways "Pipedrive removed from admin"
 *      npm run update -- --sync  (run takeaways:sync first)
 */
import fs from 'fs';
import path from 'path';

const KNOWLEDGE_URL =
  'https://raw.githubusercontent.com/rjmjr1962831/list-wise-boost/main/docs/PROJECT-KNOWLEDGE.md';
const OUTPUT_PATH = 'docs/PROJECT-KNOWLEDGE.md';
const TAKEAWAYS_FILE = 'docs/cursor-daily-updates.md';

// Edit this with session takeaways before running, or pass via --takeaways
const SESSION_TAKEAWAYS: string[] = [];

function loadTakeawaysFromDocs(): string[] {
  const filePath = path.resolve(process.cwd(), TAKEAWAYS_FILE);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const takeaways: string[] = [];
  const parts = content.split(/^## (\d{4}-\d{2}-\d{2})\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const date = parts[i];
    const section = (parts[i + 1] || '').trim();
    const firstLine = section.split('\n').find((l: string) => l.trim().startsWith('-') || l.trim().startsWith('*'));
    const summary = firstLine?.trim().replace(/^[-*]\s*/, '').slice(0, 80) || section.slice(0, 80).replace(/\n/g, ' ');
    if (summary && summary !== '(Empty)') takeaways.push(`[${date}] ${summary}`);
  }
  return takeaways.slice(0, 5);
}

async function fetchLatest(): Promise<string> {
  const res = await fetch(KNOWLEDGE_URL);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

function parseVersion(doc: string): { version: string; date: string } {
  const match = doc.match(/\*Version (\d+\.\d+).*?(\d{4}-\d{2}-\d{2})\*/);
  return {
    version: match?.[1] ?? '0.0',
    date: match?.[2] ?? new Date().toISOString().slice(0, 10),
  };
}

function incrementVersion(version: string): string {
  const [major, minor] = version.split('.').map(Number);
  return `${major}.${minor + 1}`;
}

function mergeTakeaways(doc: string, takeaways: string[]): string {
  if (takeaways.length === 0) return doc;

  const today = new Date().toISOString().slice(0, 10);
  const { version } = parseVersion(doc);
  const newVersion = incrementVersion(version);

  const updatesBlock = takeaways.map((t) => `- ${t}`).join('\n');

  // Replace version line and append to Updated line
  let updated = doc.replace(
    /\*Version \d+\.\d+.*?\n\*Updated:.*?\*/s,
    `*Version ${newVersion} - ${today}*\n*Updated: ${takeaways[0]}${takeaways.length > 1 ? `, +${takeaways.length - 1} more` : ''}*`
  );

  return updated;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--sync')) {
    console.log('Running takeaways:sync...');
    const { execSync } = await import('node:child_process');
    try {
      execSync('npm run takeaways:sync', { stdio: 'inherit' });
    } catch {
      console.warn('takeaways:sync failed (e.g. SUPABASE_SERVICE_ROLE_KEY). Continuing with existing docs.');
    }
  }

  const takeawaysIdx = args.indexOf('--takeaways');
  let takeaways: string[] =
    takeawaysIdx >= 0 && args[takeawaysIdx + 1]
      ? [args.slice(takeawaysIdx + 1).join(' ')]
      : SESSION_TAKEAWAYS;

  const fromDocs = loadTakeawaysFromDocs();
  if (fromDocs.length > 0) {
    console.log('Takeaways from docs/cursor-daily-updates.md:', fromDocs.length);
    takeaways = [...fromDocs, ...takeaways];
  }

  console.log('Fetching latest from GitHub...');
  let doc = await fetchLatest();

  if (takeaways.length > 0) {
    console.log('Merging takeaways:', takeaways);
    doc = mergeTakeaways(doc, takeaways);
  } else {
    console.log('No takeaways to merge. Writing fetched version as-is.');
  }

  const outPath = path.resolve(process.cwd(), OUTPUT_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, doc, 'utf-8');

  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
