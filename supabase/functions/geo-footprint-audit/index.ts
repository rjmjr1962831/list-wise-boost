/**
 * geo-footprint-audit — Full GEO Footprint Audit for a single agent.
 *
 * 1. Pull agent data from professionals table (reviews, sales, social links, memo23)
 * 2. Pull or refresh Exa sources (web footprint)
 * 3. Crawl agent's personal website for JSON-LD schema markup
 * 4. Compute 4 tier scores (unlisted, listed, audited, underwritten)
 * 5. Identify gaps from real signals
 * 6. DeepSeek writes personalized action items based on gaps
 * 7. Save everything to geo_audit_results
 *
 * No GPT/OpenAI. Discovery is data + crawling. DeepSeek writes the copy.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

// ── Scoring helpers (AICS v1, locked) ────────────────────────────────────────

function recencyScore(dateStr: string | null): { score: number; label: string } {
  if (!dateStr) return { score: 0, label: "no date signal" };
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return { score: 0, label: "invalid date" };
  const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
  if (days <= 1)   return { score: 10, label: "today" };
  if (days <= 7)   return { score: 9,  label: `${days}d ago` };
  if (days <= 30)  return { score: 7,  label: `${days}d ago` };
  if (days <= 90)  return { score: 4,  label: `${days}d ago` };
  if (days <= 180) return { score: 2,  label: `${days}d ago` };
  if (days <= 365) return { score: 1,  label: `${days}d ago` };
  return { score: 0, label: `${days}d ago -- stale` };
}

function band(score: number): string {
  if (score <= 30) return "Effectively invisible to AI";
  if (score <= 50) return "Discoverable, not citable";
  if (score <= 70) return "Citable in general queries";
  if (score <= 85) return "Citable in specific local queries";
  return "Authoritative citation candidate";
}

function computeScore(a: any, tierRec: number, hasTop10: boolean, bonus: number) {
  let identity = 0;
  if (a.license_number)  identity += 5;
  if (a.company)         identity += 5;
  if (a.hasPersonalSite) identity += 5;
  if (a.hasLinkedin)     identity += 3;
  if (hasTop10)          identity += 2;

  let authority = 0;
  authority += Math.min(10, Math.floor((a.years_experience || 0) / 2));
  authority += Math.min(8,  Math.floor((a.total_sales || 0) / 30));
  if (a.description && a.description.length > 50) authority += 5;
  const s12 = a.sales_last_12mo || 0;
  if (s12 >= 5)      authority += Math.round(2 * (tierRec / 10));
  else if (s12 >= 1) authority += Math.round(1 * (tierRec / 10));

  let social = 0;
  const rc = a.num_total_reviews || 0;
  const rr = a.review_stars_rating || 0;
  social += Math.round(Math.min(10, rc) * (tierRec / 10));
  if (rr) social += Math.round(Math.max(0, rr - 3.5) * 5.3 * (tierRec / 10));
  if (a.hasRealtor)   social += 4;
  if (a.hasHomelight) social += 3;

  let tech = 0;
  if (a.websiteCrawlable) tech += 5;
  if (!a.hasSchemaMarkup) tech -= 2;
  if (a.hasRealtor)       tech += 3;
  if (a.hasHomelight)     tech += 2;
  if (a.hasFacebook)      tech += 2;
  if (hasTop10)           tech += 3;

  let citable = 0;
  citable += Math.min(5, a.exaSourceCount || 0);
  citable += Math.min(3, (a.pressMentions || 0) * 2);
  if (hasTop10) citable += 7;
  citable = Math.round(citable * (0.4 + 0.6 * (tierRec / 10)));

  const total = Math.min(99, identity + authority + social + tech + citable + bonus);
  return { identity, authority, social, tech, citable, bonuses: bonus, total };
}

// ── Website crawl: check if site resolves + JSON-LD schema ───────────────────

async function crawlWebsite(url: string): Promise<{
  crawlable: boolean;
  hasSchema: boolean;
  schemaTypes: string[];
}> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Top10Lists-GEO-Audit/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { crawlable: false, hasSchema: false, schemaTypes: [] };

    const html = await res.text();
    const crawlable = html.length > 500;

    // Look for JSON-LD script blocks
    const jsonLdPattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const schemaTypes: string[] = [];
    let match;
    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item['@type']) {
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
            schemaTypes.push(...types);
          }
        }
      } catch { /* malformed JSON-LD */ }
    }

    const hasSchema = schemaTypes.some(t =>
      t.toLowerCase().includes('realestate') ||
      t.toLowerCase().includes('person') ||
      t.toLowerCase().includes('localbusiness') ||
      t.toLowerCase().includes('organization')
    );

    return { crawlable, hasSchema, schemaTypes };
  } catch {
    return { crawlable: false, hasSchema: false, schemaTypes: [] };
  }
}

