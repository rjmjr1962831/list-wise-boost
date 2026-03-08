import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

// ── AICS scoring model (v1, locked) ──────────────────────────────────────────

function recencyScore(dateStr: string | null): number {
  if (!dateStr) return 0;
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return 0;
  const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
  if (days <= 1)   return 10;
  if (days <= 7)   return 9;
  if (days <= 30)  return 7;
  if (days <= 90)  return 4;
  if (days <= 180) return 2;
  if (days <= 365) return 1;
  return 0;
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
  if (a.license_number)   identity += 5;
  if (a.company)          identity += 5;
  if (a.hasPersonalSite)  identity += 5;
  if (a.hasLinkedin)      identity += 3;
  if (hasTop10)           identity += 2;

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
  if (a.hasRealtor)    social += 4;
  if (a.hasHomelight)  social += 3;

  let tech = 0;
  if (a.websiteCrawlable)  tech += 5;
  if (!a.hasSchemaMarkup)  tech -= 2;
  if (a.hasRealtor)        tech += 3;
  if (a.hasHomelight)      tech += 2;
  if (a.hasFacebook)       tech += 2;
  if (hasTop10)            tech += 3;

  let citable = 0;
  citable += Math.min(5, a.exaSourceCount || 0);
  citable += Math.min(3, (a.pressMentions || 0) * 2);
  if (hasTop10) citable += 7;
  citable = Math.round(citable * (0.4 + 0.6 * (tierRec / 10)));

  const total = Math.min(97, identity + authority + social + tech + citable + bonus);
  return { identity, authority, social, tech, citable, bonuses: bonus, total };
}

// ── Exa search (URL-only, no content) ─────────────────────────────────────────

