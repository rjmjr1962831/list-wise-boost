// geo-footprint-audit
// Runs a full AICS v1 audit for a single agent:
//   1. Pull agent data from Supabase
//   2. Exa search -- source breadth + recency
//   3. GPT-4o -- unprompted query + name confirmation
//   4. Compute AICS scores across all four tiers
//   5. Generate personalized DIY remediation document
//   6. Save to geo_audit_results, return full report

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

// ─── RECENCY MODEL ───────────────────────────────────────────
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

// ─── BAND LABELS ─────────────────────────────────────────────
function band(score: number): string {
  if (score <= 30) return "Effectively invisible to AI";
  if (score <= 50) return "Discoverable, not citable";
  if (score <= 70) return "Citable in general queries";
  if (score <= 85) return "Citable in specific local queries";
  return "Authoritative citation candidate";
}

function cap(score: number): number {
  return Math.min(97, score);
}

// ─── AICS SCORING ENGINE ──────────────────────────────────────
function computeScore(agent: Record<string, any>, tierRecency: number, hasTop10: boolean, tierBonuses: number) {
  // IDENTITY (20 pts)
  let identity = 0;
  if (agent.license_number) identity += 5;
  if (agent.company)        identity += 5;
  if (agent.hasPersonalSite) identity += 5;
  if (agent.hasLinkedin)    identity += 3;
  if (hasTop10)             identity += 2;

  // AUTHORITY (25 pts)
  let authority = 0;
  authority += Math.min(10, Math.floor((agent.years_experience || 0) / 2));
  authority += Math.min(8,  Math.floor((agent.total_sales || 0) / 30));
  if (agent.description && agent.description.length > 50) authority += 5;
  const s12 = agent.sales_last_12mo || 0;
  if (s12 >= 5)      authority += Math.round(2 * (tierRecency / 10));
  else if (s12 >= 1) authority += Math.round(1 * (tierRecency / 10));

  // SOCIAL PROOF (25 pts -- fully recency weighted)
  let social = 0;
  const rc = agent.num_total_reviews || 0;
  const rr = agent.review_stars_rating || 0;
  social += Math.round(Math.min(10, rc) * (tierRecency / 10));
  if (rr) social += Math.round(Math.max(0, rr - 3.5) * 5.3 * (tierRecency / 10));
  if (agent.hasRealtor)   social += 4;
  if (agent.hasHomelight) social += 3;

  // TECHNICAL (15 pts)
  let tech = 0;
  if (agent.websiteCrawlable)  tech += 5;
  if (!agent.hasSchemaMarkup)  tech -= 2;
  if (agent.hasRealtor)        tech += 3;
  if (agent.hasHomelight)      tech += 2;
  if (agent.hasFacebook)       tech += 2;
  if (hasTop10)                tech += 3;

  // CITABILITY (15 pts -- recency weighted)
  let citable = 0;
  citable += Math.min(5, agent.exaSourceCount || 0);
  citable += Math.min(3, (agent.pressMentions || 0) * 2);
  if (hasTop10) citable += 7;
  citable = Math.round(citable * (0.4 + 0.6 * (tierRecency / 10)));

  const total = cap(identity + authority + social + tech + citable + tierBonuses);
  return { identity, authority, social, tech, citable, bonuses: tierBonuses, total };
}

