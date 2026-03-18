/**
 * backfill-license-numbers.mjs
 *
 * Matches active professionals missing license numbers against the
 * arizona-licenses.csv state board export. Run after any new agent
 * discovery or enrichment batch.
 *
 * Usage:
 *   node scripts/backfill-license-numbers.mjs [--dry-run] [--state az|ca]
 *
 * What it does:
 *   1. Fetches all active professionals with null/placeholder license numbers
 *   2. Loads the AZ state license CSV (221K records)
 *   3. Matches by exact name, then nickname expansion, then surname-only for teams
 *   4. Updates matched agents in the DB via Supabase REST API
 *   5. Reports unmatched agents for manual review
 *
 * Requires: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually (no dotenv dependency)
const envPath = resolve(process.cwd(), '.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found -- rely on existing env vars */ }

const SBU = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SRK) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_PATH = resolve(process.cwd(), 'public/arizona-licenses.csv');

// Placeholder license values that mean "no real license"
const PLACEHOLDERS = new Set(['1522444', 'N/A', 'Not provided', 'AZ License', 'HSMOVE', 'DV139', '']);

// Common nickname -> formal name mappings
const NICKNAMES = {
  Bill: ['William', 'Billy'], Bob: ['Robert', 'Bobby'], Rich: ['Richard'],
  Tom: ['Thomas'], Patty: ['Patricia', 'Patti'], Chris: ['Christopher', 'Christine', 'Christina'],
  Dan: ['Daniel'], Dave: ['David'], Mike: ['Michael'], Jeff: ['Jeffrey', 'Geoffrey'],
  Becca: ['Rebecca'], Jen: ['Jennifer'], Kris: ['Kristin', 'Kristine', 'Kristen'],
  Shelly: ['Shelley', 'Michelle'], Cindy: ['Cynthia'], Rachael: ['Rachel'],
  Katie: ['Katherine', 'Kathryn'], Ray: ['Raymond'], Eddie: ['Edward'],
  Frank: ['Francisco', 'Franklin'], Steve: ['Stephen'], Len: ['Leonard'],
  J: ['James', 'John', 'Jason', 'Joseph', 'Jeffrey'], Jack: ['John', 'Jackson'],
  Lew: ['Lewis'], Pat: ['Patricia', 'Patrick'], Jim: ['James'],
  Dick: ['Richard'], Joe: ['Joseph'], Ed: ['Edward', 'Edwin'],
  Sam: ['Samuel'], Ben: ['Benjamin'], Nick: ['Nicholas'],
  Matt: ['Matthew'], Alex: ['Alexander', 'Alexandra'],
  Tony: ['Anthony'], Megan: ['Margaret'],
};

// ── Load AZ license CSV ──────────────────────────────────────────────
function loadLicenseCSV(path) {
  const map = new Map();
  let lines;
  try {
    lines = readFileSync(path, 'utf8').split('\n');
  } catch {
    console.warn(`[backfill] CSV not found at ${path} -- skipping AZ CSV matching`);
    return map;
  }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    const [last, first, mid, , lic, type, emp, , , , city] = parts;
    if (!last || !first || !lic) continue;
    const key = `${last.trim().toUpperCase()},${first.trim().toUpperCase()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      license: lic.trim(), type: (type || '').trim(),
      employer: (emp || '').trim(), city: (city || '').trim(),
      first: first.trim(), last: last.trim(),
    });
  }
  console.log(`[backfill] Loaded ${map.size} unique names from AZ license CSV`);
  return map;
}

function csvLookup(map, first, last) {
  return map.get(`${last.toUpperCase()},${first.toUpperCase()}`) || null;
}

// ── Supabase helpers ─────────────────────────────────────────────────
async function runSql(query) {
  const resp = await fetch(`${SBU}/rest/v1/rpc/run_sql`, {
    method: 'POST',
    headers: { 'apikey': SRK, 'Authorization': `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return await resp.json();
}

async function patchProfessional(id, license) {
  if (DRY_RUN) return true;
  const resp = await fetch(`${SBU}/rest/v1/professionals?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'apikey': SRK, 'Authorization': `Bearer ${SRK}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ license_number: license }),
  });
  return resp.ok;
}

