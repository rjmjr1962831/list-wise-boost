/**
 * ProPublica IRS Form 990 civic verification for professionals.
 * Searches ProPublica Nonprofit Explorer by name, filters by state/org rules, merges into community_roles.
 * Auth: X-Enrichment-Key. Rate limit: 1 req/sec to ProPublica.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROPUBLICA_SEARCH = "https://projects.propublica.org/nonprofits/name_search";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const RATE_LIMIT_MS = 1000;

type StateSlug = 'arizona' | 'california' | 'texas' | 'florida' | 'new_york' | 'colorado';

const STATE_ORG_TERMS: Record<StateSlug, string[]> = {
  arizona: ['arizona', 'maricopa county', 'pima county', 'pinal county', 'yavapai county', 'coconino county', 'mohave county'],
  california: ['california', 'los angeles county', 'san diego county', 'orange county', 'san francisco', 'sacramento county', 'riverside county', 'san bernardino county', 'alameda county', 'santa clara county', 'contra costa county', 'ventura county'],
  texas: ['texas', 'harris county', 'dallas county', 'tarrant county', 'bexar county', 'travis county', 'collin county'],
  florida: ['florida', 'miami-dade county', 'broward county', 'palm beach county', 'hillsborough county', 'orange county florida', 'duval county'],
  new_york: ['new york', 'manhattan', 'brooklyn', 'queens', 'bronx', 'westchester county', 'nassau county', 'suffolk county'],
  colorado: ['colorado', 'denver county', 'el paso county', 'arapahoe county', 'jefferson county', 'adams county', 'douglas county'],
};

const NATIONAL_RE_BODIES = [
  'national association of realtors',
  'national association of home builders',
  'national fair housing alliance',
  'habitat for humanity international',
  'urban land institute',
];

function locationMatchesState(loc: string, stateSlug: StateSlug): boolean {
  const s = (loc || '').trim().toLowerCase();
  if (stateSlug === 'arizona') return /,\s*az\b/i.test(loc) || s.includes('arizona');
  if (stateSlug === 'california') return /,\s*ca\b/i.test(loc) || s.includes('california');
  if (stateSlug === 'texas') return /,\s*tx\b/i.test(loc) || s.includes('texas');
  if (stateSlug === 'florida') return /,\s*fl\b/i.test(loc) || s.includes('florida');
  if (stateSlug === 'new_york') return /,\s*ny\b/i.test(loc) || s.includes('new york');
  if (stateSlug === 'colorado') return /,\s*co\b/i.test(loc) || s.includes('colorado');
  return false;
}

function classifyRole(location: string, orgName: string, stateSlug: string): boolean {
  const loc = (location || '').trim();
  const orgLower = (orgName || '').toLowerCase();
  const state = (stateSlug || 'arizona') as StateSlug;
  if (locationMatchesState(loc, state)) return true;
  const terms = STATE_ORG_TERMS[state] || STATE_ORG_TERMS.arizona;
  for (const term of terms) {
    if (orgLower.includes(term)) return true;
  }
  for (const nb of NATIONAL_RE_BODIES) {
    if (orgLower.includes(nb)) return true;
  }
  return false;
}

function normalizeName(name: string): string {
  let s = (name || '').toLowerCase().trim();
  const suffixes = [' jr', ' sr', ' ii', ' iii', ' iv', ' esq', ' cpa', ' dds', ' md', ' phd'];
  for (const suf of suffixes) s = s.replace(suf, '');
  s = s.replace(/\b[a-z]\b\.?/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

function namesMatch(agentName: string, foundName: string): boolean {
  const aParts = new Set(normalizeName(agentName).split(/\s+/).filter(Boolean));
  const fParts = new Set(normalizeName(foundName).split(/\s+/).filter(Boolean));
  let overlap = 0;
  for (const p of aParts) {
    if (fParts.has(p)) overlap++;
  }
  return overlap >= 2;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

interface ProPublicaResult {
  person_name: string;
  title: string;
  organization: string;
  ein: string;
  year: string;
  location: string;
}

async function searchPropublicaPeople(name: string): Promise<ProPublicaResult[]> {
  const q = encodeURIComponent(name);
  const url = `${PROPUBLICA_SEARCH}?utf8=%E2%9C%93&q=${q}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const results: ProPublicaResult[] = [];
  const blocks = html.split('result-row result-row-people">');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const hedMatch = block.match(/result-item__hed">\s*([^<]+)/);
    if (!hedMatch) continue;
    const person_name = hedMatch[1].trim();
    const tbMatch = block.match(/<span class="margin-right">\s*(.*?)\s*at\s*<a/s);
    const title = tbMatch ? stripHtml(tbMatch[1]) : '';
    const omMatch = block.match(/href="\/nonprofits\/organizations\/(\d+)">\s*([^<]+)/);
    if (!omMatch) continue;
    const ein = omMatch[1];
    const organization = omMatch[2].trim();
    const ymMatch = block.match(/•\s*<span[^>]*>(\d{4})<\/span>/);
    const year = ymMatch ? ymMatch[1] : '';
    let location = '';
    const lmMatch = block.match(/nowrap text-sub">\s*([^•<]+)/);
    if (lmMatch) location = lmMatch[1].trim();
    else {
      const fallback = block.match(/>\s*([^<]*,\s*[A-Za-z]{2})\s*•/);
      if (fallback) location = fallback[1].trim();
    }
    results.push({ person_name, title, organization, ein, year, location });
  }
  return results;
}

interface CommunityRole {
  role?: string;
  organization?: string;
  verification_source?: string;
  ein?: string;
  tax_year?: string;
  location?: string;
  filing_url?: string;
}

function mergeRoles(existing: CommunityRole[] | string | null, newRoles: CommunityRole[]): { merged: CommunityRole[]; added: number } {
  let arr: CommunityRole[] = [];
  if (Array.isArray(existing)) arr = [...existing];
  else if (typeof existing === 'string') {
    try {
      arr = JSON.parse(existing) as CommunityRole[];
    } catch {
      arr = [];
    }
  }
  const existingOrgs = new Set(arr.filter(r => r.organization).map(r => r.organization!.toLowerCase().trim()));
  let added = 0;
  for (const nr of newRoles) {
    const org = (nr.organization || '').toLowerCase().trim();
    if (!org || existingOrgs.has(org)) continue;
    arr.push(nr);
    existingOrgs.add(org);
    added++;
  }
  return { merged: arr, added };
}

function alreadyHasPropublica(communityRoles: unknown): boolean {
  if (!communityRoles) return false;
  const arr = Array.isArray(communityRoles) ? communityRoles : (typeof communityRoles === 'string' ? (() => { try { return JSON.parse(communityRoles); } catch { return []; } })() : []);
  return arr.some((r: CommunityRole) => r.verification_source === 'ProPublica IRS Form 990');
}

function shouldSkipAgent(name: string): boolean {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;
  const lower = name.toLowerCase();
  const biz = ['realty', 'group', 'team', 'homes', 'properties', 'llc', 'inc'];
  return biz.some(b => lower.includes(b));
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-enrichment-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const isStatsOnly = req.method === 'GET' && url.searchParams.get('stats') !== null;

  // Stats (progress) is public; other actions require X-Enrichment-Key or Authorization: Bearer <service_role_key>
  if (!isStatsOnly) {
    const enrichmentKey = req.headers.get('X-Enrichment-Key');
    const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    const expectedEnrichment = Deno.env.get('ENRICHMENT_KEY') || Deno.env.get('ENRICHMENT_API_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const token = enrichmentKey || bearer;
    const allowed =
      (expectedEnrichment && token === expectedEnrichment) ||
      (serviceRoleKey && token === serviceRoleKey);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // GET ?stats = progress (how many have ProPublica, how many left per state) — no auth required
  if (isStatsOnly) {
    const states: StateSlug[] = ['arizona', 'california', 'texas', 'florida', 'new_york', 'colorado'];
    const stats: { state_slug: string; total_active: number; with_propublica: number; remaining: number }[] = [];
    for (const state of states) {
      let total = 0;
      let withPropublica = 0;
      let offset = 0;
      const pageSize = 500;
      while (true) {
        const { data: page, error } = await supabase
          .from('professionals')
          .select('id, community_roles')
          .eq('active', true)
          .eq('state_slug', state)
          .range(offset, offset + pageSize - 1);
        if (error) break;
        if (!page?.length) break;
        total += page.length;
        for (const row of page) {
          if (alreadyHasPropublica(row.community_roles)) withPropublica++;
        }
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      if (total > 0 || withPropublica > 0) {
        stats.push({ state_slug: state, total_active: total, with_propublica: withPropublica, remaining: total - withPropublica });
      }
    }
    const summary = stats.reduce((acc, s) => ({ total: acc.total + s.total_active, with_propublica: acc.with_propublica + s.with_propublica, remaining: acc.remaining + s.remaining }), { total: 0, with_propublica: 0, remaining: 0 });
    return new Response(JSON.stringify({ ok: true, stats, summary }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: { professional_id?: string; batch?: boolean; state?: string; limit?: number; stats?: boolean } = {};
  try {
    body = req.method === 'POST' ? await req.json() : {};
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (body.stats) {
    const states: StateSlug[] = ['arizona', 'california', 'texas', 'florida', 'new_york', 'colorado'];
    const stats: { state_slug: string; total_active: number; with_propublica: number; remaining: number }[] = [];
    for (const state of states) {
      let total = 0;
      let withPropublica = 0;
      let offset = 0;
      const pageSize = 500;
      while (true) {
        const { data: page, error } = await supabase
          .from('professionals')
          .select('id, community_roles')
          .eq('active', true)
          .eq('state_slug', state)
          .range(offset, offset + pageSize - 1);
        if (error) break;
        if (!page?.length) break;
        total += page.length;
        for (const row of page) {
          if (alreadyHasPropublica(row.community_roles)) withPropublica++;
        }
        if (page.length < pageSize) break;
        offset += pageSize;
      }
      if (total > 0 || withPropublica > 0) {
        stats.push({ state_slug: state, total_active: total, with_propublica: withPropublica, remaining: total - withPropublica });
      }
    }
    const summary = stats.reduce((acc, s) => ({ total: acc.total + s.total_active, with_propublica: acc.with_propublica + s.with_propublica, remaining: acc.remaining + s.remaining }), { total: 0, with_propublica: 0, remaining: 0 });
    return new Response(JSON.stringify({ ok: true, stats, summary }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (body.professional_id) {
    const { data: agent, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, state_slug, community_roles')
      .eq('id', body.professional_id)
      .single();

    if (fetchError || !agent) {
      return new Response(JSON.stringify({ error: 'Professional not found', professional_id: body.professional_id }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (shouldSkipAgent(agent.name)) {
      return new Response(JSON.stringify({ ok: true, professional_id: agent.id, skipped: true, reason: 'skip_agent_name' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await searchPropublicaPeople(agent.name);
    const matched = results.filter(r => namesMatch(agent.name, r.person_name));
    const stateSlug = (agent.state_slug || 'arizona') as StateSlug;
    const accepted = matched.filter(r => classifyRole(r.location, r.organization, stateSlug));

    const seenEins = new Set<string>();
    const verified: CommunityRole[] = [];
    for (const r of accepted) {
      if (seenEins.has(r.ein)) continue;
      seenEins.add(r.ein);
      verified.push({
        role: r.title || 'Officer/Director',
        organization: r.organization,
        verification_source: 'ProPublica IRS Form 990',
        ein: r.ein,
        tax_year: r.year,
        location: r.location,
        filing_url: `https://projects.propublica.org/nonprofits/organizations/${r.ein}`,
      });
    }

    const { merged, added } = mergeRoles(agent.community_roles, verified);
    if (added === 0) {
      return new Response(JSON.stringify({
        ok: true,
        professional_id: agent.id,
        name: agent.name,
        roles_found: verified.length,
        roles_added: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { error: updateError } = await supabase
      .from('professionals')
      .update({ community_roles: merged })
      .eq('id', agent.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Update failed', detail: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      professional_id: agent.id,
      name: agent.name,
      roles_added: added,
      community_roles_count: merged.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (body.batch) {
    const state = (body.state || 'arizona').toLowerCase().replace(/\s+/g, '_') as StateSlug;
    const limit = Math.min(Math.max(1, body.limit || 10), 50);

    const { data: agents, error: listError } = await supabase
      .from('professionals')
      .select('id, name, state_slug, community_roles')
      .eq('active', true)
      .eq('state_slug', state)
      .limit(limit * 3);

    if (listError) {
      return new Response(JSON.stringify({ error: 'List failed', detail: listError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const toProcess = (agents || []).filter(
      a => !shouldSkipAgent(a.name) && !alreadyHasPropublica(a.community_roles)
    ).slice(0, limit);

    const summary = { processed: 0, updated: 0, roles_added: 0, skipped: 0, errors: 0, agents_with_raw: 0, agents_with_matched: 0, agents_with_accepted: 0 };
    const sample_rejected: { name: string; org: string; location: string; state_slug: string }[] = [];

    for (const agent of toProcess) {
      const results = await searchPropublicaPeople(agent.name);
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

      const matched = results.filter(r => namesMatch(agent.name, r.person_name));
      const stateSlug = (agent.state_slug || state) as StateSlug;
      const accepted = matched.filter(r => classifyRole(r.location, r.organization, stateSlug));

      if (results.length > 0) summary.agents_with_raw++;
      if (matched.length > 0) summary.agents_with_matched++;
      if (accepted.length > 0) summary.agents_with_accepted++;
      if (matched.length > 0 && accepted.length === 0 && sample_rejected.length < 3) {
        const r = matched[0];
        sample_rejected.push({ name: agent.name, org: r?.organization ?? '', location: r?.location ?? '', state_slug: stateSlug });
      }

      const seenEins = new Set<string>();
      const verified: CommunityRole[] = [];
      for (const r of accepted) {
        if (seenEins.has(r.ein)) continue;
        seenEins.add(r.ein);
        verified.push({
          role: r.title || 'Officer/Director',
          organization: r.organization,
          verification_source: 'ProPublica IRS Form 990',
          ein: r.ein,
          tax_year: r.year,
          location: r.location,
          filing_url: `https://projects.propublica.org/nonprofits/organizations/${r.ein}`,
        });
      }

      const { merged, added } = mergeRoles(agent.community_roles, verified);
      summary.processed++;
      if (added === 0) {
        summary.skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('professionals')
        .update({ community_roles: merged })
        .eq('id', agent.id);

      if (updateError) {
        summary.errors++;
        continue;
      }
      summary.updated++;
      summary.roles_added += added;
    }

    return new Response(JSON.stringify({
      ok: true,
      batch: true,
      state,
      limit,
      candidates: (agents || []).length,
      ...summary,
      sample_rejected: sample_rejected.length ? sample_rejected : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({
    error: 'Provide professional_id or batch: true with optional state and limit',
    usage: {
      single: 'POST { "professional_id": "uuid" }',
      batch: 'POST { "batch": true, "state": "arizona", "limit": 50 }',
    },
  }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
