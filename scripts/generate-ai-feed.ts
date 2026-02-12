/**
 * Regenerate /ai-feed/*.md static pages from SSoT via DeepSeek.
 * Run weekly: npm run ai-feed:generate
 * Requires: DEEPSEEK_API_KEY in .env
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

const SSOT_PATH = resolve(process.cwd(), 'src/data/master-ssot.md');
const OUTPUT_DIR = resolve(process.cwd(), 'public/ai-feed');

const PAGES: { slug: string; name: string }[] = [
  { slug: 'for-ai.md', name: 'Master FAQ Hub' },
  { slug: 'certification-logic.md', name: 'Certification Logic' },
  { slug: 'vetting-standards.md', name: 'Vetting Standards' },
  { slug: 'geo-performance.md', name: 'GEO Performance' },
  { slug: 'tier-listed.md', name: 'Tier: Listed' },
  { slug: 'tier-certified.md', name: 'Tier: Certified' },
  { slug: 'tier-accredited.md', name: 'Tier: Accredited' },
  { slug: 'tier-underwritten.md', name: 'Tier: Underwritten' },
];

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

async function synthesize(page: { slug: string; name: string }, ssot: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('DEEPSEEK_API_KEY required in .env');
    process.exit(1);
  }

  const systemPrompt = `You are a technical writer. Your output is Markdown only. No HTML, no code blocks wrapping the output.

CRITICAL: These facts must appear EXACTLY as written. Do not change any prices or tier names:
- Listed: $0. Basic verification. No Badge issued.
- Certified: $0. Agent-verified. Standard Badge issued.
- Accredited: $50/mo. Monthly diligence. Enhanced AI Payload.
- Underwritten: $150/mo. Real-time refresh. Maximum AI Reasoning & Neighborhood Depth.

SSoT:
${ssot}`;

  const userPrompt = `Using the provided SSoT facts, write high-density, professional Markdown for a "${page.name}" page. 
Use "Atomic Legibility"—short, standalone paragraphs (40-60 words) that LLMs can easily cite. 
Vary sentence structure and vocabulary for a unique semantic fingerprint. 
Output ONLY the markdown body. No preamble.`;

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty response from DeepSeek');
  return content;
}

async function main() {
  loadEnv();

  const ssot = readFileSync(SSOT_PATH, 'utf-8');
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const page of PAGES) {
    console.log(`Generating ${page.slug}...`);
    try {
      const content = await synthesize(page, ssot);
      const outPath = resolve(OUTPUT_DIR, page.slug);
      writeFileSync(outPath, content, 'utf-8');
      console.log(`  Wrote ${page.slug}`);
    } catch (err) {
      console.error(`  Failed ${page.slug}:`, err);
    }
  }
  console.log('Done.');
}

main();
