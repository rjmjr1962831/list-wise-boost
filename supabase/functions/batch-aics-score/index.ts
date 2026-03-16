import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

// ── AIFS scoring model (v1, locked) ──────────────────────────────────────────

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
  // Base: review volume and quality always contribute, independent of recency
  const reviewVolume  = Math.min(20, Math.round(Math.log2(rc + 1) * 2));
  const reviewQuality = rr >= 3.5 ? Math.round((rr - 3.5) * 6.67) : 0;
  social += reviewVolume + reviewQuality;
  // Recency adds separately as a bonus (0-10), does not gate the base
  social += a.recencyScore;
  // Tier amplification scales the combined social score (floor 0.5 so unlisted agents still count)
  social = Math.round(social * (0.5 + 0.5 * (tierRec / 10)));
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

  const total = Math.min(95, identity + authority + social + tech + citable + bonus);
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
    const batchSize  = Math.min(body.batch_size  || 100, 200);
    const stateFilter = body.state_slug || null;  // optional: 'arizona' | 'california'
    const forceRescore = body.force_rescore || false;  // re-score all, ignoring audit freshness
    const agentIds = body.agent_ids || null;  // optional: array of specific agent UUIDs to re-score

    // ── 1. Find agents needing scoring via SQL (no pagination bugs) ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const stateWhere = stateFilter ? `AND p.state_slug = '${stateFilter}'` : '';

    let ids: string[];

    if (agentIds && Array.isArray(agentIds) && agentIds.length > 0) {
      // Targeted rescore: specific agent IDs
      ids = agentIds;
    } else {
      // Use run_sql to get candidate IDs: agents with no audit, paid-tier agents due for 30-day refresh, or all if force_rescore
      const rescoreAfter = body.rescore_after || null;  // ISO timestamp: only rescore agents audited before this time
      const rescoreWhere = forceRescore && rescoreAfter
        ? `AND (g.agent_id IS NULL OR g.audited_at < '${rescoreAfter}')`
        : '';
      const candidateQuery = forceRescore
        ? `SELECT p.id FROM professionals p LEFT JOIN geo_audit_results g ON g.agent_id = p.id WHERE p.active = true ${stateWhere} ${rescoreWhere} ORDER BY p.id LIMIT ${batchSize}`
        : `SELECT p.id FROM professionals p
           LEFT JOIN geo_audit_results g ON g.agent_id = p.id
           WHERE p.active = true ${stateWhere}
             AND (
               g.agent_id IS NULL
               OR (g.current_tier IN ('audited','underwritten') AND g.audited_at < '${thirtyDaysAgo}')
             )
           ORDER BY p.id
           LIMIT ${batchSize}`;

      const { data: candidateIds, error: sqlErr } = await supabase.rpc('run_sql', {
        query: candidateQuery
      });
      if (sqlErr) throw new Error(`Candidate query failed: ${sqlErr.message}`);

      ids = (candidateIds || []).map((r: any) => r.id);
    }

    if (ids.length === 0) {
      // Count total scored for status
      const { data: countData } = await supabase.rpc('run_sql', {
        query: `SELECT count(*) as n FROM geo_audit_results`
      });
      const scored = countData?.[0]?.n || 0;
      return new Response(JSON.stringify({
        success: true, processed: 0, scored,
        message: 'All active agents have been audited'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch full agent data for candidates
    const { data: agents, error: agentsErr } = await supabase
      .from('professionals')
      .select('id,name,company,state_slug,current_tier,short_code,years_experience,total_sales,review_stars_rating,num_total_reviews,most_recent_review_date,description,website,license_number,agent_sales_stats,professional_information')
      .in('id', ids);
    if (agentsErr) throw new Error(`DB query failed: ${agentsErr.message}`);

    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({
        success: true, processed: 0,
        message: 'No agents found for candidate IDs'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── 1b. Fetch cached Exa results from geo_audit_results ──────────────────
    const { data: cachedAudits } = await supabase
      .from('geo_audit_results')
      .select('agent_id,exa_sources,has_zillow,has_realtor,has_linkedin,has_facebook,has_homelight,has_top10,has_personal_site')
      .in('agent_id', ids);
    const cachedByAgent: Record<string, any> = {};
    for (const row of (cachedAudits || [])) {
      if (row.exa_sources && Array.isArray(row.exa_sources) && row.exa_sources.length > 0) {
        cachedByAgent[row.agent_id] = row;
      }
    }

    // ── 2. Process agents concurrently (20 at a time) ────────────────────────
    const processed: any[] = [];
    const failed: any[]    = [];
    const CONCURRENCY = 100;

    async function processAgent(agent: any) {
      const salesStats   = (agent.agent_sales_stats as Record<string, number>) || {};
      const salesLast12  = salesStats.countLast12Months || 0;
      const totalSales   = salesStats.countAllTime || agent.total_sales || 0;

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

      // Use cached Exa results if available, otherwise run fresh search
      const cached = cachedByAgent[agent.id];
      let exaSources: string[];
      if (cached) {
        exaSources = cached.exa_sources;
      } else {
        exaSources = await exaSearch(agent.name, stateLabel, agent.company || '', EXA_API_KEY);
      }
      const sl           = exaSources.map((s: string) => s.toLowerCase());
      const hasZillow    = cached?.has_zillow    ?? sl.some((s: string) => s.includes('zillow'));
      const hasRealtor   = cached?.has_realtor   ?? sl.some((s: string) => s.includes('realtor.com'));
      const hasLinkedin  = cached?.has_linkedin  ?? sl.some((s: string) => s.includes('linkedin'));
      const hasFacebook  = cached?.has_facebook  ?? sl.some((s: string) => s.includes('facebook'));
      const hasHomelight = cached?.has_homelight ?? sl.some((s: string) => s.includes('homelight'));
      const hasTop10     = cached?.has_top10     ?? sl.some((s: string) => s.includes('top10lists'));
      let hasPersonalSite = cached?.has_personal_site ?? false;
      if (!cached && websiteReal) {
        try {
          const domain = new URL(agent.website).hostname.replace('www.', '');
          hasPersonalSite = sl.some((s: string) => s.includes(domain));
        } catch { /* ignore */ }
      }
      const pressMentions = sl.filter((s: string) =>
        !['zillow','realtor','linkedin','facebook','homelight','top10lists','google'].some((x: string) => s.includes(x))
      ).length;

      let tierRec = recency;
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

      const scores = {
        unlisted:     computeScore(sig, recency, false, 0),
        listed:       computeScore(sig, 2, true, 0),
        certified:    computeScore(sig, 3, true, 0),
        audited:      computeScore(sig, 8, true, 8),
        underwritten: computeScore(sig, 10, true, 14),
      };

      const failures: string[] = [];
      if ((agent.review_stars_rating || 0) < 4.5) failures.push(`Stars: ${agent.review_stars_rating} (need 4.5+)`);
      if ((agent.num_total_reviews   || 0) < 10)  failures.push(`Reviews: ${agent.num_total_reviews} (need 10+)`);
      if ((agent.years_experience    || 0) < 5)   failures.push(`Years: ${agent.years_experience} (need 5+)`);

      const hasPress = sl.filter((s: string) =>
        !['zillow','realtor','linkedin','facebook','homelight','top10lists','google'].some((x: string) => s.includes(x))
      ).length > 0;

      await supabase.from('geo_audit_results').upsert({
        agent_id:              agent.id,
        full_name:             agent.name,
        brokerage:             agent.company,
        state_slug:            agent.state_slug || null,
        current_tier:          agent.current_tier || null,
        artifact_url:          agent.short_code ? `https://www.top10lists.us/artifact/${agent.short_code}` : null,
        audited_at:            new Date().toISOString(),
        status:                'complete',
        aifs_version:          'v1',
        score_current:         scores.unlisted.total,
        score_unlisted:        scores.unlisted.total,
        score_listed:          scores.listed.total,
        score_certified:       scores.certified.total,
        score_audited:         scores.audited.total,
        score_underwritten:    scores.underwritten.total,
        score_lift_to_audited:       scores.audited.total - scores.unlisted.total,
        score_lift_to_underwritten:  scores.underwritten.total - scores.unlisted.total,
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
        has_zillow:            sl.some((s: string) => s.includes('zillow')),
        has_realtor:           hasRealtor,
        has_linkedin:          hasLinkedin,
        has_facebook:          hasFacebook,
        has_homelight:         hasHomelight,
        has_top10:             hasTop10,
        has_personal_site:     hasPersonalSite,
        gap_stale_reviews:     recency < 4,
        gap_no_linkedin:       !hasLinkedin,
        gap_no_schema:         true,
        gap_no_realtor:        !hasRealtor,
        gap_no_homelight:      !hasHomelight,
        gap_no_press:          !hasPress,
        gap_no_personal_site:  !hasPersonalSite,
        merit_gate_pass:       failures.length === 0,
        merit_gate_failures:   failures,
        updated_at:            new Date().toISOString(),
      }, { onConflict: 'agent_id' });

      return {
        id:    agent.id,
        name:  agent.name,
        tier:  agent.current_tier,
        state: agent.state_slug,
        score_unlisted: scores.unlisted.total,
        score_audited:  scores.audited.total,
        exa_count:      exaSources.length,
        band:           band(scores.unlisted.total),
      };
    }

    // Run in chunks of CONCURRENCY
    for (let i = 0; i < agents.length; i += CONCURRENCY) {
      const chunk = agents.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(chunk.map(a => processAgent(a)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          processed.push(r.value);
        } else {
          const msg = r.reason instanceof Error ? r.reason.message : 'unknown';
          failed.push({ id: chunk[j].id, name: chunk[j].name, error: msg });
          console.error(`Failed ${chunk[j].name}: ${msg}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success:        true,
      processed:      processed.length,
      failed:         failed.length,
      results:        processed,
      errors:         failed,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('batch-aifs-score error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
