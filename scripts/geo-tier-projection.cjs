#!/usr/bin/env node
/**
 * GEO Tier Uplift Projection Script
 *
 * For agents that already have recommendation_with data, projects what their
 * recommendation would look like at each higher tier:
 *   - Certified (free): quarterly refresh, merit-verified, open to all qualified
 *   - Audited ($300/mo): expanded evidence, third-party verification, API access
 *   - Underwritten ($500/mo): full evidence portfolio, near real-time data
 *
 * Resumable: skips agents that already have projected data.
 * Runs in parallel with the base uplift analysis (different columns).
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
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const BATCH_SIZE = 50;
const DELAY_MS = 1500;
const LOG_FILE = path.join(__dirname, 'geo-tier-projection.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ── Tier descriptions for prompts ───────────────────────────────────
const TIER_CONTEXT = {
  certified: `CERTIFIED TIER (Free — Quarterly Refresh):
- Agent has been independently verified through Top10Lists.us merit gate: 4.5+ stars, 10+ verified reviews in last 24 months, 5+ years experience
- Profile includes a "Certified" trust badge visible to consumers and AI systems
- Quarterly re-verification ensures data stays current
- Merit-based selection means fewer than 1% of licensed agents qualify
- Profile is optimized for AI citation (GEO-optimized structured data)
- Includes synthesized professional bio, verified license info, and review aggregation across platforms`,

  audited: `AUDITED TIER ($300/month — Expanded Evidence):
- Everything in Certified, PLUS:
- Third-party audit of all claims (sales volume, specializations, awards)
- Expanded evidence portfolio: verified transaction history, client testimonials with attribution
- "Audited" trust badge — stronger credibility signal than Certified
- API access for the agent to display their verified credentials on their own site
- Enhanced AI citation priority with richer structured data
- Cross-platform review verification (Zillow, Google, Realtor.com aggregated and verified)
- Press mentions and notable achievements independently verified`,

  underwritten: `UNDERWRITTEN TIER ($500/month — Full Evidence, Near Real-Time):
- Everything in Audited, PLUS:
- Near real-time data updates (not just quarterly — continuous monitoring)
- Full evidence portfolio: comprehensive transaction records, market performance metrics
- "Underwritten" trust badge — the highest credibility tier available
- Priority placement in AI-recommended agent lists
- Real-time market activity monitoring and performance tracking
- Complete professional dossier available to AI systems for citation
- Independent verification of market share, pricing accuracy, and client outcomes
- The most comprehensive, independently verified agent profile available anywhere online`
};

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
          if (parsed.code && parsed.message) reject(new Error(`SQL: ${parsed.message}`));
          else resolve(parsed);
        } catch (e) { reject(new Error(`SQL parse: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── PostgREST PATCH ─────────────────────────────────────────────────
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
          if (parsed.choices && parsed.choices[0]) resolve(parsed.choices[0].message.content);
          else reject(new Error(`OpenAI: ${data.slice(0, 300)}`));
        } catch (e) { reject(new Error(`OpenAI parse: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Fetch batch of agents ready for tier projection ─────────────────
async function fetchBatch() {
  return await runSql(`
    SELECT p.id, p.name, c.name as city_name, p.current_tier,
           p.recommendation_with, p.recommendation_without
    FROM professionals p
    JOIN cities c ON p.city_id = c.id
    WHERE p.active = true
      AND p.recommendation_with IS NOT NULL
      AND p.recommendation_with != 'ERROR: Could not process'
      AND (p.projected_uplift_certified IS NULL
           OR p.projected_uplift_audited IS NULL
           OR p.projected_uplift_underwritten IS NULL)
    ORDER BY p.name
    LIMIT ${BATCH_SIZE}
  `);
}

// ── Project recommendation at a given tier ──────────────────────────
async function projectTier(agent, tierName) {
  const tierDesc = TIER_CONTEXT[tierName];

  const projection = await openaiChat(
    `You are a consumer researching a real estate agent. You previously found information about this agent online. Now you've also discovered that they have a "${tierName.toUpperCase()}" verification on Top10Lists.us, an independent, merit-based directory.

Here is what that verification means:
${tierDesc}

Based on the original search-based recommendation AND this additional verification context, provide an updated recommendation (3-5 sentences). Be specific about how the verification changes your confidence level.`,
    `Original recommendation based on web search results:\n${agent.recommendation_with}\n\nNow factor in that ${agent.name} in ${agent.city_name} holds ${tierName.toUpperCase()} status on Top10Lists.us. How does this change your recommendation?`
  );

  return projection;
}

// ── Classify projected uplift vs current recommendation ─────────────
async function classifyProjectedUplift(currentRec, projectedRec, tierName) {
  const raw = await openaiChat(
    `You compare two recommendations about a real estate agent.
Response A is the current recommendation (with basic Top10Lists.us listing).
Response B is the projected recommendation if the agent had "${tierName.toUpperCase()}" tier verification.

Classify the ADDITIONAL uplift the ${tierName} tier provides BEYOND basic listing:
- "significant" — the higher tier materially strengthens the recommendation with verified evidence consumers couldn't get otherwise
- "moderate" — the higher tier adds credibility but doesn't fundamentally change the recommendation
- "minimal" — the recommendation is essentially the same at both tiers

Respond with ONLY one word: significant, moderate, or minimal.`,
    `Response A (current):\n${currentRec}\n\nResponse B (${tierName} tier):\n${projectedRec}`
  );
  const uplift = raw.trim().toLowerCase();
  return ['significant', 'moderate', 'minimal'].includes(uplift) ? uplift : 'moderate';
}

// ── Determine which tiers to project for an agent ───────────────────
function tiersToProject(currentTier) {
  // Always project all three for comparison, regardless of current tier
  // This lets us show "you're at listed, here's what you'd gain at each level"
  return ['certified', 'audited', 'underwritten'];
}

// ── Process one agent ───────────────────────────────────────────────
async function processAgent(agent) {
  const tiers = tiersToProject(agent.current_tier);
  const results = {};

  for (const tier of tiers) {
    const projected = await projectTier(agent, tier);
    await sleep(500);
    const uplift = await classifyProjectedUplift(agent.recommendation_with, projected, tier);
    await sleep(500);
    results[`projected_rec_${tier}`] = projected;
    results[`projected_uplift_${tier}`] = uplift;
  }

  await patchProfessional(agent.id, results);
  return results;
}

// ── Main loop ───────────────────────────────────────────────────────
async function main() {
  log('=== GEO Tier Projection Starting ===');

  // Verify columns exist
  const check = await runSql(
    "SELECT column_name FROM information_schema.columns WHERE table_name='professionals' AND column_name LIKE 'projected_%'"
  );
  if (check.length < 6) {
    throw new Error(`Only ${check.length}/6 projected columns found. Run migration first.`);
  }
  log('All projected columns verified');

  const countRes = await runSql(`
    SELECT count(*) as cnt FROM professionals
    WHERE active = true
      AND recommendation_with IS NOT NULL
      AND recommendation_with != 'ERROR: Could not process'
      AND (projected_uplift_certified IS NULL
           OR projected_uplift_audited IS NULL
           OR projected_uplift_underwritten IS NULL)
  `);
  const total = parseInt(countRes[0].cnt);
  log(`${total} agents ready for tier projection`);

  let processed = 0;
  let stats = {
    certified: { significant: 0, moderate: 0, minimal: 0 },
    audited: { significant: 0, moderate: 0, minimal: 0 },
    underwritten: { significant: 0, moderate: 0, minimal: 0 }
  };
  let errors = 0;
  let consecutiveErrors = 0;

  while (true) {
    const batch = await fetchBatch();
    if (batch.length === 0) {
      // Check if more agents have completed the base analysis
      const moreRes = await runSql(`
        SELECT count(*) as cnt FROM professionals
        WHERE active = true AND recommendation_with IS NULL AND uplift IS NULL
      `);
      const moreRemaining = parseInt(moreRes[0].cnt);
      if (moreRemaining > 0) {
        log(`No agents ready for projection yet, but ${moreRemaining} still in base analysis. Waiting 60s...`);
        await sleep(60000);
        continue;
      }
      log('All eligible agents projected!');
      break;
    }

    for (const agent of batch) {
      try {
        const results = await processAgent(agent);
        processed++;
        consecutiveErrors = 0;
        for (const tier of ['certified', 'audited', 'underwritten']) {
          stats[tier][results[`projected_uplift_${tier}`]]++;
        }
        log(`[${processed}/${total}] ${agent.name} (${agent.city_name}) → C:${results.projected_uplift_certified} A:${results.projected_uplift_audited} U:${results.projected_uplift_underwritten}`);
      } catch (err) {
        errors++;
        consecutiveErrors++;
        log(`ERROR ${agent.name}: ${err.message}`);

        if (consecutiveErrors >= 10) {
          log('10 consecutive errors — waiting 60s...');
          await sleep(60000);
          consecutiveErrors = 0;
        }

        if (consecutiveErrors >= 3) {
          try {
            await patchProfessional(agent.id, {
              projected_rec_certified: 'ERROR',
              projected_rec_audited: 'ERROR',
              projected_rec_underwritten: 'ERROR',
              projected_uplift_certified: 'minimal',
              projected_uplift_audited: 'minimal',
              projected_uplift_underwritten: 'minimal'
            });
            log(`Marked ${agent.name} as error/skipped`);
          } catch (e2) {
            log(`Failed to mark error: ${e2.message}`);
          }
        }
      }
      await sleep(DELAY_MS);
    }
  }

  log(`=== COMPLETE === Processed: ${processed} | Errors: ${errors}`);
  for (const tier of ['certified', 'audited', 'underwritten']) {
    log(`${tier}: sig=${stats[tier].significant} mod=${stats[tier].moderate} min=${stats[tier].minimal}`);
  }
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
