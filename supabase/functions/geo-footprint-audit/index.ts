import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const total = Math.min(97, identity + authority + social + tech + citable + bonus);
  return { identity, authority, social, tech, citable, bonuses: bonus, total };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRemediation(a: any, scores: any, exaSources: string[]): string {
  const gaps: Array<{ action: string; impact: number; effort: string }> = [];
  if (!a.hasSchemaMarkup)    gaps.push({ action: "Add JSON-LD RealEstateAgent schema to your website", impact: 3, effort: "Low -- hand to your web developer" });
  if (!a.hasGoogleBusiness)  gaps.push({ action: "Claim and complete your Google Business Profile", impact: 5, effort: "Low -- free, 30 minutes" });
  const reviewsNeeded = Math.max(0, 10 - (a.num_total_reviews || 0));
  if (reviewsNeeded > 0) {
    gaps.push({ action: `Get ${reviewsNeeded} verified reviews on Google or Realtor.com in the next 24 months`, impact: 8, effort: "Medium -- outreach to recent clients" });
  } else if ((a.recencyScore || 0) < 4) {
    gaps.push({ action: "Your reviews are stale -- ask your most recent client for a fresh review today", impact: 6, effort: "Low -- one email or text" });
  }
  if ((a.pressMentions || 0) === 0) gaps.push({ action: "Get one press mention -- local newspaper, market report quote", impact: 3, effort: "Medium -- reach out to a local reporter" });
  if (!a.hasLinkedin)  gaps.push({ action: "Complete your LinkedIn profile with current brokerage and transaction history", impact: 2, effort: "Low -- free, 1 hour" });
  gaps.sort((x, y) => y.impact - x.impact);

  let doc = `YOUR PERSONALIZED GEO REMEDIATION PLAN\n`;
  doc += `Generated: ${new Date().toISOString().split('T')[0]}\n`;
  doc += `Agent: ${a.name}\n`;
  doc += `Current AICS: ${scores.unlisted.total}/97  (${band(scores.unlisted.total)})\n\n`;
  doc += `WHAT AI CAN SEE TODAY (${exaSources.length} sources):\n`;
  exaSources.forEach(s => { doc += `  - ${s}\n`; });
  doc += `\nACTION LIST (highest impact first):\n\n`;
  gaps.forEach((g, i) => {
    doc += `${i + 1}. ${g.action}\n   Impact: +${g.impact} pts  |  Effort: ${g.effort}\n\n`;
  });
  const lift = gaps.reduce((sum, g) => sum + g.impact, 0);
  doc += `Completing all items above could increase your AICS to: ~${Math.min(97, scores.unlisted.total + lift)}/97\n`;
  doc += `With Top10Lists Audited, your projected AICS is: ${scores.audited.total}/97\n\n`;
  doc += `NOTE: These are projections. Actual results vary by market competitiveness.\n`;
  return doc;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const EXA_API_KEY    = Deno.env.get('EXA_API_KEY') ?? '';
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const body = await req.json();
    const { professional_id } = body;
    if (!professional_id) throw new Error('professional_id is required');

    console.log(`GEO audit starting: ${professional_id}`);

    // 1. PULL AGENT
    const { data: agent, error: agentErr } = await supabase
      .from('professionals')
      .select('id,name,company,license_number,years_experience,total_sales,review_stars_rating,num_total_reviews,most_recent_review_date,description,website,current_tier,state_slug,agent_sales_stats,professional_information,has_recent_review')
      .eq('id', professional_id)
      .single();

    if (agentErr || !agent) throw new Error(`Agent not found: ${agentErr?.message}`);

    const salesStats = (agent.agent_sales_stats as Record<string, number>) || {};
    const salesLast12mo = salesStats.countLast12Months || 0;
    const totalSales = salesStats.countAllTime || agent.total_sales || 0;

    // Best review date
    let mostRecentDate: string | null = agent.most_recent_review_date;
    if (!mostRecentDate) {
      const pi = (agent.professional_information as Record<string, any>) || {};
      const reviews = (pi.recentReviews || []) as Array<Record<string, string>>;
      const sorted = reviews.filter(r => r.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sorted.length > 0) mostRecentDate = sorted[0].date;
    }

    const recency = recencyScore(mostRecentDate);
    const websiteReal = !!(agent.website && !agent.website.includes('zillow') && !agent.website.includes('realtor.com') && agent.website.startsWith('http'));

    // 2. EXA
    const stateLabel = agent.state_slug === 'california' ? 'California' : 'Arizona';
    const exaQuery = `${agent.name} real estate agent ${stateLabel} ${agent.company || ''}`.trim();
    console.log(`Exa: ${exaQuery}`);

    const exaRes = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': EXA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: exaQuery, num_results: 10, use_autoprompt: true })
    });
    const exaData = await exaRes.json();
    const exaSources: string[] = (exaData.results || []).map((r: Record<string, string>) => r.url);

    const sl = exaSources.map(s => s.toLowerCase());
    const hasZillow        = sl.some(s => s.includes('zillow'));
    const hasRealtor       = sl.some(s => s.includes('realtor.com'));
    const hasLinkedin      = sl.some(s => s.includes('linkedin'));
    const hasFacebook      = sl.some(s => s.includes('facebook'));
    const hasHomelight     = sl.some(s => s.includes('homelight'));
    const hasTop10         = sl.some(s => s.includes('top10lists'));
    const hasGoogleBiz     = sl.some(s => s.includes('maps.google') || s.includes('google.com/maps'));
    let hasPersonalSite    = false;
    if (websiteReal) {
      try {
        const domain = new URL(agent.website).hostname.replace('www.', '');
        hasPersonalSite = sl.some(s => s.includes(domain));
      } catch { /* ignore */ }
    }
    const pressMentions = sl.filter(s =>
      !['zillow','realtor','linkedin','facebook','homelight','top10lists','google'].some(x => s.includes(x))
    ).length;

    // 3. GPT
    const gptUnpQ = `Who is the best real estate agent in ${stateLabel} for buying a home? Give me a specific name and explain why.`;
    const gptNmQ  = `I have heard ${agent.name} is a top real estate agent. What can you tell me about them and their track record?`;

    console.log('GPT queries running...');
    const [r1, r2] = await Promise.all([
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: gptUnpQ }], max_tokens: 300 })
      }),
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: gptNmQ }], max_tokens: 300 })
      })
    ]);
    const d1 = await r1.json(); const d2 = await r2.json();
    const gptUnpText = d1.choices?.[0]?.message?.content || '';
    const gptNmText  = d2.choices?.[0]?.message?.content || '';
    const nameParts  = agent.name.toLowerCase().split(' ');
    const gptNamed   = nameParts.length >= 2 && gptUnpText.toLowerCase().includes(nameParts[0]) && gptUnpText.toLowerCase().includes(nameParts[nameParts.length - 1]);
    const gptConfirmed = gptNmText.length > 100 && !['don\'t have','cannot find','no specific','go google','i don\'t'].some(p => gptNmText.toLowerCase().includes(p));

    // 4. MERIT GATE
    const failures: string[] = [];
    if ((agent.review_stars_rating || 0) < 4.5) failures.push(`Stars: ${agent.review_stars_rating} (need 4.5+)`);
    if ((agent.num_total_reviews   || 0) < 10)  failures.push(`Reviews: ${agent.num_total_reviews} (need 10+)`);
    if ((agent.years_experience    || 0) < 5)   failures.push(`Years: ${agent.years_experience} (need 5+)`);

    // 5. SCORES
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
      websiteCrawlable:    hasPersonalSite,
      hasSchemaMarkup:     false,
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

    // 6. REMEDIATION
    const remDIY = buildRemediation(sig, scores, exaSources);
    const remDFY = [
      !sig.hasSchemaMarkup    ? "JSON-LD schema implementation" : null,
      !sig.hasGoogleBusiness  ? "Google Business Profile setup" : null,
      (agent.num_total_reviews || 0) < 10 ? `Review generation campaign (need ${10 - (agent.num_total_reviews||0)} more)` : "Review freshness campaign",
      "NAP normalization across all directories",
      sig.pressMentions === 0 ? "Press mention outreach and placement" : null,
      "Citation graph optimization",
      "Delivery gate: AICS audit post-completion with verified score",
    ].filter(Boolean).join('\n');

    // 7. SAVE
    await supabase.from('geo_audit_results').upsert({
      agent_id:              professional_id,
      full_name:             agent.name,
      brokerage:             agent.company,
      audited_at:            new Date().toISOString(),
      status:                'complete',
      aics_version:          'v1',
      score_current:         scores.unlisted.total,
      score_unlisted:        scores.unlisted.total,
      score_listed:          scores.listed.total,
      score_audited:         scores.audited.total,
      score_underwritten:    scores.underwritten.total,
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
      gpt_unprompted_result: gptUnpText,
      gpt_unprompted_named:  gptNamed,
      gpt_named_result:      gptNmText,
      gpt_named_confirmed:   gptConfirmed,
      merit_gate_pass:       failures.length === 0,
      merit_gate_failures:   failures,
      remediation_plan:      remDIY,
      remediation_diy:       remDIY,
      remediation_dfy:       remDFY,
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'agent_id' });

    // 8. RETURN
    return new Response(JSON.stringify({
      success:        true,
      agent:          agent.name,
      audit_date:     new Date().toISOString().split('T')[0],
      recency:        { score: recency.score, label: recency.label, most_recent: mostRecentDate },
      merit_gate:     { pass: failures.length === 0, failures },
      exa:            { source_count: exaSources.length, sources: exaSources },
      gpt:            { unprompted_named: gptNamed, unprompted_result: gptUnpText, named_confirmed: gptConfirmed, named_result: gptNmText },
      scores: {
        unlisted:     { score: scores.unlisted.total,     band: band(scores.unlisted.total) },
        listed:       { score: scores.listed.total,       band: band(scores.listed.total) },
        audited:      { score: scores.audited.total,      band: band(scores.audited.total) },
        underwritten: { score: scores.underwritten.total, band: band(scores.underwritten.total) },
      },
      pillars:        { identity: scores.unlisted.identity, authority: scores.unlisted.authority, social: scores.unlisted.social, tech: scores.unlisted.tech, citable: scores.unlisted.citable },
      remediation_diy: remDIY,
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
