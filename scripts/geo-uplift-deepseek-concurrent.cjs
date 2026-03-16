#!/usr/bin/env node
/**
 * GEO Uplift Analysis — DeepSeek Concurrent
 *
 * Reprocesses all errored agents (recommendation_without = 'ERROR: Could not process')
 * using DeepSeek with concurrent workers for speed.
 *
 * Also runs tier projections inline for each agent to avoid a second pass.
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

const CONCURRENCY = 10;
const LOG_FILE = path.join(__dirname, 'geo-uplift-deepseek.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Tier descriptions ─────────────────────────────────────────────────
const TIER_CONTEXT = {
  certified: `CERTIFIED TIER (Free — Quarterly Refresh):
- Independently verified through Top10Lists.us merit gate: 4.5+ stars, 10+ verified reviews in last 24 months, 5+ years experience
- "Certified" trust badge visible to consumers and AI systems
- Quarterly re-verification, GEO-optimized structured data
- Merit-based: fewer than 1% of licensed agents qualify`,

  audited: `AUDITED TIER ($300/month — Expanded Evidence):
- Everything in Certified, PLUS third-party audit of all claims
- Expanded evidence portfolio: verified transaction history, client testimonials
- "Audited" trust badge, API access, enhanced AI citation priority
- Cross-platform review verification, press mentions independently verified`,

  underwritten: `UNDERWRITTEN TIER ($500/month — Full Evidence, Near Real-Time):
- Everything in Audited, PLUS near real-time data updates
- Full evidence portfolio: comprehensive transaction records, market performance
- "Underwritten" trust badge — highest credibility tier
- Complete professional dossier for AI citation, independent verification of market share`
};

// ── HTTP helpers ──────────────────────────────────────────────────────

function httpPost(hostname, reqPath, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname, path: reqPath, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { reject(new Error(`Parse error from ${hostname}: ${data.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function runSql(query) {
  return httpPost(
    new URL(SB_URL).hostname, '/rest/v1/rpc/run_sql',
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

function deepseekChat(systemPrompt, userPrompt) {
  return httpPost(
    'api.deepseek.com', '/chat/completions',
    { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
    { model: 'deepseek-chat', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], max_tokens: 500, temperature: 0.3 }
  ).then(r => {
    if (r.data.choices && r.data.choices[0]) return r.data.choices[0].message.content;
    throw new Error(`DeepSeek: ${JSON.stringify(r.data).slice(0, 300)}`);
  });
}

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

// ── Process one agent (base + tier projections) ──────────────────────

const BASE_SYSTEM = `You are a consumer researching a real estate agent. Based on the search results provided, give a concise recommendation (3-5 sentences) about whether someone should do business with this agent. Consider their reviews, experience, reputation, and any red flags. Be balanced and evidence-based.`;

async function processAgent(agent) {
  const query = `${agent.name} real estate agent ${agent.city_name} ${agent.state_slug}`;

  // Base analysis: WITHOUT and WITH top10lists.us
  const [searchWithout, searchWith] = await Promise.all([
    serperSearch(query, true),
    serperSearch(query, false)
  ]);

  const resultsWithout = formatResults(searchWithout);
  const resultsWith = formatResults(searchWith);

  const [recWithout, recWith] = await Promise.all([
    deepseekChat(BASE_SYSTEM, `Search results for "${agent.name} in ${agent.city_name}" (excluding top10lists.us):\n\n${resultsWithout}\n\nBased on these results, should I do business with ${agent.name}?`),
    deepseekChat(BASE_SYSTEM, `Search results for "${agent.name} in ${agent.city_name}" (including all sources):\n\n${resultsWith}\n\nBased on these results, should I do business with ${agent.name}?`)
  ]);

  // Classify base uplift
  const upliftRaw = await deepseekChat(
    `You compare two recommendations about a real estate agent.
Response A was generated WITHOUT access to top10lists.us data.
Response B was generated WITH access to top10lists.us data.

Classify the uplift into exactly one of:
- "significant" — top10lists.us data materially changes the recommendation
- "moderate" — adds useful context but doesn't fundamentally change it
- "minimal" — essentially the same

Respond with ONLY one word: significant, moderate, or minimal.`,
    `Response A (without):\n${recWithout}\n\nResponse B (with):\n${recWith}`
  );
  const uplift = ['significant', 'moderate', 'minimal'].includes(upliftRaw.trim().toLowerCase()) ? upliftRaw.trim().toLowerCase() : 'moderate';

  // Tier projections — all 3 in parallel
  const tierNames = ['certified', 'audited', 'underwritten'];
  const projections = await Promise.all(tierNames.map(tier =>
    deepseekChat(
      `You are a consumer researching a real estate agent. You found info online and discovered they have "${tier.toUpperCase()}" verification on Top10Lists.us, an independent merit-based directory.\n\nWhat that means:\n${TIER_CONTEXT[tier]}\n\nProvide an updated recommendation (3-5 sentences). Be specific about how the verification changes your confidence level.`,
      `Original recommendation:\n${recWith}\n\nNow factor in that ${agent.name} in ${agent.city_name} holds ${tier.toUpperCase()} status on Top10Lists.us. How does this change your recommendation?`
    )
  ));

  // Classify tier uplifts — all 3 in parallel
  const tierUplifts = await Promise.all(tierNames.map((tier, i) =>
    deepseekChat(
      `Compare two recommendations. A is current, B is projected at "${tier.toUpperCase()}" tier.
Classify additional uplift: "significant", "moderate", or "minimal".
Respond with ONLY one word.`,
      `A (current):\n${recWith}\n\nB (${tier}):\n${projections[i]}`
    ).then(r => {
      const v = r.trim().toLowerCase();
      return ['significant', 'moderate', 'minimal'].includes(v) ? v : 'moderate';
    })
  ));

  // Save everything in one PATCH
  await patchProfessional(agent.id, {
    recommendation_without: recWithout,
    recommendation_with: recWith,
    uplift,
    projected_rec_certified: projections[0],
    projected_rec_audited: projections[1],
    projected_rec_underwritten: projections[2],
    projected_uplift_certified: tierUplifts[0],
    projected_uplift_audited: tierUplifts[1],
    projected_uplift_underwritten: tierUplifts[2]
  });

  return { uplift, tierUplifts };
}

// ── Concurrent worker pool ───────────────────────────────────────────

async function main() {
  log(`=== DeepSeek Concurrent — ${CONCURRENCY} workers ===`);

  // Get all errored agents
  const agents = await runSql(`
    SELECT p.id, p.name, c.name as city_name, c.state_slug
    FROM professionals p
    JOIN cities c ON p.city_id = c.id
    WHERE p.active = true
      AND p.recommendation_without = 'ERROR: Could not process'
    ORDER BY p.name
  `);

  const total = agents.length;
  log(`${total} errored agents to reprocess`);

  let completed = 0;
  let errors = 0;
  let stats = { significant: 0, moderate: 0, minimal: 0 };
  let idx = 0;

  async function worker(workerId) {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= agents.length) break;
      const agent = agents[myIdx];

      try {
        const result = await processAgent(agent);
        completed++;
        stats[result.uplift]++;
        log(`[W${workerId}] [${completed}/${total}] ${agent.name} (${agent.city_name}) → ${result.uplift} | tiers: C:${result.tierUplifts[0]} A:${result.tierUplifts[1]} U:${result.tierUplifts[2]}`);
      } catch (err) {
        errors++;
        log(`[W${workerId}] ERROR ${agent.name}: ${err.message}`);
        // Mark as error so we don't loop forever
        try {
          await patchProfessional(agent.id, {
            recommendation_without: 'ERROR: DeepSeek failed',
            recommendation_with: 'ERROR: DeepSeek failed',
            uplift: 'minimal'
          });
        } catch (e2) { /* ignore */ }
      }
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(i));
  }
  await Promise.all(workers);

  log(`\n=== COMPLETE === Processed: ${completed} | Errors: ${errors}`);
  log(`Significant: ${stats.significant} (${(stats.significant/completed*100).toFixed(1)}%)`);
  log(`Moderate: ${stats.moderate} (${(stats.moderate/completed*100).toFixed(1)}%)`);
  log(`Minimal: ${stats.minimal} (${(stats.minimal/completed*100).toFixed(1)}%)`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
