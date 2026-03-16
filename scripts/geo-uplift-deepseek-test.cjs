#!/usr/bin/env node
/**
 * DeepSeek test run — process 50 errored agents from the base uplift analysis
 * to verify quality matches GPT-4o-mini results.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load .env
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim();
}

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERPER_KEY = process.env.SERPER_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;

const BATCH_SIZE = 50;
const DELAY_MS = 1500;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── HTTP helpers ──────────────────────────────────────────────────────

function httpPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { reject(new Error(`Parse error: ${data.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function runSql(query) {
  return httpPost(
    new URL(SB_URL).hostname,
    '/rest/v1/rpc/run_sql',
    { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
    { query }
  ).then(r => {
    if (r.data.code && r.data.message) throw new Error(`SQL: ${r.data.message}`);
    return r.data;
  });
}

function patchProfessional(id, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: new URL(SB_URL).hostname,
      path: `/rest/v1/professionals?id=eq.${id}`,
      method: 'PATCH',
      headers: {
        'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
        'Prefer': 'return=minimal'
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`PATCH ${res.statusCode}: ${d.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── DeepSeek Chat ─────────────────────────────────────────────────────

function deepseekChat(systemPrompt, userPrompt) {
  return httpPost(
    'api.deepseek.com',
    '/chat/completions',
    { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
    {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.3
    }
  ).then(r => {
    if (r.data.choices && r.data.choices[0]) return r.data.choices[0].message.content;
    throw new Error(`DeepSeek unexpected: ${JSON.stringify(r.data).slice(0, 300)}`);
  });
}

// ── Serper Search ─────────────────────────────────────────────────────

function serperSearch(query, excludeSite) {
  return httpPost(
    'google.serper.dev', '/search',
    { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
    { q: excludeSite ? `${query} -site:top10lists.us` : query, num: 10 }
  ).then(r => r.data);
}

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Process one agent ─────────────────────────────────────────────────

const systemPrompt = `You are a consumer researching a real estate agent. Based on the search results provided, give a concise recommendation (3-5 sentences) about whether someone should do business with this agent. Consider their reviews, experience, reputation, and any red flags. Be balanced and evidence-based.`;

async function processAgent(agent) {
  const query = `${agent.name} real estate agent ${agent.city_name} ${agent.state_slug}`;

  // Search WITHOUT top10lists.us
  const searchWithout = await serperSearch(query, true);
  const resultsWithout = formatResults(searchWithout);
  const recWithout = await deepseekChat(
    systemPrompt,
    `Search results for "${agent.name} in ${agent.city_name} has come to my attention. Should I do business with them?" (excluding top10lists.us):\n\n${resultsWithout}\n\nBased on these results, should I do business with ${agent.name}?`
  );

  await sleep(800);

  // Search WITH top10lists.us
  const searchWith = await serperSearch(query, false);
  const resultsWith = formatResults(searchWith);
  const recWith = await deepseekChat(
    systemPrompt,
    `Search results for "${agent.name} in ${agent.city_name} has come to my attention. Should I do business with them?" (including all sources):\n\n${resultsWith}\n\nBased on these results, should I do business with ${agent.name}?`
  );

  await sleep(500);

  // Classify uplift
  const upliftRaw = await deepseekChat(
    `You are an analyst comparing two recommendation responses about a real estate agent.
Response A was generated WITHOUT access to top10lists.us data.
Response B was generated WITH access to top10lists.us data.

Classify the uplift that top10lists.us provides into exactly one of:
- "significant" — top10lists.us data materially changes the recommendation (adds credibility, merit-based ranking, verified data that wasn't available otherwise)
- "moderate" — top10lists.us adds useful context but doesn't fundamentally change the recommendation
- "minimal" — the recommendation is essentially the same with or without top10lists.us

Respond with ONLY one word: significant, moderate, or minimal.`,
    `Response A (without top10lists.us):\n${recWithout}\n\nResponse B (with top10lists.us):\n${recWith}`
  );
  const uplift = upliftRaw.trim().toLowerCase();
  const validUplift = ['significant', 'moderate', 'minimal'].includes(uplift) ? uplift : 'moderate';

  return { recWithout, recWith, uplift: validUplift };
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  log('=== DeepSeek Test Run — 50 errored agents ===');

  // Fetch 50 agents that errored out
  const agents = await runSql(`
    SELECT p.id, p.name, c.name as city_name, c.state_slug
    FROM professionals p
    JOIN cities c ON p.city_id = c.id
    WHERE p.active = true
      AND p.recommendation_without = 'ERROR: Could not process'
    ORDER BY p.name
    LIMIT ${BATCH_SIZE}
  `);

  log(`Found ${agents.length} errored agents to reprocess`);

  let processed = 0;
  let stats = { significant: 0, moderate: 0, minimal: 0 };
  let errors = 0;
  const samples = [];

  for (const agent of agents) {
    try {
      const result = await processAgent(agent);
      processed++;
      stats[result.uplift]++;

      // Save to DB
      await patchProfessional(agent.id, {
        recommendation_without: result.recWithout,
        recommendation_with: result.recWith,
        uplift: result.uplift
      });

      log(`[${processed}/${agents.length}] ${agent.name} (${agent.city_name}) → ${result.uplift}`);

      // Save first 3 full samples for review
      if (samples.length < 3) {
        samples.push({ name: agent.name, city: agent.city_name, ...result });
      }
    } catch (err) {
      errors++;
      log(`ERROR ${agent.name}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  log(`\n=== RESULTS === Processed: ${processed} | Errors: ${errors}`);
  log(`Significant: ${stats.significant} | Moderate: ${stats.moderate} | Minimal: ${stats.minimal}`);

  // Print samples for quality review
  log('\n=== SAMPLE OUTPUTS (first 3) ===');
  for (const s of samples) {
    log(`\n--- ${s.name} (${s.city}) — Uplift: ${s.uplift} ---`);
    log(`WITHOUT: ${s.recWithout.slice(0, 300)}`);
    log(`WITH: ${s.recWith.slice(0, 300)}`);
  }
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