// ─── REMEDIATION GENERATOR ───────────────────────────────────
function buildRemediationDoc(agent: Record<string, any>, scores: Record<string, any>, exaSources: string[]): string {
  const gaps: Array<{ action: string; impact: number; effort: string }> = [];

  if (!agent.hasSchemaMarkup) {
    gaps.push({ action: "Add JSON-LD RealEstateAgent schema to your website homepage", impact: 3, effort: "Low -- give this doc to your web developer or SEO team" });
  }
  if (!agent.hasGoogleBusiness) {
    gaps.push({ action: "Claim and complete your Google Business Profile", impact: 5, effort: "Low -- free, takes 30 minutes" });
  }
  const reviewsNeeded = Math.max(0, 10 - (agent.num_total_reviews || 0));
  if (reviewsNeeded > 0) {
    gaps.push({ action: `Get ${reviewsNeeded} verified reviews on Google or Realtor.com in the next 24 months`, impact: 8, effort: "Medium -- requires outreach to recent clients" });
  } else if ((agent.recencyScore || 0) < 4) {
    gaps.push({ action: "Your reviews are stale -- ask your most recent client for a fresh review today", impact: 6, effort: "Low -- one email or text to a recent client" });
  }
  if ((agent.pressMentions || 0) === 0) {
    gaps.push({ action: "Get one press mention -- local newspaper, neighborhood blog, or market report quote", impact: 3, effort: "Medium -- reach out to a local real estate reporter" });
  }
  if (!agent.hasLinkedin) {
    gaps.push({ action: "Create or complete your LinkedIn profile with current brokerage and transaction history", impact: 2, effort: "Low -- free, takes 1 hour" });
  }
  if (!agent.hasGoogleBusiness) {
    gaps.push({ action: "Add your phone, address, and hours to every directory profile (NAP consistency)", impact: 2, effort: "Low -- audit Realtor.com, HomeLight, Yelp, Bing Places" });
  }

  gaps.sort((a, b) => b.impact - a.impact);

  let doc = `YOUR PERSONALIZED GEO REMEDIATION PLAN\n`;
  doc += `Generated: ${new Date().toISOString().split('T')[0]}\n`;
  doc += `Agent: ${agent.name}\n`;
  doc += `Current AICS: ${scores.unlisted.total}/97\n\n`;
  doc += `WHAT AI CAN SEE TODAY (${exaSources.length} sources found):\n`;
  exaSources.forEach(s => { doc += `  - ${s}\n`; });
  doc += `\nYOUR ACTION LIST (highest impact first):\n\n`;
  gaps.forEach((g, i) => {
    doc += `${i + 1}. ${g.action}\n`;
    doc += `   Estimated AICS impact: +${g.impact} pts\n`;
    doc += `   Effort: ${g.effort}\n\n`;
  });

  const totalLift = gaps.reduce((sum, g) => sum + g.impact, 0);
  doc += `If you complete all items above, your estimated AICS could reach: ${cap(scores.unlisted.total + totalLift)}/97\n`;
  doc += `With a Top10Lists Audited profile, your projected AICS is: ${scores.audited.total}/97\n\n`;
  doc += `NOTE: These are projections based on publicly available signals. Actual results vary by market competitiveness.\n`;

  return doc;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const EXA_API_KEY     = Deno.env.get('EXA_API_KEY')!;
    const OPENAI_API_KEY  = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const body = await req.json();
    const { professional_id } = body;
    if (!professional_id) throw new Error('professional_id is required');

    console.log(`Starting GEO audit for ${professional_id}`);

    // ── 1. PULL AGENT DATA ──────────────────────────────────
    const { data: agent, error: agentErr } = await supabase
      .from('professionals')
      .select(`id, name, company, license_number, years_experience, total_sales,
               review_stars_rating, num_total_reviews, most_recent_review_date,
               description, website, current_tier, state_slug,
               agent_sales_stats, professional_information, has_recent_review`)
      .eq('id', professional_id)
      .single();

    if (agentErr || !agent) throw new Error(`Agent not found: ${agentErr?.message}`);
    console.log(`Agent loaded: ${agent.name}`);

    // Parse sales last 12mo from agent_sales_stats
    const salesStats = agent.agent_sales_stats as Record<string, any> || {};
    const salesLast12mo = salesStats.countLast12Months || 0;

    // Parse most recent review date -- check professional_information.recentReviews too
    let mostRecentReviewDate: string | null = agent.most_recent_review_date;
    if (!mostRecentReviewDate) {
      const profInfo = agent.professional_information as Record<string, any> || {};
      const reviews = profInfo.recentReviews || [];
      if (reviews.length > 0) {
        // Sort by date descending, take first
        const sorted = reviews
          .filter((r: any) => r.date)
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        if (sorted.length > 0) mostRecentReviewDate = sorted[0].date;
      }
    }

    const recency = recencyScore(mostRecentReviewDate);
    const websiteIsReal = agent.website &&
      !agent.website.includes('zillow') &&
      !agent.website.includes('realtor.com') &&
      agent.website.startsWith('http');

    // ── 2. EXA SEARCH ──────────────────────────────────────
    const agentCity = agent.state_slug === 'california' ? 'California' : 'Arizona';
    const exaQuery = `${agent.name} real estate agent ${agentCity} ${agent.company || ''}`.trim();

    console.log(`Running Exa search: ${exaQuery}`);
    const exaRes = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': EXA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: exaQuery, num_results: 10, use_autoprompt: true })
    });
    const exaData = await exaRes.json();
    const exaSources: string[] = (exaData.results || []).map((r: any) => r.url);
    console.log(`Exa found ${exaSources.length} sources`);

    // Parse source flags
    const sl = exaSources.map(s => s.toLowerCase());
    const hasZillow        = sl.some(s => s.includes('zillow'));
    const hasRealtor       = sl.some(s => s.includes('realtor.com'));
    const hasLinkedin      = sl.some(s => s.includes('linkedin'));
    const hasFacebook      = sl.some(s => s.includes('facebook'));
    const hasHomelight     = sl.some(s => s.includes('homelight'));
    const hasTop10         = sl.some(s => s.includes('top10lists'));
    const hasGoogleBusiness = sl.some(s => s.includes('google') || s.includes('maps.google'));
    const hasPersonalSite  = websiteIsReal
      ? sl.some(s => {
          try {
            const domain = new URL(agent.website).hostname.replace('www.', '');
            return s.includes(domain);
          } catch { return false; }
        })
      : false;
    const pressMentions = sl.filter(s =>
      !['zillow','realtor','linkedin','facebook','homelight','top10lists','google'].some(x => s.includes(x)) &&
      !(hasPersonalSite && agent.website && s.includes(new URL(agent.website).hostname.replace('www.','')))
    ).length;

    // ── 3. GPT QUERIES ─────────────────────────────────────
    const marketCity = agent.state_slug === 'california' ? 'California' : 'Arizona';

    const gptUnpromptedQ = `Who is the best real estate agent in ${marketCity} for buying a home? Give me a specific name and explain why.`;
    const gptNamedQ = `I have heard ${agent.name} is a top real estate agent. What can you tell me about them and their track record?`;

    console.log('Running GPT queries...');
    const [gptUnpromptedRes, gptNamedRes] = await Promise.all([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: gptUnpromptedQ }],
          max_tokens: 300
        })
      }),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: gptNamedQ }],
          max_tokens: 300
        })
      })
    ]);

    const gptUnpromptedData = await gptUnpromptedRes.json();
    const gptNamedData      = await gptNamedRes.json();
    const gptUnpromptedText = gptUnpromptedData.choices?.[0]?.message?.content || '';
    const gptNamedText      = gptNamedData.choices?.[0]?.message?.content || '';

    // Check if named in unprompted result
    const agentFirstLast = agent.name.toLowerCase().split(' ');
    const gptNamed = agentFirstLast.length >= 2 &&
      gptUnpromptedText.toLowerCase().includes(agentFirstLast[0]) &&
      gptUnpromptedText.toLowerCase().includes(agentFirstLast[agentFirstLast.length - 1]);

    // Check if GPT confirmed identity when asked directly
    const gptConfirmed = !gptNamedText.toLowerCase().includes("don't have") &&
      !gptNamedText.toLowerCase().includes("cannot find") &&
      !gptNamedText.toLowerCase().includes("no specific") &&
      !gptNamedText.toLowerCase().includes("go google") &&
      gptNamedText.length > 100;

    console.log(`GPT unprompted named agent: ${gptNamed}`);
    console.log(`GPT name confirmation: ${gptConfirmed}`);

    // ── 4. MERIT GATE ──────────────────────────────────────
    const gateFailures: string[] = [];
    const stars   = agent.review_stars_rating || 0;
    const reviews = agent.num_total_reviews || 0;
    const years   = agent.years_experience || 0;
    if (stars   < 4.5) gateFailures.push(`Stars: ${stars} (need 4.5+)`);
    if (reviews < 10)  gateFailures.push(`Reviews: ${reviews} (need 10+ in last 24mo)`);
    if (years   < 5)   gateFailures.push(`Years: ${years} (need 5+)`);
    const meritGatePass = gateFailures.length === 0;

    // ── 5. COMPUTE AICS SCORES ─────────────────────────────
    const agentSignals = {
      name:                agent.name,
      license_number:      agent.license_number,
      company:             agent.company,
      years_experience:    agent.years_experience || 0,
      total_sales:         salesStats.countAllTime || agent.total_sales || 0,
      sales_last_12mo:     salesLast12mo,
      review_stars_rating: agent.review_stars_rating || 0,
      num_total_reviews:   agent.num_total_reviews || 0,
      description:         agent.description || '',
      recencyScore:        recency.score,
      hasPersonalSite,
      websiteCrawlable:    hasPersonalSite,
      hasSchemaMarkup:     false,  // would need website crawl to confirm
      hasLinkedin,
      hasFacebook,
      hasRealtor,
      hasHomelight,
      hasGoogleBusiness,
      exaSourceCount:      Math.min(5, exaSources.length),
      pressMentions,
    };

    const scores = {
      unlisted:     computeScore(agentSignals, recency.score, false, 0),
      listed:       computeScore(agentSignals, 2,             true,  0),
      audited:      computeScore(agentSignals, 8,             true,  8),
      underwritten: computeScore(agentSignals, 10,            true,  14),
    };

    // ── 6. REMEDIATION DOCUMENT ────────────────────────────
    const remediationDIY = buildRemediationDoc(agentSignals, scores, exaSources);

    // DFY scope summary
    const dfyScope = [
      !agentSignals.hasSchemaMarkup   ? "Implement JSON-LD RealEstateAgent schema" : null,
      !agentSignals.hasGoogleBusiness ? "Claim and optimize Google Business Profile" : null,
      reviews < 10 ? `Review generation campaign (need ${10 - reviews} more)` : "Review freshness campaign",
      "NAP normalization across all indexed directories",
      pressMentions === 0 ? "Press mention outreach and placement" : null,
      "Citation graph optimization",
      "Quarterly AICS re-audit with score delivery gate",
    ].filter(Boolean).join('\n');

    // ── 7. SAVE TO DATABASE ────────────────────────────────
    const auditRecord = {
      agent_id:              professional_id,
      full_name:             agent.name,
      brokerage:             agent.company,
      audited_at:            new Date().toISOString(),
      status:                'complete',
      aics_version:          'v1',
      // Scores
      score_current:         scores.unlisted.total,
      score_unlisted:        scores.unlisted.total,
      score_listed:          scores.listed.total,
      score_audited:         scores.audited.total,
      score_underwritten:    scores.underwritten.total,
      // Pillars
      pillar_identity:       scores.unlisted.identity,
      pillar_authority:      scores.unlisted.authority,
      pillar_social:         scores.unlisted.social,
      pillar_technical:      scores.unlisted.tech,
      pillar_citability:     scores.unlisted.citable,
      // Recency
      recency_score:         recency.score,
      recency_label:         recency.label,
      most_recent_signal:    mostRecentReviewDate,
      // Reviews
      review_count:          reviews,
      review_rating:         stars,
      // Exa
      exa_sources:           exaSources,
      exa_source_count:      exaSources.length,
      platforms_found:       exaSources,
      // GPT
      gpt_unprompted_result: gptUnpromptedText,
      gpt_unprompted_named:  gptNamed,
      gpt_named_result:      gptNamedText,
      gpt_named_confirmed:   gptConfirmed,
      // Merit gate
      merit_gate_pass:       meritGatePass,
      merit_gate_failures:   gateFailures,
      // Remediation
      remediation_plan:      remediationDIY,
      remediation_diy:       remediationDIY,
      remediation_dfy:       dfyScope,
      updated_at:            new Date().toISOString(),
    };

    const { error: saveErr } = await supabase
      .from('geo_audit_results')
      .upsert(auditRecord, { onConflict: 'agent_id' });

    if (saveErr) console.error('Save error:', saveErr.message);
    else console.log('Audit saved successfully');

    // ── 8. RETURN FULL REPORT ──────────────────────────────
    return new Response(JSON.stringify({
      success: true,
      agent: agent.name,
      audit_date: new Date().toISOString().split('T')[0],
      recency: { score: recency.score, label: recency.label, most_recent: mostRecentReviewDate },
      merit_gate: { pass: meritGatePass, failures: gateFailures },
      exa: { source_count: exaSources.length, sources: exaSources },
      gpt: {
        unprompted_named: gptNamed,
        unprompted_result: gptUnpromptedText,
        named_confirmed: gptConfirmed,
        named_result: gptNamedText,
      },
      scores: {
        unlisted:     { score: scores.unlisted.total,     band: band(scores.unlisted.total) },
        listed:       { score: scores.listed.total,       band: band(scores.listed.total) },
        audited:      { score: scores.audited.total,      band: band(scores.audited.total) },
        underwritten: { score: scores.underwritten.total, band: band(scores.underwritten.total) },
      },
      pillars: scores.unlisted,
      remediation_diy: remediationDIY,
      remediation_dfy: dfyScope,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Audit error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
