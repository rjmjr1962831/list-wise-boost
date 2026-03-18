/**
 * s1 -- Master Synthesis. Uses DeepSeek to intelligently synthesize all
 * takeaways into a compact, deduplicated Section 21.
 *
 * Usage: npm run s1
 *
 * 1. Reads all *TAKEAWAYS*.md in docs/takeaways/
 * 2. Reads current Section 21 (if any) as context
 * 3. Sends everything to DeepSeek for intelligent synthesis
 * 4. Replaces Section 21 with the LLM output
 * 5. Updates "Last consolidated" date and live agent counts
 * 6. Copies to docs/prompts/claude-web-project-knowledge.md
 * 7. Commits locally (does NOT push -- Robert batches pushes with pts)
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

function getTakeawaysFiles(): string[] {
  if (!existsSync(TAKEAWAYS_DIR)) return [];
  return readdirSync(TAKEAWAYS_DIR)
    .filter((f) => TAKEAWAYS_GLOB.test(f))
    .sort();
}

function readAllTakeaways(files: string[]): string {
  const chunks: string[] = [];
  for (const f of files) {
    const content = readFileSync(resolve(TAKEAWAYS_DIR, f), 'utf-8');
    chunks.push(`--- FILE: ${f} ---\n${content.trim()}`);
  }
  return chunks.join('\n\n');
}

function splitComprehensive(doc: string): { sections1to20: string; section21: string } {
  const marker = /\n---\s*\n+## 21\. Recent Updates/;
  const match = doc.search(marker);
  if (match === -1) {
    return { sections1to20: doc, section21: '' };
  }
  return {
    sections1to20: doc.slice(0, match),
    section21: doc.slice(match).replace(/^\n---\s*\n+/, ''),
  };
}

async function synthesizeWithLLM(takeawaysText: string, currentSection21: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set in .env');

  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are a technical editor synthesizing software project session logs into a compact knowledge document section.

Rules:
- Group by TOPIC, not by session or date
- Remove all redundancy -- if the same fact appears in multiple sessions, keep one instance
- Drop anything superseded (e.g., "plan to do X" when a later session says X was done)
- Drop ephemeral session details (file lists, "what we did today" narratives)
- Keep ONLY: decisions made, things deployed/live, things deprecated/removed, current state of in-progress work, standing rules, config changes, new edge functions/scripts
- Use ### headers for topic groups (e.g., "### AIFS", "### Bot Crawl Analytics", "### GEO Audit")
- Use bullet points (- ) under each header
- Keep dates only where they matter (e.g., "reactivated 2026-03-12")
- No session headers like "CLAUDE -- 2026-03-14"
- Use -- instead of em dashes
- Target 150-250 lines total
- Start with exactly: ## 21. Recent Updates (from t1)\\n\\n*Last synthesized: ${today}*\\n\\n---`;

  const userPrompt = `Here are all the raw session takeaways to synthesize:

${takeawaysText}

${currentSection21 ? `Here is the current Section 21 for reference (may contain useful structure to preserve):\n\n${currentSection21}` : ''}

Produce the synthesized Section 21. Output ONLY the markdown content, starting with the ## 21 header.`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek returned empty response');

  const usage = data.usage;
  if (usage) {
    console.log(`s1: DeepSeek usage -- ${usage.prompt_tokens} prompt + ${usage.completion_tokens} completion = ${usage.total_tokens} total tokens`);
  }

  // Ensure it starts with the right header
  let result = content.trim();
  if (!result.startsWith('## 21.')) {
    result = `## 21. Recent Updates (from t1)\n\n*Last synthesized: ${today}*\n\n---\n\n${result}`;
  }

  return result;
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

  // 1. Read takeaways
  const files = getTakeawaysFiles();
  if (files.length === 0) {
    console.log('No t1 takeaways files found in docs/takeaways/. Run "t1" on each AI first.');
    process.exit(0);
    return;
  }
  console.log(`s1: Found ${files.length} takeaway files.`);
  const takeawaysText = readAllTakeaways(files);

  // 2. Read current doc and split
  let doc = readFileSync(COMPREHENSIVE_PATH, 'utf-8');
  const { sections1to20, section21 } = splitComprehensive(doc);

  // 3. Synthesize with LLM
  console.log('s1: Sending to DeepSeek for synthesis...');
  const synthesized = await synthesizeWithLLM(takeawaysText, section21);
  const lineCount = synthesized.split('\n').length;
  console.log(`s1: Synthesized Section 21: ${lineCount} lines.`);

  // 4. Reassemble document
  doc = sections1to20.trimEnd() + '\n\n---\n\n' + synthesized.trim() + '\n';

  // 5. Update metadata
  doc = doc.replace(
    /\*\*Last consolidated:\*\* .+/,
    `**Last consolidated:** ${today}`
  );

  const counts = await getLiveCounts();
  if (counts) {
    doc = doc.replace(
      /[\d,]+ active \([\d,]+ AZ \+ [\d,]+ CA\)/,
      `${fmt(counts.total)} active (${fmt(counts.az)} AZ + ${fmt(counts.ca)} CA)`
    );
    console.log(`s1: Updated coverage counts -> ${fmt(counts.total)} active (${fmt(counts.az)} AZ + ${fmt(counts.ca)} CA)`);
  }

  // 6. Write
  writeFileSync(COMPREHENSIVE_PATH, doc, 'utf-8');
  copyFileSync(COMPREHENSIVE_PATH, CLAUDE_WEB_PATH);
  console.log('s1: Updated COMPREHENSIVE + claude-web-project-knowledge.md');

  // 7. Commit locally
  execSync('git add docs/COMPREHENSIVE_KNOWLEDGE_DOCUMENT.md docs/prompts/claude-web-project-knowledge.md', { stdio: 'inherit' });
  const status = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim();
  if (status.length === 0) {
    console.log('No changes to commit; COMPREHENSIVE already up to date.');
  } else {
    execSync('git commit -m "s1: synthesize Section 21 via DeepSeek"', { stdio: 'inherit' });
    console.log('s1: committed locally. Run pts when ready to push.');
  }
}

main();
