#!/usr/bin/env node
/**
 * GEO Uplift Analysis Script
 *
 * For each active agent, runs two searches:
 *   1. WITHOUT top10lists.us results - "Should I do business with {name} in {city}?"
 *   2. WITH top10lists.us results - same query
 *
 * Stores recommendation_without, recommendation_with, and uplift (significant/moderate/minimal)
 * Resumable: skips agents that already have results.
 * Uses Supabase REST API (run_sql RPC) for all DB operations.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERPER_KEY = process.env.SERPER_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const BATCH_SIZE = 50;
const DELAY_MS = 2000;
const LOG_FILE = path.join(__dirname, 'geo-uplift-progress.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Supabase run_sql helper ─────────────────────────────────────────
function runSql(query) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SB_URL}/rest/v1/rpc/run_sql`);
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.code && parsed.message) {
            reject(new Error(`SQL error: ${parsed.message}`));
          } else {
            resolve(parsed);
          }
        } catch (e) { reject(new Error(`SQL parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Escape SQL string ───────────────────────────────────────────────
function esc(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// ── PostgREST PATCH helper (for UPDATEs) ────────────────────────────
function patchProfessional(id, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: new URL(SB_URL).hostname,
      path: `/rest/v1/professionals?id=eq.${id}`,
      method: 'PATCH',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Prefer': 'return=minimal'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`PATCH failed (${res.statusCode}): ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Verify columns exist ────────────────────────────────────────────
async function verifyColumns() {
  const check = await runSql(
    "SELECT column_name FROM information_schema.columns WHERE table_name='professionals' AND column_name IN ('recommendation_without','recommendation_with','uplift')"
  );
  const existing = check.map(r => r.column_name);
  const missing = ['recommendation_without', 'recommendation_with', 'uplift'].filter(c => !existing.includes(c));
  if (missing.length > 0) {
    throw new Error(`Missing columns: ${missing.join(', ')}. Deploy run-migration edge function first.`);
  }
  log('All columns verified');
}

// ── Fetch next batch of unprocessed agents ──────────────────────────
async function fetchBatch() {
  return await runSql(`
    SELECT p.id, p.name, c.name as city_name, c.state_slug
    FROM professionals p
    JOIN cities c ON p.city_id = c.id
    WHERE p.active = true
      AND (p.recommendation_without IS NULL OR p.recommendation_with IS NULL OR p.uplift IS NULL)
    ORDER BY p.name
    LIMIT ${BATCH_SIZE}
  `);
}

// ── Serper Google Search ────────────────────────────────────────────
function serperSearch(query, excludeSite) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      q: excludeSite ? `${query} -site:top10lists.us` : query,
      num: 10
    });
    const req = https.request({
      hostname: 'google.serper.dev',
      path: '/search',
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Serper parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── OpenAI Chat Completion ──────────────────────────────────────────
function openaiChat(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    });
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0]) {
            resolve(parsed.choices[0].message.content);
          } else {
            reject(new Error(`OpenAI unexpected: ${data.slice(0, 300)}`));
          }
        } catch (e) { reject(new Error(`OpenAI parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Format search results for the AI prompt ─────────────────────────
function formatResults(serperData) {
  const parts = [];
  if (serperData.knowledgeGraph) {
    const kg = serperData.knowledgeGraph;
    parts.push(`Knowledge Graph: ${kg.title || ''} - ${kg.description || ''}`);
  }
  if (serperData.organic) {
    for (const r of serperData.organic.slice(0, 8)) {
      parts.push(`[${r.title}](${r.link})\n${r.snippet || ''}`);
    }
  }
  if (serperData.peopleAlsoAsk) {
    for (const q of serperData.peopleAlsoAsk.slice(0, 3)) {
      parts.push(`Q: ${q.question}\nA: ${q.snippet || ''}`);
    }
  }
  return parts.join('\n\n') || 'No relevant search results found.';
}

// ── Classify uplift ─────────────────────────────────────────────────
function classifyUplift(without, withRes) {
  return openaiChat(
    `You are an analyst comparing two recommendation responses about a real estate agent.
Response A was generated WITHOUT access to top10lists.us data.
Response B was generated WITH access to top10lists.us data.

Classify the uplift that top10lists.us provides into exactly one of:
- "significant" — top10lists.us data materially changes the recommendation (adds credibility, merit-based ranking, verified data that wasn't available otherwise)
- "moderate" — top10lists.us adds useful context but doesn't fundamentally change the recommendation
- "minimal" — the recommendation is essentially the same with or without top10lists.us

Respond with ONLY one word: significant, moderate, or minimal.`,
    `Response A (without top10lists.us):\n${without}\n\nResponse B (with top10lists.us):\n${withRes}`
  );
}

// ── Process one agent ───────────────────────────────────────────────
async function processAgent(agent) {
  const query = `${agent.name} real estate agent ${agent.city_name} ${agent.state_slug}`;

  const systemPrompt = `You are a consumer researching a real estate agent. Based on the search results provided, give a concise recommendation (3-5 sentences) about whether someone should do business with this agent. Consider their reviews, experience, reputation, and any red flags. Be balanced and evidence-based.`;

  // Search 1: WITHOUT top10lists.us
  const searchWithout = await serperSearch(query, true);
  const resultsWithout = formatResults(searchWithout);
  const recWithout = await openaiChat(
    systemPrompt,
    `Search results for "${agent.name} in ${agent.city_name} has come to my attention. Should I do business with them?" (excluding top10lists.us):\n\n${resultsWithout}\n\nBased on these results, should I do business with ${agent.name}?`
  );

  await sleep(1000);

  // Search 2: WITH top10lists.us
  const searchWith = await serperSearch(query, false);
  const resultsWith = formatResults(searchWith);
  const recWith = await openaiChat(
    systemPrompt,
    `Search results for "${agent.name} in ${agent.city_name} has come to my attention. Should I do business with them?" (including all sources):\n\n${resultsWith}\n\nBased on these results, should I do business with ${agent.name}?`
  );

  await sleep(500);

  // Classify uplift
  const upliftRaw = await classifyUplift(recWithout, recWith);
  const uplift = upliftRaw.trim().toLowerCase();
  const validUplift = ['significant', 'moderate', 'minimal'].includes(uplift) ? uplift : 'moderate';

  // Store results via PostgREST PATCH
  await patchProfessional(agent.id, {
    recommendation_without: recWithout,
    recommendation_with: recWith,
    uplift: validUplift
  });

  return validUplift;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main loop ───────────────────────────────────────────────────────
async function main() {
  log('=== GEO Uplift Analysis Starting ===');

  await verifyColumns();

  // Count remaining
  const countRes = await runSql(`
    SELECT count(*) as cnt FROM professionals
    WHERE active = true
      AND (recommendation_without IS NULL OR recommendation_with IS NULL OR uplift IS NULL)
  `);
  const total = parseInt(countRes[0].cnt);
  log(`${total} agents remaining to process`);

  let processed = 0;
  let stats = { significant: 0, moderate: 0, minimal: 0 };
  let errors = 0;
  let consecutiveErrors = 0;

  while (true) {
    const batch = await fetchBatch();
    if (batch.length === 0) {
      log('All agents processed!');
      break;
    }

    for (const agent of batch) {
      try {
        const uplift = await processAgent(agent);
        processed++;
        stats[uplift]++;
        consecutiveErrors = 0;
        log(`[${processed}/${total}] ${agent.name} (${agent.city_name}) → ${uplift}`);
      } catch (err) {
        errors++;
        consecutiveErrors++;
        log(`ERROR processing ${agent.name}: ${err.message}`);

        if (consecutiveErrors >= 10) {
          log('10 consecutive errors — waiting 60s before retry...');
          await sleep(60000);
          consecutiveErrors = 0;
        }

        if (consecutiveErrors >= 3) {
          try {
            await patchProfessional(agent.id, {
              recommendation_without: 'ERROR: Could not process',
              recommendation_with: 'ERROR: Could not process',
              uplift: 'minimal'
            });
            log(`Marked ${agent.name} as error/skipped`);
          } catch (e2) {
            log(`Failed to mark error for ${agent.name}: ${e2.message}`);
          }
        }
      }

      await sleep(DELAY_MS);
    }
  }

  log(`=== COMPLETE === Processed: ${processed} | Errors: ${errors}`);
  log(`Significant: ${stats.significant} | Moderate: ${stats.moderate} | Minimal: ${stats.minimal}`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