// ── Exa search (URL-only, no content charges) ────────────────────────────────

async function exaSearch(agentName: string, stateLabel: string, company: string, exaKey: string): Promise<string[]> {
  try {
    const query = `${agentName} real estate agent ${stateLabel} ${company || ''}`.trim();
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': exaKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, num_results: 10, use_autoprompt: true }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => r.url as string);
  } catch {
    return [];
  }
}

// ── DeepSeek: AI perception queries ──────────────────────────────────────────
// These show the agent what AI currently says about them — powerful sales tool.

interface AiPerception {
  namedResult: string;       // "I have heard X is a top agent..."
  namedConfirmed: boolean;   // Did AI recognize them?
  unpromotedResult: string;  // "Who is the best agent in City, State..."
  unpromotedNamed: boolean;  // Did AI name them unprompted?
}

async function queryAiPerception(
  dsKey: string,
  agentName: string,
  city: string,
  state: string,
): Promise<AiPerception> {
  const namedQ = `I have heard ${agentName} is a top real estate agent in ${city}, ${state}. What can you tell me about them and their track record?`;
  const unpromotedQ = `Who is the best real estate agent in ${city}, ${state} for buying a luxury home? I want someone with at least 5 years of experience. Give me a specific name and explain why.`;

  const headers = { 'Authorization': `Bearer ${dsKey}`, 'Content-Type': 'application/json' };

  try {
    const [r1, r2] = await Promise.all([
      fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: namedQ }], max_tokens: 400 }),
      }),
      fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: unpromotedQ }], max_tokens: 400 }),
      }),
    ]);

    const d1 = await r1.json();
    const d2 = await r2.json();
    const namedResult = d1.choices?.[0]?.message?.content || '';
    const unpromotedResult = d2.choices?.[0]?.message?.content || '';

    // Check if the AI actually recognized them
    const nameParts = agentName.toLowerCase().split(' ');
    const namedConfirmed = namedResult.length > 100 &&
      !["don't have", "cannot find", "no specific", "i don't", "i'm not able", "unable to verify"].some(
        p => namedResult.toLowerCase().includes(p)
      );
    const unpromotedNamed = nameParts.length >= 2 &&
      unpromotedResult.toLowerCase().includes(nameParts[0]) &&
      unpromotedResult.toLowerCase().includes(nameParts[nameParts.length - 1]);

    return { namedResult, namedConfirmed, unpromotedResult, unpromotedNamed };
  } catch (err) {
    console.error('AI perception queries failed:', err);
    return { namedResult: '', namedConfirmed: false, unpromotedResult: '', unpromotedNamed: false };
  }
}

// ── DeepSeek: write personalized action items ────────────────────────────────

interface MergeFields {
  subject_line: string;       // "Becky, here's how AI sees you right now"
  opening: string;            // 1-2 sentences with their actual numbers
  action_items: string[];     // 3-4 plain text bullets, each a concrete action
  diy_plan: Array<{           // Detailed writeup per gap
    title: string;
    description: string;      // 2-3 sentences: why it matters + how to fix
    impact: string;           // "+6 to +10 pts"
    effort: string;           // "Low -- 1 day"
  }>;
}