// ── Matching logic ───────────────────────────────────────────────────
function tryMatch(map, agent) {
  const name = agent.name.trim();
  const parts = name.split(/\s+/);
  if (parts.length < 2) return null;

  const first = parts[0];
  const last = parts[parts.length - 1];
  const city = (agent.business_city || '').toUpperCase();

  // 1. Exact match
  let results = csvLookup(map, first, last);
  let via = first;

  // 2. Nickname expansion
  if (!results) {
    const alts = NICKNAMES[first] || [];
    for (const alt of alts) {
      results = csvLookup(map, alt, last);
      if (results) { via = alt; break; }
    }
  }

  // 3. Hyphenated last name -- try first part
  if (!results && last.includes('-')) {
    const firstPart = last.split('-')[0];
    results = csvLookup(map, first, firstPart);
    if (!results) {
      for (const alt of (NICKNAMES[first] || [])) {
        results = csvLookup(map, alt, firstPart);
        if (results) { via = alt; break; }
      }
    }
  }

  if (!results) return null;

  // Single match -- use it
  if (results.length === 1) return { license: results[0].license, via, confidence: 'high' };

  // Multiple matches -- try city disambiguation
  if (city) {
    const cityMatch = results.filter(r => r.city.toUpperCase().includes(city));
    if (cityMatch.length === 1) return { license: cityMatch[0].license, via: `${via} + city ${city}`, confidence: 'high' };
  }

  // Multiple matches -- if all same license type and only one is a Broker, prefer Broker
  const brokers = results.filter(r => r.type === 'Broker');
  if (brokers.length === 1 && results.length <= 3) {
    return { license: brokers[0].license, via: `${via} (broker preferred)`, confidence: 'medium' };
  }

  return { ambiguous: results.length, via };
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`[backfill] ${DRY_RUN ? 'DRY RUN -- ' : ''}Starting license backfill...`);

  // Fetch agents missing license numbers
  const agents = await runSql(`
    SELECT id, name, business_city, state_slug
    FROM professionals
    WHERE active = true
      AND state_slug IN ('arizona', 'california')
      AND (license_number IS NULL
           OR license_number IN ('1522444','N/A','Not provided','AZ License','HSMOVE','DV139')
           OR license_number = '')
    ORDER BY name
  `);

  if (!agents || agents.length === 0) {
    console.log('[backfill] No agents missing license numbers. All clear.');
    return;
  }

  console.log(`[backfill] Found ${agents.length} agents missing license numbers`);

  // Load CSV
  const licenseMap = loadLicenseCSV(CSV_PATH);

  let matched = 0, ambiguous = 0, unmatched = 0;
  const unmatchedList = [];
  const ambiguousList = [];

  for (const agent of agents) {
    const result = tryMatch(licenseMap, agent);

    if (result && result.license) {
      const ok = await patchProfessional(agent.id, result.license);
      if (ok) {
        matched++;
        console.log(`  OK: ${agent.name} -> ${result.license} [${result.via}] (${result.confidence})`);
      } else {
        console.log(`  FAIL: ${agent.name} -> ${result.license}`);
      }
    } else if (result && result.ambiguous) {
      ambiguous++;
      ambiguousList.push({ name: agent.name, city: agent.business_city, matches: result.ambiguous });
      console.log(`  AMBIGUOUS: ${agent.name} (${agent.business_city}) -- ${result.ambiguous} matches`);
    } else {
      unmatched++;
      unmatchedList.push({ name: agent.name, city: agent.business_city, state: agent.state_slug });
      console.log(`  NO MATCH: ${agent.name} (${agent.business_city})`);
    }
  }

  console.log(`\n[backfill] Results: ${matched} matched, ${ambiguous} ambiguous, ${unmatched} unmatched`);

  if (ambiguousList.length > 0) {
    console.log('\n[backfill] Ambiguous (need manual disambiguation):');
    ambiguousList.forEach(a => console.log(`  - ${a.name} (${a.city}) -- ${a.matches} license matches`));
  }

  if (unmatchedList.length > 0) {
    console.log('\n[backfill] Unmatched (need manual AZRE/DRE lookup or deactivation):');
    unmatchedList.forEach(a => console.log(`  - ${a.name} (${a.city}, ${a.state})`));
  }
}

main().catch(err => { console.error('[backfill] Fatal:', err); process.exit(1); });