async function exaSearch(agentName: string, stateLabel: string, company: string, exaKey: string): Promise<string[]> {
  const query = `${agentName} real estate agent ${stateLabel} ${company || ''}`.trim();
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': exaKey, 'Content-Type': 'application/json' },
      // URL-only -- no contents block = no per-result content charges
      body: JSON.stringify({ query, num_results: 10, use_autoprompt: true })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: Record<string, string>) => r.url as string);
  } catch {
    return [];
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const EXA_API_KEY  = Deno.env.get('EXA_API_KEY') ?? '';
    if (!EXA_API_KEY) throw new Error('EXA_API_KEY not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const body = await req.json();
    const batchSize  = Math.min(body.batch_size  || 40, 60);
    const offset     = body.offset || 0;
    const stateFilter = body.state_slug || null;  // optional: 'arizona' | 'california'

    // ── 1. Pull agents not yet audited (or stale > 7 days) ────────────────────
    // Fetch agent IDs already audited recently
    const { data: audited } = await supabase
      .from('geo_audit_results')
      .select('agent_id')
      .gte('audited_at', new Date(Date.now() - 7 * 86400000).toISOString());

    const auditedIds = new Set((audited || []).map((r: any) => r.agent_id));

    // Fetch candidate agents
    let query = supabase
      .from('professionals')
      .select('id,name,company,state_slug,current_tier,years_experience,total_sales,review_stars_rating,num_total_reviews,most_recent_review_date,description,website,license_number,agent_sales_stats,professional_information')
      .eq('active', true)
      .range(offset, offset + batchSize + auditedIds.size + 100 - 1)  // over-fetch to account for already-audited
      .limit(200);

    if (stateFilter) query = query.eq('state_slug', stateFilter);

    const { data: allAgents, error: agentsErr } = await query;
    if (agentsErr) throw new Error(`DB query failed: ${agentsErr.message}`);

    // Filter out already-audited, take batchSize
    const agents = (allAgents || []).filter((a: any) => !auditedIds.has(a.id)).slice(0, batchSize);

    if (agents.length === 0) {
      return new Response(JSON.stringify({
        success: true, processed: 0, skipped: auditedIds.size,
        message: 'All agents in this range already audited'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 2. Process each agent ─────────────────────────────────────────────────
    const processed: any[] = [];
    const failed: any[]    = [];

    for (const agent of agents) {
      try {
        const salesStats   = (agent.agent_sales_stats as Record<string, number>) || {};
        const salesLast12  = salesStats.countLast12Months || 0;
        const totalSales   = salesStats.countAllTime || agent.total_sales || 0;

        // Best review date
        let mostRecentDate: string | null = agent.most_recent_review_date;
        if (!mostRecentDate) {
          const pi      = (agent.professional_information as Record<string, any>) || {};
          const reviews = (pi.recentReviews || []) as Array<Record<string, string>>;
          const sorted  = reviews.filter((r: any) => r.date).sort((a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime());
          if (sorted.length > 0) mostRecentDate = sorted[0].date;
        }

        const recency      = recencyScore(mostRecentDate);
        const stateLabel   = agent.state_slug === 'california' ? 'California' : 'Arizona';
        const websiteReal  = !!(agent.website && !agent.website.includes('zillow') &&
                                !agent.website.includes('realtor.com') && agent.website.startsWith('http'));

        // Exa URL-only search
        const exaSources   = await exaSearch(agent.name, stateLabel, agent.company || '', EXA_API_KEY);
        const sl           = exaSources.map((s: string) => s.toLowerCase());

        const hasZillow    = sl.some((s: string) => s.includes('zillow'));
        const hasRealtor   = sl.some((s: string) => s.includes('realtor.com'));
        const hasLinkedin  = sl.some((s: string) => s.includes('linkedin'));
        const hasFacebook  = sl.some((s: string) => s.includes('facebook'));
        const hasHomelight = sl.some((s: string) => s.includes('homelight'));
        const hasTop10     = sl.some((s: string) => s.includes('top10lists'));
        let hasPersonalSite = false;
        if (websiteReal) {
          try {
            const domain = new URL(agent.website).hostname.replace('www.', '');
            hasPersonalSite = sl.some((s: string) => s.includes(domain));
          } catch { /* ignore */ }
        }
        const pressMentions = sl.filter((s: string) =>
          !['zillow','realtor','linkedin','facebook','homelight','top10lists','google'].some((x: string) => s.includes(x))
        ).length;

        // Determine tier recency
        let tierRec = recency;  // default: use actual organic recency for unlisted
        if (agent.current_tier === 'underwritten') tierRec = 10;
        else if (agent.current_tier === 'audited')  tierRec = 8;
        else if (agent.current_tier === 'certified') tierRec = 3;

        const sig = {
          name:                agent.name,
          license_number:      agent.license_number,
          company:             agent.company,
          years_experience:    agent.years_experience || 0,
          total_sales:         totalSales,
          sales_last_12mo:     salesLast12,
          review_stars_rating: agent.review_stars_rating || 0,
          num_total_reviews:   agent.num_total_reviews || 0,
          description:         agent.description || '',
          recencyScore:        recency,
          hasPersonalSite,
          websiteCrawlable:    hasPersonalSite,
          hasSchemaMarkup:     false,
          hasLinkedin,
          hasFacebook,
          hasRealtor,
          hasHomelight,
          hasGoogleBusiness:   false,
          exaSourceCount:      Math.min(5, exaSources.length),
          pressMentions,
        };

        // Tier bonuses
        const tierBonus = agent.current_tier === 'underwritten' ? 14 :
                          agent.current_tier === 'audited' ? 8 : 0;

        const scores = {
          unlisted:     computeScore(sig, recency, false, 0),
          listed:       computeScore(sig, 2, true, 0),
          certified:    computeScore(sig, 3, true, 0),
          audited:      computeScore(sig, 8, true, 8),
          underwritten: computeScore(sig, 10, true, 14),
        };

        // Merit gate check
        const failures: string[] = [];
        if ((agent.review_stars_rating || 0) < 4.5) failures.push(`Stars: ${agent.review_stars_rating} (need 4.5+)`);
        if ((agent.num_total_reviews   || 0) < 10)  failures.push(`Reviews: ${agent.num_total_reviews} (need 10+)`);
        if ((agent.years_experience    || 0) < 5)   failures.push(`Years: ${agent.years_experience} (need 5+)`);

        // Upsert to geo_audit_results
        await supabase.from('geo_audit_results').upsert({
          agent_id:              agent.id,
          full_name:             agent.name,
          brokerage:             agent.company,
          state_slug:            agent.state_slug || null,
          audited_at:            new Date().toISOString(),
          status:                'complete',
          aics_version:          'v1',
          score_current:         scores.unlisted.total,
          score_unlisted:        scores.unlisted.total,
          score_listed:          scores.listed.total,
          score_certified:       scores.certified.total,
          score_audited:         scores.audited.total,
          score_underwritten:    scores.underwritten.total,
          pillar_identity:       scores.unlisted.identity,
          pillar_authority:      scores.unlisted.authority,
          pillar_social:         scores.unlisted.social,
          pillar_technical:      scores.unlisted.tech,
          pillar_citability:     scores.unlisted.citable,
          recency_score:         recency,
          recency_label:         recency === 0 ? 'stale/no signal' : `${recency}/10`,
          most_recent_signal:    mostRecentDate,
          review_count:          agent.num_total_reviews,
          review_rating:         agent.review_stars_rating,
          exa_sources:           exaSources,
          exa_source_count:      exaSources.length,
          platforms_found:       exaSources,
          merit_gate_pass:       failures.length === 0,
          merit_gate_failures:   failures,
          updated_at:            new Date().toISOString(),
        }, { onConflict: 'agent_id' });

        processed.push({
          id:    agent.id,
          name:  agent.name,
          tier:  agent.current_tier,
          state: agent.state_slug,
          score_unlisted: scores.unlisted.total,
          score_audited:  scores.audited.total,
          exa_count:      exaSources.length,
          band:           band(scores.unlisted.total),
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown';
        failed.push({ id: agent.id, name: agent.name, error: msg });
        console.error(`Failed ${agent.name}: ${msg}`);
      }
    }

    return new Response(JSON.stringify({
      success:        true,
      offset,
      processed:      processed.length,
      failed:         failed.length,
      already_audited: auditedIds.size,
      results:        processed,
      errors:         failed,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('batch-aics-score error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