async function generateMergeFields(
  dsKey: string,
  agentProfile: {
    firstName: string;
    fullName: string;
    company: string;
    totalSales: number;
    reviewCount: number;
    reviewRating: number;
    yearsExperience: number;
    state: string;
    city: string;
  },
  gaps: Array<{ gap: string; impact: string; detail: string }>,
  scores: { unlisted: number; listed: number; audited: number; underwritten: number },
): Promise<MergeFields> {
  const gapList = gaps.map((g, i) => `${i + 1}. ${g.gap} (${g.impact}) -- ${g.detail}`).join('\n');

  const prompt = `You are writing for Top10Lists.us, an independent editorial directory of top real estate agents. Generate personalized email content for ${agentProfile.fullName}.

AGENT PROFILE:
- First name: ${agentProfile.firstName}
- Company: ${agentProfile.company}
- Location: ${agentProfile.city}, ${agentProfile.state}
- ${agentProfile.totalSales} total transactions
- ${agentProfile.reviewCount} reviews at ${agentProfile.reviewRating} stars
- ${agentProfile.yearsExperience} years experience

AICS SCORES:
- Before Top10Lists: ${scores.unlisted}/100
- Listed (current): ${scores.listed}/100
- Audited ($300/mo): ${scores.audited}/100
- Underwritten ($500/mo): ${scores.underwritten}/100

GAPS FOUND (priority order):
${gapList}

Generate these fields as JSON:

1. "subject_line" -- Short, personalized. Use first name. Examples:
   "${agentProfile.firstName}, here's how AI sees you right now"
   "${agentProfile.firstName}, here's how to own your market on AI"
   Pick whichever fits better based on their score. Do NOT use emoji.

2. "opening" -- Exactly 1-2 sentences. Reference their specific numbers (transactions, reviews, years). Be direct, no fluff. Example tone: "509 closed transactions. 58 reviews at 4.9 stars. A 15-year track record in the Maricopa market. You've built a real business -- but right now, when AI is asked for an agent in your area, you're not consistently in the answer." Use -- for dashes.

3. "action_items" -- Array of exactly 3-4 strings. Each is a single concrete action they can take RIGHT NOW, written as a short paragraph (2-3 sentences). Be specific to THIS agent's gaps. Reference their actual website URL, review count, etc. where relevant.

4. "diy_plan" -- Array of objects, one per gap. Each has:
   - "title": Short action title (e.g. "Get a new verified review within 30 days")
   - "description": 2-3 sentences explaining WHY this matters for AI citability and exactly HOW to do it. Be specific.
   - "impact": Point range (e.g. "+6 to +10 pts")
   - "effort": Effort level + time (e.g. "Low -- 1 day")

TONE: Direct, professional, no fluff. Like talking to a successful businessperson who doesn't have time for filler. Use -- for dashes, never em dashes.

Return valid JSON only.`;

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${dsKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2500,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return {
      subject_line: parsed.subject_line || `${agentProfile.firstName}, here's how AI sees you right now`,
      opening: parsed.opening || '',
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
      diy_plan: Array.isArray(parsed.diy_plan) ? parsed.diy_plan : [],
    };
  } catch (err) {
    console.error('DeepSeek merge fields failed:', err);
    return {
      subject_line: `${agentProfile.firstName}, here's how AI sees you right now`,
      opening: '',
      action_items: [],
      diy_plan: [],
    };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const EXA_API_KEY      = Deno.env.get('EXA_API_KEY') ?? '';
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? '';

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const body = await req.json();
    const { professional_id, force_exa } = body;
    if (!professional_id) throw new Error('professional_id is required');

    console.log(`GEO audit starting: ${professional_id}`);

    // ── 1. PULL AGENT ────────────────────────────────────────────────────────
    const { data: agent, error: agentErr } = await supabase
      .from('professionals')
      .select(`
        id, name, company, license_number, years_experience, total_sales,
        review_stars_rating, num_total_reviews, most_recent_review_date,
        description, website, current_tier, state_slug, short_code,
        agent_sales_stats, professional_information, has_recent_review,
        social_linkedin, social_facebook, social_instagram, social_twitter,
        zillow_profile_url, email, business_city
      `)
      .eq('id', professional_id)
      .single();

    if (agentErr || !agent) throw new Error(`Agent not found: ${agentErr?.message}`);

    const salesStats = (agent.agent_sales_stats as Record<string, number>) || {};
    const salesLast12mo = salesStats.countLast12Months || salesStats.countLastYear || 0;
    const totalSales = salesStats.countAllTime || agent.total_sales || 0;

    // ── 2. REVIEW RECENCY ────────────────────────────────────────────────────
    let mostRecentDate: string | null = agent.most_recent_review_date;
    if (!mostRecentDate) {
      const pi = (agent.professional_information as Record<string, any>) || {};
      const reviews = (pi.recentReviews || []) as Array<Record<string, string>>;
      const sorted = reviews.filter((r: any) => r.date)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sorted.length > 0) mostRecentDate = sorted[0].date;
    }
    const recency = recencyScore(mostRecentDate);
    const stateLabel = agent.state_slug === 'california' ? 'California' : 'Arizona';

    // ── 3. EXA SOURCES (reuse existing if available, unless force_exa) ───────
    let exaSources: string[] = [];
    if (!force_exa) {
      const { data: existing } = await supabase
        .from('geo_audit_results')
        .select('exa_sources')
        .eq('agent_id', professional_id)
        .maybeSingle();
      if (existing?.exa_sources && (existing.exa_sources as string[]).length > 0) {
        exaSources = existing.exa_sources as string[];
        console.log(`Reusing ${exaSources.length} cached Exa sources`);
      }
    }
    if (exaSources.length === 0 && EXA_API_KEY) {
      exaSources = await exaSearch(agent.name, stateLabel, agent.company || '', EXA_API_KEY);
      console.log(`Fresh Exa search: ${exaSources.length} sources`);
    }

    // ── 4. PLATFORM DETECTION (combine DB social links + Exa) ────────────────
    const sl = exaSources.map(s => s.toLowerCase());

    // From DB fields (ground truth -- these are confirmed links)
    const dbLinkedin  = !!agent.social_linkedin;
    const dbFacebook  = !!agent.social_facebook;
    const dbInstagram = !!agent.social_instagram;
    const dbZillow    = !!agent.zillow_profile_url;

    // From Exa (discovered presence)
    const exaRealtor   = sl.some(s => s.includes('realtor.com'));
    const exaLinkedin  = sl.some(s => s.includes('linkedin'));
    const exaFacebook  = sl.some(s => s.includes('facebook'));
    const exaHomelight = sl.some(s => s.includes('homelight'));
    const exaTop10     = sl.some(s => s.includes('top10lists'));
    const exaHomescom  = sl.some(s => s.includes('homes.com'));
    const exaGoogleBiz = sl.some(s => s.includes('maps.google') || s.includes('google.com/maps') || s.includes('business.google'));

    // Merge: DB social links override Exa (if we have it in DB, it's confirmed)
    const hasLinkedin    = dbLinkedin || exaLinkedin;
    const hasFacebook    = dbFacebook || exaFacebook;
    const hasRealtor     = exaRealtor;
    const hasHomelight   = exaHomelight;
    const hasTop10       = exaTop10;
    const hasHomescom    = exaHomescom;
    const hasGoogleBiz   = exaGoogleBiz;

    const pressMentions = sl.filter(s =>
      !['zillow','realtor','linkedin','facebook','homelight','top10lists','google','homes.com','instagram','twitter','yelp'].some(x => s.includes(x))
    ).length;

    // ── 5. WEBSITE CRAWL (check schema + crawlability) ───────────────────────
    const websiteReal = !!(agent.website && !agent.website.includes('zillow') &&
      !agent.website.includes('realtor.com') && agent.website.startsWith('http'));

    let hasPersonalSite = false;
    let hasSchemaMarkup = false;
    let schemaTypes: string[] = [];
    let websiteCrawlable = false;

    if (websiteReal) {
      console.log(`Crawling website: ${agent.website}`);
      const crawl = await crawlWebsite(agent.website);
      websiteCrawlable = crawl.crawlable;
      hasSchemaMarkup = crawl.hasSchema;
      schemaTypes = crawl.schemaTypes;

      // Check if Exa found the site too
      try {
        const domain = new URL(agent.website).hostname.replace('www.', '');
        hasPersonalSite = websiteCrawlable || sl.some(s => s.includes(domain));
      } catch { hasPersonalSite = websiteCrawlable; }
    }

    // ── 6. MERIT GATE ────────────────────────────────────────────────────────
    const failures: string[] = [];
    if ((agent.review_stars_rating || 0) < 4.5) failures.push(`Stars: ${agent.review_stars_rating} (need 4.5+)`);
    if ((agent.num_total_reviews   || 0) < 10)  failures.push(`Reviews: ${agent.num_total_reviews} (need 10+)`);
    if ((agent.years_experience    || 0) < 5)   failures.push(`Years: ${agent.years_experience} (need 5+)`);

    // ── 7. COMPUTE SCORES ────────────────────────────────────────────────────
    const sig = {
      name:                agent.name,
      license_number:      agent.license_number,
      company:             agent.company,
      years_experience:    agent.years_experience || 0,
      total_sales:         totalSales,
      sales_last_12mo:     salesLast12mo,
      review_stars_rating: agent.review_stars_rating || 0,
      num_total_reviews:   agent.num_total_reviews || 0,
      description:         agent.description || '',
      recencyScore:        recency.score,
      hasPersonalSite,
      websiteCrawlable,
      hasSchemaMarkup,
      hasLinkedin,
      hasFacebook,
      hasRealtor,
      hasHomelight,
      hasGoogleBusiness:   hasGoogleBiz,
      exaSourceCount:      Math.min(5, exaSources.length),
      pressMentions,
    };

    const scores = {
      unlisted:     computeScore(sig, recency.score, false, 0),
      listed:       computeScore(sig, 2,             true,  0),
      audited:      computeScore(sig, 8,             true,  8),
      underwritten: computeScore(sig, 10,            true,  14),
    };

    // ── 8. IDENTIFY GAPS ─────────────────────────────────────────────────────
    const gaps: Array<{ gap: string; impact: string; detail: string }> = [];

    if (recency.score < 4) {
      const reviewAge = recency.label;
      gaps.push({
        gap: "Stale reviews",
        impact: "+6 to +10 pts",
        detail: `Most recent review: ${reviewAge}. ${agent.num_total_reviews || 0} total reviews but recency signal is ${recency.score}/10. A single review in the last 30 days would unlock full recency.`,
      });
    }
    if (!hasGoogleBiz) {
      gaps.push({
        gap: "No Google Business Profile",
        impact: "+4 to +7 pts",
        detail: "Google Business Profile not found in AI scans. One of the highest-weighted citation sources.",
      });
    }
    if (!hasSchemaMarkup && websiteReal) {
      gaps.push({
        gap: "No JSON-LD schema on website",
        impact: "+3 to +5 pts",
        detail: `Website ${agent.website} is crawlable but has no RealEstateAgent structured data. AI can't machine-read the profile.${schemaTypes.length > 0 ? ` Found schema types: ${schemaTypes.join(', ')} -- but none are agent-specific.` : ''}`,
      });
    }
    if (!hasPersonalSite && !websiteReal) {
      gaps.push({
        gap: "No personal/business website",
        impact: "+5 to +8 pts",
        detail: "No personal or team website found. This eliminates the identity pillar website bonus and schema markup opportunity.",
      });
    }
    if (pressMentions === 0) {
      gaps.push({
        gap: "No press mentions",
        impact: "+3 to +6 pts",
        detail: "No third-party press or editorial mentions found in Exa scan. Press mentions are uniquely high-trust citation signals.",
      });
    }
    if (!hasLinkedin) {
      gaps.push({
        gap: "No LinkedIn presence",
        impact: "+2 to +3 pts",
        detail: "LinkedIn profile not found. Contributes to identity pillar as a professional verification signal.",
      });
    }
    if (!hasRealtor) {
      gaps.push({
        gap: "Realtor.com profile not indexed",
        impact: "+2 to +4 pts",
        detail: "Realtor.com profile not surfacing in AI scans. Both social and tech pillars are affected.",
      });
    }
    if (!hasHomescom) {
      gaps.push({
        gap: "Homes.com profile not indexed",
        impact: "+1 to +2 pts",
        detail: "Homes.com profile not found. It's indexed by ChatGPT and Perplexity directly.",
      });
    }
    if ((agent.num_total_reviews || 0) < 10) {
      const needed = 10 - (agent.num_total_reviews || 0);
      gaps.push({
        gap: `Need ${needed} more verified reviews`,
        impact: "+4 to +8 pts",
        detail: `Currently ${agent.num_total_reviews || 0} reviews. Merit gate requires 10+. Social pillar scales with review count.`,
      });
    }

    // Sort by estimated impact (parse first number)
    gaps.sort((a, b) => {
      const aNum = parseInt(a.impact.replace(/\D/g, ''));
      const bNum = parseInt(b.impact.replace(/\D/g, ''));
      return bNum - aNum;
    });

    // ── 9. AI PERCEPTION QUERIES ───────────────────────────────────────────────
    // Ask DeepSeek what it knows about this agent — we give the answers to them.
    const city = agent.business_city || stateLabel;
    let aiPerception: AiPerception = { namedResult: '', namedConfirmed: false, unpromotedResult: '', unpromotedNamed: false };

    if (DEEPSEEK_API_KEY) {
      console.log(`AI perception: querying for ${agent.name} in ${city}, ${stateLabel}`);
      aiPerception = await queryAiPerception(DEEPSEEK_API_KEY, agent.name, city, stateLabel);
      console.log(`AI perception: named=${aiPerception.namedConfirmed}, unprompted=${aiPerception.unpromotedNamed}`);
    }

    // ── 10. DEEPSEEK MERGE FIELDS ──────────────────────────────────────────────
    const firstName = agent.name.split(' ')[0];
    let merge: MergeFields = {
      subject_line: `${firstName}, here's how AI sees you right now`,
      opening: '',
      action_items: [],
      diy_plan: [],
    };

    if (DEEPSEEK_API_KEY && gaps.length > 0) {
      console.log(`DeepSeek: generating merge fields for ${gaps.length} gaps`);
      merge = await generateMergeFields(
        DEEPSEEK_API_KEY,
        {
          firstName,
          fullName: agent.name,
          company: agent.company || 'Independent',
          totalSales,
          reviewCount: agent.num_total_reviews || 0,
          reviewRating: agent.review_stars_rating || 0,
          yearsExperience: agent.years_experience || 0,
          state: stateLabel,
          city,
        },
        gaps,
        {
          unlisted: scores.unlisted.total,
          listed: scores.listed.total,
          audited: scores.audited.total,
          underwritten: scores.underwritten.total,
        },
      );
    }

    // Build DFY service list (what we do for them at paid tiers)
    const remDFY = [
      !hasSchemaMarkup && websiteReal ? "JSON-LD RealEstateAgent schema implementation" : null,
      !hasGoogleBiz ? "Google Business Profile setup and optimization" : null,
      (agent.num_total_reviews || 0) < 10
        ? `Review generation campaign (need ${10 - (agent.num_total_reviews || 0)} more)`
        : recency.score < 4 ? "Review freshness campaign" : null,
      "NAP normalization across all directories",
      pressMentions === 0 ? "Press mention outreach and placement" : null,
      !hasHomescom ? "Homes.com profile creation/optimization" : null,
      "Citation graph optimization",
      "Delivery gate: AICS re-audit post-completion with verified score",
    ].filter(Boolean).join('\n');

    // Flatten diy_plan for text storage
    const remDIY = merge.diy_plan.length > 0
      ? merge.diy_plan.map((d, i) =>
          `${i + 1}. ${d.title} (${d.impact})\n   ${d.description}\n   Effort: ${d.effort}`
        ).join('\n\n')
      : gaps.map((g, i) => `${i + 1}. ${g.gap} (${g.impact})\n   ${g.detail}`).join('\n\n');

    // ── 10. SAVE ─────────────────────────────────────────────────────────────
    await supabase.from('geo_audit_results').upsert({
      agent_id:              professional_id,
      full_name:             agent.name,
      first_name:            firstName,
      email:                 agent.email || null,
      brokerage:             agent.company,
      website:               agent.website || null,
      most_recent_review_date: mostRecentDate,
      social_linkedin:       agent.social_linkedin || null,
      state_slug:            agent.state_slug || null,
      current_tier:          agent.current_tier || null,
      artifact_url:          agent.short_code ? `https://www.top10lists.us/artifact/${agent.short_code}` : null,
      audited_at:            new Date().toISOString(),
      status:                'complete',
      aics_version:          'v1',
      score_current:         scores.unlisted.total,
      score_unlisted:        scores.unlisted.total,
      score_listed:          scores.listed.total,
      score_audited:         scores.audited.total,
      score_underwritten:    scores.underwritten.total,
      score_lift_to_audited:      scores.audited.total - scores.unlisted.total,
      score_lift_to_underwritten: scores.underwritten.total - scores.unlisted.total,
      pillar_identity:       scores.unlisted.identity,
      pillar_authority:      scores.unlisted.authority,
      pillar_social:         scores.unlisted.social,
      pillar_technical:      scores.unlisted.tech,
      pillar_citability:     scores.unlisted.citable,
      recency_score:         recency.score,
      recency_label:         recency.label,
      most_recent_signal:    mostRecentDate,
      review_count:          agent.num_total_reviews,
      review_rating:         agent.review_stars_rating,
      exa_sources:           exaSources,
      exa_source_count:      exaSources.length,
      platforms_found:       exaSources,
      has_zillow:            dbZillow || sl.some(s => s.includes('zillow')),
      has_realtor:           hasRealtor,
      has_linkedin:          hasLinkedin,
      has_facebook:          hasFacebook,
      has_homelight:         hasHomelight,
      has_top10:             hasTop10,
      has_personal_site:     hasPersonalSite,
      has_schema_markup:     hasSchemaMarkup,
      has_google_business:   hasGoogleBiz,
      has_homes_com:         hasHomescom,
      schema_types_found:    schemaTypes,
      website_crawled:       websiteReal ? agent.website : null,
      website_crawlable:     websiteCrawlable,
      gap_stale_reviews:     recency.score < 4,
      gap_no_linkedin:       !hasLinkedin,
      gap_no_schema:         !hasSchemaMarkup,
      gap_no_realtor:        !hasRealtor,
      gap_no_homelight:      !hasHomelight,
      gap_no_press:          pressMentions === 0,
      gap_no_personal_site:  !hasPersonalSite,
      gap_no_google_business: !hasGoogleBiz,
      gap_no_homes_com:      !hasHomescom,
      merit_gate_pass:       failures.length === 0,
      merit_gate_failures:   failures,
      first_name:            firstName,
      subject_line:          merge.subject_line,
      opening:               merge.opening,
      action_items:          merge.action_items,
      diy_plan:              merge.diy_plan,
      remediation_plan:      remDIY,
      remediation_diy:       remDIY,
      remediation_dfy:       remDFY,
      email_body:            merge.opening,
      gaps_found:            gaps,
      gpt_unprompted_result: aiPerception.unpromotedResult,
      gpt_unprompted_named:  aiPerception.unpromotedNamed,
      gpt_named_result:      aiPerception.namedResult,
      gpt_named_confirmed:   aiPerception.namedConfirmed,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'agent_id' });

    // ── 12. RETURN ───────────────────────────────────────────────────────────
    return new Response(JSON.stringify({
      success:    true,
      agent:      agent.name,
      email:      agent.email,
      city,
      audit_date: new Date().toISOString().split('T')[0],
      recency:    { score: recency.score, label: recency.label, most_recent: mostRecentDate },
      merit_gate: { pass: failures.length === 0, failures },
      exa:        { source_count: exaSources.length, sources: exaSources },
      crawl:      { website: agent.website, crawlable: websiteCrawlable, hasSchema: hasSchemaMarkup, schemaTypes },
      platforms:  { linkedin: hasLinkedin, facebook: hasFacebook, realtor: hasRealtor, homelight: hasHomelight, top10: hasTop10, homescom: hasHomescom, googleBiz: hasGoogleBiz, zillow: dbZillow || sl.some(s => s.includes('zillow')) },
      scores: {
        unlisted:     { score: scores.unlisted.total,     band: band(scores.unlisted.total) },
        listed:       { score: scores.listed.total,       band: band(scores.listed.total) },
        audited:      { score: scores.audited.total,      band: band(scores.audited.total) },
        underwritten: { score: scores.underwritten.total, band: band(scores.underwritten.total) },
      },
      pillars: scores.unlisted,
      gaps,
      ai_perception: {
        named_query: `I have heard ${agent.name} is a top real estate agent in ${city}, ${stateLabel}. What can you tell me about them and their track record?`,
        named_result: aiPerception.namedResult,
        named_confirmed: aiPerception.namedConfirmed,
        unprompted_query: `Who is the best real estate agent in ${city}, ${stateLabel} for buying a luxury home? I want someone with at least 5 years of experience. Give me a specific name and explain why.`,
        unprompted_result: aiPerception.unpromotedResult,
        unprompted_named: aiPerception.unpromotedNamed,
      },
      merge_fields: {
        subject_line: merge.subject_line,
        opening: merge.opening,
        action_items: merge.action_items,
        diy_plan: merge.diy_plan,
      },
      remediation_dfy: remDFY,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('GEO audit error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
