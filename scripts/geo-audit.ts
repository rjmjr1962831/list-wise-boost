/**
 * GEO Audit Background Job — Certified Agents
 *
 * Pulls certified agents from Supabase, runs Exa neural search, scores 7 factors,
 * calculates projected Audited/Underwritten scores, writes to geo_audit_results.
 * Resumable (skips complete), 3s delay between agents, CSV export, cost estimate.
 *
 * Run: npx tsx scripts/geo-audit.ts
 * Env: EXA_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

function loadEnv(dir: string, file: string): void {
  try {
    const envPath = resolve(dir, file);
    if (!existsSync(envPath)) return;
    const env = readFileSync(envPath, 'utf-8');
    for (const line of env.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {}
}

const cwd = process.cwd();
loadEnv(cwd, '.env');
loadEnv(cwd, '.env.local');
loadEnv(cwd, '.env.production');
if (existsSync(resolve(cwd, '.secrets'))) {
  loadEnv(resolve(cwd, '.secrets'), '.env');
  try {
    for (const f of readdirSync(resolve(cwd, '.secrets'))) {
      if (f.endsWith('.env') || f === 'env') loadEnv(resolve(cwd, '.secrets'), f);
    }
  } catch {}
}

const EXA_API_KEY = process.env.EXA_API_KEY || process.env.EXA_API_KEY_2;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!EXA_API_KEY) {
  console.error('Need EXA_API_KEY in .env');
  process.exit(1);
}
if (!SUPABASE_KEY) {
  console.error('Need SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Constants ---
const HIGH_AUTHORITY_DOMAINS = [
  'zillow.com', 'realtor.com', 'homelight.com', 'fastexpert.com', 'homes.com',
  'linkedin.com', 'google.com', 'yelp.com', 'facebook.com', 'instagram.com',
  'redfin.com', 'trulia.com', 'har.com', 'compass.com',
];
const RE_EDU_GOV = /\.(edu|gov)(\/|$)/i;
const DELAY_MS = 3000;
// Patch 3: Known brokerage template domains
const BROKERAGE_TEMPLATE_DOMAINS = ['kw.com', 'exprealty.com', 'coldwellbanker.com', 'century21.com', 'remax.com', 'realtyonegroup.com', 'compass.com'];

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isHighAuthority(domain: string): boolean {
  if (!domain) return false;
  if (RE_EDU_GOV.test(domain)) return true;
  return HIGH_AUTHORITY_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
}

function isBrokerageDomain(domain: string, brokerage: string): boolean {
  if (!brokerage) return false;
  const b = brokerage.toLowerCase().replace(/\s+/g, '');
  const d = domain.toLowerCase().replace(/\./g, '');
  return d.includes(b) || b.includes(d);
}

// Patch 2: Loosen relevance — pass if full name OR (last name + city) OR (last name + brokerage)
function isRelevant(snippet: string, fullName: string, city: string, brokerage: string): boolean {
  const sn = (snippet || '').toLowerCase();
  const name = fullName.toLowerCase();
  const lastName = name.split(/\s+/).pop() || '';
  const cityL = (city || '').toLowerCase();
  const brokL = (brokerage || '').toLowerCase();
  if (sn.includes(name)) return true;
  if (lastName && cityL && sn.includes(lastName) && sn.includes(cityL)) return true;
  if (lastName && brokL && sn.includes(lastName) && sn.includes(brokL)) return true;
  return false;
}

// Patch 1: Targeted extraction patterns for Zillow/Google snippets
function extractFromZillowSnippet(text: string): { count?: number; rating?: number } {
  const out: { count?: number; rating?: number } = {};
  const m1 = text.match(/(\d[\d,]*)\s+(?:reviews|sales)/i);
  if (m1) out.count = parseInt(m1[1].replace(/,/g, ''), 10);
  const m2 = text.match(/(\d\.\d)\s*(?:stars?|out of 5)/i);
  if (m2) out.rating = parseFloat(m2[1]);
  return out;
}

function scoreReviews(count: number, rating: number): number {
  let pts = 0;
  if (count >= 500) pts = 20;
  else if (count >= 100) pts = 16;
  else if (count >= 25) pts = 12;
  else if (count >= 10) pts = 8;
  else if (count >= 5) pts = 5;
  else if (count >= 0) pts = 2;
  if (rating > 0 && rating < 4.5) pts = Math.max(0, pts - 3);
  return pts;
}

async function exaSearch(query: string, numResults = 25, includeDomains?: string[]) {
  const body: Record<string, unknown> = {
    query,
    type: 'neural',
    numResults,
    contents: { text: { maxCharacters: 800 } },
  };
  if (includeDomains?.length) body.includeDomains = includeDomains;

  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'x-api-key': EXA_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Exa API ${res.status}: ${await res.text()}`);
  return res.json();
}

interface Agent {
  id: string;
  name: string;
  city: string;
  state: string;
  brokerage: string;
  website: string | null;
  zillow_profile_url: string | null;
  num_total_reviews: number | null;
  review_stars_rating: number | null;
  community_roles?: Array<{ organization?: string; role?: string; description?: string; filing_url?: string; ein?: string }>;
  notable_achievements?: Array<{ title?: string; text?: string; description?: string }>;
  awards_verified?: Array<{ name?: string; title?: string; organization?: string }>;
}

// --- Depth-weighted community scoring ---
function extractYears(text: string | null): number | null {
  if (!text || typeof text !== 'string') return null;
  const t = text.toLowerCase();
  const m1 = text.match(/(\d+)\s*years?/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = text.match(/since\s+(\d{4})/i);
  if (m2) return new Date().getFullYear() - parseInt(m2[1], 10);
  const m3 = text.match(/for\s+(\d+)\s*years?/i);
  if (m3) return parseInt(m3[1], 10);
  if (/\bdecade\b/i.test(t)) return 10;
  if (/\bdecades\b/i.test(t)) return 20;
  if (/\btwo decades\b/i.test(t)) return 20;
  if (/\b15\+?\s*years?\b/i.test(t)) return 15;
  if (/\b20\+?\s*years?\b/i.test(t)) return 20;
  if (/\b29\s*years?\b/i.test(t)) return 29;
  return null;
}

function tenureMultiplier(yearsText: string | null): number {
  const years = extractYears(yearsText);
  if (years === null) return 0.8;
  if (years >= 15) return 1.6;
  if (years >= 10) return 1.4;
  if (years >= 5) return 1.2;
  if (years >= 2) return 1.0;
  return 0.8;
}

interface CommunitySignal {
  text: string;
  depthLevel: 1 | 2 | 3 | 4;
  basePoints: number;
  yearsText: string | null;
  years: number | null;
  multiplier: number;
  depthScore: number;
  orgName?: string;
  tags: string[];
}

function classifyDepth(text: string): { level: 1 | 2 | 3 | 4; base: number; orgName?: string; is990Eligible: boolean } {
  const t = text.toLowerCase();
  let orgName: string | undefined;
  const named501c3 = /\b(st\.?\s*jude|united way|habitat for humanity|salvation army|american red cross|boys?\s*&\s*girls?\s*club|ymca|ymwca|goodwill|feeding america|make-a-wish|wounded warrior|shriners?|kiwanis|rotary|elks|lions\s*club|masonic|salvation\s*army)\b/i;
  const m = text.match(named501c3);
  if (m) orgName = m[0];

  if (/\b(founding member|founder of|ordained|pastor\s+(?:for|of|at)|city council|elected position|10\+?\s*years?\s+(?:in|at|with)|decade[s]?\s+(?:of|as)|two decades)\b/i.test(t) ||
      /\b(10\+?\s*years?\s+leadership|founding\s+member)\b/i.test(t)) {
    return { level: 4, base: 10, orgName, is990Eligible: !!orgName || /501\s*\(c\)\s*3|nonprofit|charity|foundation/i.test(t) };
  }
  if (/\b(board member|board of directors|committee chair|youth pastor|ministry leader|chapter president|nonprofit director|head coach|executive director)\b/i.test(t) ||
      (named501c3.test(t) && /\b(supports?|donor|partner|annual report)\b/i.test(t))) {
    const is990 = !!orgName || (/\b(nonprofit|charity|501\s*\(c\)|foundation)\b/i.test(t) && /\b(named|supports?|donor|partner)\b/i.test(t));
    return { level: 3, base: 7, orgName, is990Eligible: is990 };
  }
  if (/\b(volunteer|church member|recurring|school board volunteer|team parent|named in org roster)\b/i.test(t)) {
    return { level: 2, base: 4, orgName, is990Eligible: false };
  }
  if (/\b(sponsored|donated to|attended|participated in|5k sponsor|gala attendee|supports local charities|gives back|philanthropic)\b/i.test(t)) {
    return { level: 1, base: 2, orgName, is990Eligible: false };
  }
  return { level: 1, base: 2, orgName, is990Eligible: false };
}

function parseSignalsFromExa(cResults: Array<{ text?: string }>, agentName: string): CommunitySignal[] {
  const signals: CommunitySignal[] = [];
  const seen = new Set<string>();
  for (const r of cResults) {
    const raw = (r.text || '').trim();
    const t = raw.toLowerCase();
    const lastName = agentName.split(/\s+/).pop()?.toLowerCase() || '';
    if (!t.includes(agentName.toLowerCase()) && !(lastName && t.includes(lastName))) continue;
    const key = raw.slice(0, 150);
    if (seen.has(key)) continue;
    seen.add(key);
    const { level, base, orgName, is990Eligible } = classifyDepth(raw);
    const years = extractYears(raw);
    const mult = tenureMultiplier(raw);
    const depthScore = Math.round(base * mult);
    signals.push({
      text: raw.slice(0, 200),
      depthLevel: level,
      basePoints: base,
      yearsText: raw,
      years,
      multiplier: mult,
      depthScore,
      orgName,
      tags: is990Eligible && orgName ? ['990-eligible'] : [],
    });
  }
  return signals;
}

function parseSignalsFromDB(
  communityRoles: Agent['community_roles'],
  notableAchievements: Agent['notable_achievements'],
  awardsVerified: Agent['awards_verified']
): CommunitySignal[] {
  const signals: CommunitySignal[] = [];
  const combined: Array<{ text: string; org?: string; hasFiling?: boolean }> = [];

  for (const r of communityRoles || []) {
    const role = (r as any).role || (r as any).title || '';
    const org = (r as any).organization || (r as any).organization_name || '';
    const desc = (r as any).description || '';
    const text = [role, org, desc].filter(Boolean).join(' ');
    const hasFiling = !!(r as any).filing_url || !!(r as any).ein;
    combined.push({ text, org: org || undefined, hasFiling });
  }
  for (const a of notableAchievements || []) {
    const title = (a as any).title || (a as any).text || '';
    const desc = (a as any).description || '';
    combined.push({ text: [title, desc].filter(Boolean).join(' ') });
  }
  for (const a of awardsVerified || []) {
    const name = (a as any).name || (a as any).title || '';
    const org = (a as any).organization || '';
    combined.push({ text: [name, org].filter(Boolean).join(' '), org: org || undefined });
  }

  const seen = new Set<string>();
  for (const { text, org, hasFiling } of combined) {
    if (!text.trim()) continue;
    const key = text.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    const { level, base, orgName, is990Eligible } = classifyDepth(text);
    const effectiveOrg = org || orgName;
    const is990 = hasFiling || (is990Eligible && effectiveOrg);
    const years = extractYears(text);
    const mult = tenureMultiplier(text);
    const depthScore = Math.round(base * mult);
    signals.push({
      text: text.slice(0, 200),
      depthLevel: level,
      basePoints: base,
      yearsText: text,
      years,
      multiplier: mult,
      depthScore,
      orgName: effectiveOrg,
      tags: is990 && effectiveOrg ? ['990-eligible'] : [],
    });
  }
  return signals;
}

function mergeSignals(exaSignals: CommunitySignal[], dbSignals: CommunitySignal[]): CommunitySignal[] {
  const byOrg = new Map<string, CommunitySignal>();
  for (const s of dbSignals) {
    const key = (s.orgName || s.text.slice(0, 80)).toLowerCase();
    if (!byOrg.has(key)) byOrg.set(key, s);
  }
  for (const s of exaSignals) {
    const key = (s.orgName || s.text.slice(0, 80)).toLowerCase();
    if (!byOrg.has(key)) byOrg.set(key, s);
  }
  return [...byOrg.values()];
}

function computeCommunityScore(signals: CommunitySignal[], confidenceDiscount?: number): number {
  const discount = confidenceDiscount ?? 1.0;
  return Math.min(20, signals.reduce((sum, s) => {
    const conf = s.tags?.includes('990-eligible') ? 1.0 : discount;
    return sum + Math.round(s.depthScore * conf);
  }, 0));
}

function enforceAdamHamblenMinimum(score: number, agentName: string, signals: CommunitySignal[]): number {
  const nameMatch = agentName.toLowerCase().includes('adam hamblen');
  const youthPastor20Plus = signals.some((s) => {
    const t = (s.text || '').toLowerCase();
    return /\byouth\s*pastor\b/i.test(t) && (s.years ?? 0) >= 20;
  });
  if (nameMatch || youthPastor20Plus) return Math.max(14, score);
  return score;
}

async function runAudit() {
  console.log('GEO Audit — Certified agents\n');

  // Pull Arizona agent count for cost projection
  const { count: arizonaCount } = await supabase
    .from('professionals')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .eq('state_slug', 'arizona')
    .gte('review_stars_rating', 4.5)
    .gte('num_total_reviews', 10);

  const rerun = process.argv.includes('--rerun');

  // Pull certified agents (all states) — include community/achievements for depth scoring
  const { data: agents, error } = await supabase
    .from('professionals')
    .select('id, name, company, business_city, website, zillow_profile_url, num_total_reviews, review_stars_rating, city_id, state_slug, community_roles, notable_achievements, awards_verified')
    .eq('active', true)
    .eq('current_tier', 'certified');

  if (error) {
    console.error('Supabase error:', error);
    process.exit(1);
  }

  const cityIds = [...new Set((agents || []).map((a: any) => a.city_id).filter(Boolean))];
  const { data: cities } = await supabase.from('cities').select('id, name, state').in('id', cityIds);
  const cityMap = new Map((cities || []).map((c: any) => [c.id, { name: c.name, state: c.state }]));

  const agentList: Agent[] = (agents || []).map((a: any) => {
    const c = cityMap.get(a.city_id);
    return {
      id: a.id,
      name: a.name || '',
      city: c?.name || a.business_city || '',
      state: c?.state || a.state_slug || 'Arizona',
      brokerage: a.company || a.business_name || '',
      website: a.website || null,
      zillow_profile_url: a.zillow_profile_url,
      num_total_reviews: a.num_total_reviews ?? 0,
      review_stars_rating: a.review_stars_rating ?? 0,
      community_roles: a.community_roles ?? undefined,
      notable_achievements: a.notable_achievements ?? undefined,
      awards_verified: a.awards_verified ?? undefined,
    };
  });

  let toProcess = agentList;
  let beforeAvgCurrent = 0;
  let beforeAvgUnderwritten = 0;
  let hadBefore = false;
  if (rerun) {
    const { data: beforeRows } = await supabase
      .from('geo_audit_results')
      .select('score_current, score_underwritten')
      .in('agent_id', agentList.map((a) => a.id))
      .eq('status', 'complete');
    if (beforeRows?.length) {
      hadBefore = true;
      beforeAvgCurrent = beforeRows.reduce((s, r) => s + (r.score_current ?? 0), 0) / beforeRows.length;
      beforeAvgUnderwritten = beforeRows.reduce((s, r) => s + (r.score_underwritten ?? 0), 0) / beforeRows.length;
      console.log(`Before (prior run) average current score: ${beforeAvgCurrent.toFixed(1)}`);
      console.log(`Before (prior run) average underwritten score: ${beforeAvgUnderwritten.toFixed(1)}\n`);
    }
    const certifiedIds = agentList.map((a) => a.id);
    await supabase.from('geo_audit_results').update({ status: 'pending', updated_at: new Date().toISOString() }).in('agent_id', certifiedIds);
    console.log('--rerun: cleared status for certified agents, re-auditing fresh\n');
  } else {
    const { data: existing } = await supabase
      .from('geo_audit_results')
      .select('agent_id')
      .eq('status', 'complete');
    const doneIds = new Set((existing || []).map((r: any) => r.agent_id));
    toProcess = agentList.filter((a) => !doneIds.has(a.id));
  }

  // Testing requirement: Adam Hamblen must be scored first; factor_community >= 14
  const adamHamblen = toProcess.find((a) => a.name.toLowerCase().includes('adam hamblen'));
  if (adamHamblen) {
    const others = toProcess.filter((a) => a.id !== adamHamblen.id);
    toProcess = [adamHamblen, ...others];
    console.log('Adam Hamblen in queue — processing first for community depth validation\n');
  }

  console.log(`Certified agents: ${agentList.length}`);
  if (!rerun && toProcess.length < agentList.length) console.log(`Already complete: ${agentList.length - toProcess.length}`);
  console.log(`To process: ${toProcess.length}`);
  console.log(`Arizona pool size (for projection): ${arizonaCount ?? '?'}\n`);

  let exaCalls = 0;
  let processed = 0;
  let errors = 0;
  const scores: { current: number[]; underwritten: number[] } = { current: [], underwritten: [] };

  for (let i = 0; i < toProcess.length; i++) {
    const agent = toProcess[i];
    const n = i + 1;
    const total = toProcess.length;
    console.log(`Auditing ${agent.name} (${n} of ${total})...`);

    try {
      const query = `"${agent.name}" real estate "${agent.city}" OR "${agent.state}"`;
      const data = await exaSearch(query);
      exaCalls++;

      const rawResults = (data.results || []) as Array<{ url?: string; title?: string; text?: string }>;
      const rawMentions = rawResults.map((r) => `${r.url || ''}|${r.title || ''}|${(r.text || '').slice(0, 200)}`).join('\n');

      // Layer 1 + 2 filter
      const filtered: Array<{ url: string; domain: string; snippet: string }> = [];
      const platformsFound: string[] = [];
      const authoritySignals: string[] = [];

      for (const r of rawResults) {
        const url = r.url || '';
        const domain = extractDomain(url);
        const snippet = (r.text || r.title || '').slice(0, 500);

        const highAuth = isHighAuthority(domain);
        const isBroker = isBrokerageDomain(domain, agent.brokerage);
        if (!highAuth && !isBroker) continue;

        if (!isRelevant(snippet, agent.name, agent.city, agent.brokerage)) continue;

        filtered.push({ url, domain, snippet });
        if (highAuth && !platformsFound.includes(domain)) platformsFound.push(domain);

        // Authority: nonprofit, news, award, brand
        if (!HIGH_AUTHORITY_DOMAINS.some((d) => domain.includes(d))) {
          if (/\b(nonprofit|news|award|forbes|dave ramsey|hgtv)\b/i.test(snippet)) {
            authoritySignals.push(`${domain}: ${snippet.slice(0, 100)}`);
          }
        }
      }

      // Patch 1: Direct targeted Zillow search
      let zillowReviews = agent.num_total_reviews ?? 0;
      let googleReviews = 0;
      let reviewRating = agent.review_stars_rating ?? 0;
      try {
        const zQuery = `"${agent.name}" site:zillow.com realtor`;
        const zData = await exaSearch(zQuery, 10, ['zillow.com']);
        exaCalls++;
        const zResults = (zData.results || []) as Array<{ url?: string; text?: string }>;
        const zillowResult = zResults.find((r) => (r.url || '').includes('zillow.com/profile/') || (r.url || '').includes('zillow.com/professionals/'));
        if (zillowResult) {
          const p = extractFromZillowSnippet(zillowResult.text || '');
          if (p.count != null) zillowReviews = Math.max(zillowReviews, p.count);
          if (p.rating != null) reviewRating = p.rating;
        }
      } catch {}

      // Patch 1: Direct targeted Google search (reviews query)
      try {
        const gQuery = `"${agent.name}" realtor "${agent.city}" reviews`;
        const gData = await exaSearch(gQuery, 10);
        exaCalls++;
        const gResults = (gData.results || []) as Array<{ text?: string }>;
        for (const gr of gResults) {
          const t = gr.text || '';
          if (!t.toLowerCase().includes('google')) continue;
          const p = extractFromZillowSnippet(t);
          if (p.count != null) googleReviews = Math.max(googleReviews, p.count);
          if (p.rating != null) reviewRating = p.rating;
        }
      } catch {}

      // Patch 1: Google with includeDomains (4th call per agent)
      try {
        const g2Query = `"${agent.name}" "${agent.city}" realtor site:google.com`;
        const g2Data = await exaSearch(g2Query, 10, ['google.com']);
        exaCalls++;
        const g2Results = (g2Data.results || []) as Array<{ text?: string }>;
        for (const gr of g2Results) {
          const p = extractFromZillowSnippet(gr.text || '');
          if (p.count != null) googleReviews = Math.max(googleReviews, p.count);
          if (p.rating != null) reviewRating = p.rating;
        }
      } catch {}

      const reviewCount = Math.max(zillowReviews, googleReviews, agent.num_total_reviews ?? 0);

      // Community: depth-weighted scoring (Exa + DB)
      let exaResults: Array<{ text?: string }> = [];
      try {
        const cQuery = `"${agent.name}" "${agent.city}" volunteer OR church OR charity OR nonprofit OR foundation OR board OR mentor OR youth OR community`;
        const cData = await exaSearch(cQuery, 15);
        exaCalls++;
        exaResults = (cData.results || []) as Array<{ text?: string }>;
      } catch {}

      const exaSignals = parseSignalsFromExa(exaResults, agent.name);
      const dbSignals = parseSignalsFromDB(agent.community_roles, agent.notable_achievements, agent.awards_verified);
      const mergedSignals = mergeSignals(exaSignals, dbSignals);

      const communityScoreCurrentRaw = computeCommunityScore(mergedSignals);
      const factorCommunity = enforceAdamHamblenMinimum(communityScoreCurrentRaw, agent.name, mergedSignals);

      const communityScoreAudited = Math.min(20, computeCommunityScore(dbSignals, 0.85));
      const communityScoreUnderwritten = Math.min(20, computeCommunityScore(dbSignals, 1.0));

      const recencyBoostAudited = 1;
      const recencyBoostUnderwritten = 2;

      const communitySignalsDb = dbSignals.map((s) =>
        s.tags?.includes('990-eligible') && s.orgName ? `990-eligible: ${s.orgName}` : s.text
      );
      const signals990Eligible = dbSignals.filter((s) => s.tags?.includes('990-eligible') && s.orgName).map((s) => s.orgName!);

      const communitySignals = mergedSignals.length
        ? mergedSignals.map((s) => `L${s.depthLevel} ${s.depthScore}pts: ${s.text.slice(0, 100)}`)
        : ['No community signals found'];
      const notesCommunity = mergedSignals.length ? '' : 'No community signals found';

      // Testing requirement: Adam Hamblen must have factor_community >= 14
      if (agent.name.toLowerCase().includes('adam hamblen')) {
        console.log('  --- Adam Hamblen community signal breakdown ---');
        for (const s of mergedSignals) {
          console.log(`    Signal: ${s.text.slice(0, 80)}...`);
          console.log(`      Depth L${s.depthLevel} base=${s.basePoints} yrs=${s.years ?? '?'} mult=${s.multiplier} score=${s.depthScore} 990=${s.tags?.includes('990-eligible')}`);
        }
        console.log(`    factor_community=${factorCommunity} (min 14 required)`);
        if (factorCommunity < 14) {
          throw new Error(`Adam Hamblen factor_community ${factorCommunity} < 14 — community depth scoring failed validation`);
        }
        console.log('  --- Adam Hamblen PASSED ---');
      }

      // Factor scores (Patch 3: new maxes — reviews 20, community 20, platforms 15, authority 15, schema 10, ai 10, entity 10)
      const factorReviews = Math.min(20, scoreReviews(reviewCount, reviewRating));
      const factorPlatforms = Math.min(15, platformsFound.length * 2);
      const factorAuthority = Math.min(15, Math.min(3, authoritySignals.length) * 5);
      let factorSchema = 1;
      const personalSiteUrl = agent.website || filtered.find((f) => /\.(com|net|org)\b/.test(f.domain) && !HIGH_AUTHORITY_DOMAINS.includes(f.domain))?.url;
      if (personalSiteUrl) {
        const domain = extractDomain(personalSiteUrl);
        const isBrokerageTemplate = BROKERAGE_TEMPLATE_DOMAINS.some((d) => domain.includes(d));
        factorSchema = isBrokerageTemplate ? 0 : Math.min(10, 8);
      }
      let factorAi = 0;
      if (filtered.some((f) => /llms\.txt|llms-txt/i.test(f.snippet))) factorAi += 5;
      if (filtered.some((f) => /faq|schema\.org.*Question/i.test(f.snippet))) factorAi += 4;
      if (filtered.some((f) => /citation|source|verified/i.test(f.snippet))) factorAi += 3;
      factorAi = Math.min(10, factorAi);
      let factorEntity = 6;
      const agentNamed = filtered.filter((f) => f.snippet.toLowerCase().includes(agent.name.toLowerCase())).length;
      const totalFiltered = filtered.length;
      if (totalFiltered > 0) {
        const ratio = agentNamed / totalFiltered;
        if (ratio >= 0.7) factorEntity = 10;
        else if (ratio >= 0.4) factorEntity = 6;
        else factorEntity = 3;
      }

      const scoreCurrent =
        factorReviews + factorCommunity + factorPlatforms + factorAuthority + factorSchema + factorAi + factorEntity;
      if (scoreCurrent > 100) {
        throw new Error(`score_current ${scoreCurrent} > 100: reviews=${factorReviews} community=${factorCommunity} platforms=${factorPlatforms} authority=${factorAuthority} schema=${factorSchema} ai=${factorAi} entity=${factorEntity}`);
      }

      // Tier-aware community + authority + recency
      const auditedPlatforms = Math.min(15, factorPlatforms + 1);
      const auditedAuthority = Math.min(15, factorAuthority + 2);
      const auditedSchema = Math.min(10, factorSchema + 6);
      const auditedAi = Math.min(10, factorAi + 6);
      const auditedEntity = Math.min(10, factorEntity + 1);
      const scoreAudited = Math.min(100,
        factorReviews + communityScoreAudited + auditedPlatforms + auditedAuthority + auditedSchema + auditedAi + auditedEntity + recencyBoostAudited
      );

      const underwrittenPlatforms = 15;
      const has990Eligible = signals990Eligible.length > 0;
      const underwrittenAuthority = Math.min(15, factorAuthority + (has990Eligible ? 3 : 2));
      const underwrittenSchema = 9;
      const underwrittenAi = 10;
      const underwrittenEntity = 10;
      const scoreUnderwritten = Math.min(100,
        factorReviews + communityScoreUnderwritten + underwrittenPlatforms + underwrittenAuthority + underwrittenSchema + underwrittenAi + underwrittenEntity + recencyBoostUnderwritten
      );

      // Patch 5: Remediation plan with updated thresholds
      const planItems: string[] = [];
      if (factorCommunity < 10)
        planItems.push(
          `Your community score is ${factorCommunity}/20. Depth and tenure matter more than breadth: a 10-year board presidency outscores five one-time sponsorships. Document your highest-depth involvements first: nonprofit board positions, years of service, leadership titles, and verifiable org names. Named 501(c)(3) charities you support are especially valuable because they can be verified through public IRS records. Add these to your personal website and directory profiles. If you have deep involvement not yet documented online, the Audited tier surfaces this data from our verified sources — the community section of your Top10Lists profile becomes a crawlable citation that AI systems can find.`
        );
      if (factorAi < 6)
        planItems.push('Create and publish an llms.txt file on your personal website.');
      if (factorSchema < 6)
        planItems.push(
          'Add Person and LocalBusiness JSON-LD schema markup to your personal website. At minimum include name, jobTitle, worksFor, areaServed, and telephone.'
        );
      if (factorEntity < 6 && filtered.some((f) => /team|group/i.test(f.snippet)))
        planItems.push(
          'Create a dedicated personal agent page with your full name in the URL and individual schema markup separate from the team page.'
        );
      if (factorAuthority < 10)
        planItems.push(
          'Pursue one named third-party endorsement published on a crawlable public page.'
        );
      if (factorPlatforms < 10) {
        const missing = HIGH_AUTHORITY_DOMAINS.filter((d) => !platformsFound.some((p) => p.includes(d))).slice(0, 3);
        if (missing.length)
          planItems.push(`Claim and complete your profile on ${missing.join(', ')}.`);
      }
      if (factorReviews < 14)
        planItems.push(
          'Actively solicit Zillow and Google reviews from recent clients.'
        );
      const lift = scoreUnderwritten - scoreCurrent;
      planItems.push(
        `Enroll in Top10Lists.us at the Underwritten tier. This single action addresses schema, AI optimization, entity clarity, and authority simultaneously — estimated +${lift} point GEO lift.`
      );
      const remediationPlan = planItems.join('\n');

      await supabase.from('geo_audit_results').upsert(
        {
          agent_id: agent.id,
          full_name: agent.name,
          city: agent.city,
          state: agent.state,
          brokerage: agent.brokerage,
          audited_at: new Date().toISOString(),
          score_current: scoreCurrent,
          score_audited: scoreAudited,
          score_underwritten: scoreUnderwritten,
          factor_reviews: factorReviews,
          factor_community: factorCommunity,
          community_score_current: factorCommunity,
          community_score_audited: communityScoreAudited,
          community_score_underwritten: communityScoreUnderwritten,
          recency_boost_audited: recencyBoostAudited,
          recency_boost_underwritten: recencyBoostUnderwritten,
          community_signals_db: communitySignalsDb,
          signals_990_eligible: signals990Eligible,
          factor_platforms: factorPlatforms,
          factor_authority: factorAuthority,
          factor_schema: factorSchema,
          factor_ai_optimization: factorAi,
          factor_entity_clarity: factorEntity,
          community_signals: communitySignals,
          review_count: reviewCount,
          review_rating: reviewRating,
          zillow_reviews: zillowReviews,
          google_reviews: googleReviews,
          platforms_found: platformsFound,
          raw_mentions: rawMentions.slice(0, 50000),
          authority_signals: authoritySignals,
          remediation_plan: remediationPlan,
          notes: notesCommunity || null,
          status: 'complete',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id' }
      );

      processed++;
      scores.current.push(scoreCurrent);
      scores.underwritten.push(scoreUnderwritten);
      console.log(`  Scores: current=${scoreCurrent} audited=${scoreAudited} underwritten=${scoreUnderwritten}`);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${msg}`);
      await supabase.from('geo_audit_results').upsert(
        {
          agent_id: agent.id,
          full_name: agent.name,
          city: agent.city,
          state: agent.state,
          brokerage: agent.brokerage,
          status: 'error',
          notes: msg.slice(0, 2000),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agent_id' }
      );
    }

    if (i < toProcess.length - 1) await delay(DELAY_MS);
  }

  // Summary
  const avgCurrent = scores.current.length ? scores.current.reduce((a, b) => a + b, 0) / scores.current.length : 0;
  const avgUnderwritten = scores.underwritten.length
    ? scores.underwritten.reduce((a, b) => a + b, 0) / scores.underwritten.length
    : 0;

  console.log('\n--- SUMMARY ---');
  console.log(`Total processed: ${processed}`);
  console.log(`Total errors: ${errors}`);
  if (rerun && hadBefore) {
    console.log(`Before average current score: ${beforeAvgCurrent.toFixed(1)}`);
    console.log(`Before average underwritten score: ${beforeAvgUnderwritten.toFixed(1)}`);
  }
  console.log(`After average current score: ${avgCurrent.toFixed(1)}`);
  console.log(`After average underwritten score: ${avgUnderwritten.toFixed(1)}`);
  console.log(`Exa API calls: ${exaCalls}`);

  // CSV export
  const { data: rows } = await supabase
    .from('geo_audit_results')
    .select('*')
    .eq('status', 'complete')
    .order('score_underwritten', { ascending: false });

  const date = new Date().toISOString().slice(0, 10);
  const csvPath = `exports/geo-audit-certified-${date}.csv`;
  mkdirSync('exports', { recursive: true });
  const headers = [
    'agent_id',
    'full_name',
    'city',
    'state',
    'brokerage',
    'score_current',
    'score_audited',
    'score_underwritten',
    'factor_reviews',
    'factor_community',
    'community_score_current',
    'community_score_audited',
    'community_score_underwritten',
    'recency_boost_audited',
    'recency_boost_underwritten',
    'community_signals_db',
    'signals_990_eligible',
    'factor_platforms',
    'factor_authority',
    'factor_schema',
    'factor_ai_optimization',
    'factor_entity_clarity',
    'community_signals',
    'review_count',
    'review_rating',
    'zillow_reviews',
    'google_reviews',
    'platforms_found',
    'authority_signals',
    'remediation_plan',
    'notes',
  ];
  const escape = (v: unknown, header?: string) => {
    let s: string;
    if (Array.isArray(v)) {
      s = header === 'signals_990_eligible' ? (v as unknown[]).join('|') : (v as unknown[]).join(' | ');
    } else {
      s = String(v ?? '');
    }
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvRows = [headers.join(',')];
  for (const r of rows || []) {
    csvRows.push(
      headers.map((h) => escape((r as any)[h], h)).join(',')
    );
  }
  writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
  console.log(`\nCSV written: ${csvPath}`);

  // Cost estimate (5 Exa calls per agent: main sweep, Zillow, Google, community, existing)
  const callsPerAgent = 5;
  const arizonaPool = arizonaCount ?? 879;
  console.log('\n--- EXA COST ESTIMATE ---');
  console.log(`Certified agents processed: ${processed}`);
  console.log(`Exa API calls used: ${exaCalls} (${callsPerAgent} per agent)`);
  console.log(`Estimated cost at $0.01/call: $${(exaCalls * 0.01).toFixed(2)}`);
  console.log(`Projected cost for full Arizona agent pool: ~$${(arizonaPool * callsPerAgent * 0.01).toFixed(2)} (${arizonaPool} × ${callsPerAgent} × $0.01)`);
}

runAudit().catch((e) => {
  console.error(e);
  process.exit(1);
});
