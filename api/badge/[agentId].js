/**
 * Badge API - Returns agent badge data for embeddable widget.
 * GET /api/badge/{canonical_slug}
 * Only certified, audited, underwritten agents. Listed agents return not_found.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co';
const CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const TIER_MAP = {
  listed: 'listed',
  certified: 'certified',
  accredited: 'audited',
  audited: 'audited',
  underwritten: 'underwritten',
};

const STATE_ABBR = {
  arizona: 'AZ',
  california: 'CA',
  texas: 'TX',
  florida: 'FL',
  'new-york': 'NY',
  colorado: 'CO',
};

const STATE_DISPLAY = {
  arizona: 'Arizona',
  california: 'California',
  texas: 'Texas',
  florida: 'Florida',
  'new-york': 'New York',
  colorado: 'Colorado',
};

function normalizeTier(t) {
  if (!t) return 'listed';
  const lower = String(t).toLowerCase();
  return TIER_MAP[lower] || 'listed';
}

function formatDate(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(405).json({ agent: null, error: 'method_not_allowed' });
    return;
  }

  const path = (req.url || req.originalUrl || '').split('?')[0];
  const segments = path.split('/').filter(Boolean);
  const agentId = segments[segments.length - 1];

  if (!agentId) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(400).json({ agent: null, error: 'agent_id_required' });
    return;
  }

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const key = supabaseKey ? String(supabaseKey).trim() : '';
  if (!key) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ agent: null, error: 'config_error' });
    return;
  }

  const supabase = createClient(SUPABASE_URL, key);

  const { data: pro, error } = await supabase
    .from('professionals')
    .select(`
      id, name, canonical_slug, state_slug, current_tier, badge_tier, active,
      review_stars_rating, num_total_reviews, total_sales, sales_count_all_time,
      license_number, license_status, company, business_name, city_id,
      agent_sales_stats, specialty, community_roles
    `)
    .eq('canonical_slug', agentId)
    .maybeSingle();

  if (error) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ agent: null, error: 'database_error' });
    return;
  }

  function setCacheHeaders() {
    Object.entries(CACHE_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  }

  if (!pro) {
    setCacheHeaders();
    res.status(200).json({ agent: null, error: 'not_found' });
    return;
  }

  if (pro.active === false) {
    setCacheHeaders();
    res.status(200).json({ agent: null, error: 'revoked' });
    return;
  }

  const tierRaw = pro.current_tier || pro.badge_tier || 'listed';
  const tier = normalizeTier(tierRaw);

  if (tier === 'listed') {
    setCacheHeaders();
    res.status(200).json({ agent: null, error: 'not_found' });
    return;
  }

  let cityName = '';
  let citySlug = '';
  if (pro.city_id) {
    const { data: city } = await supabase
      .from('cities')
      .select('name, slug')
      .eq('id', pro.city_id)
      .maybeSingle();
    if (city) {
      cityName = city.name || '';
      citySlug = city.slug || '';
    }
  }

  const stateSlug = pro.state_slug || '';
  const stateDisplay = STATE_DISPLAY[stateSlug] || stateSlug;
  const stateAbbr = STATE_ABBR[stateSlug] || stateSlug.toUpperCase().slice(0, 2);
  const brokerage = pro.company || pro.business_name || null;
  const reviewCount = pro.num_total_reviews ?? 0;
  const stats = typeof pro.agent_sales_stats === 'object' && pro.agent_sales_stats ? pro.agent_sales_stats : {};
  const transactionCount = pro.total_sales ?? pro.sales_count_all_time ?? stats.countAllTime ?? 0;
  const rating = pro.review_stars_rating ?? null;

  const { data: cert } = await supabase
    .from('certifications')
    .select('last_verified_at, issued_at')
    .eq('professional_id', pro.id)
    .eq('certification_status', 'active')
    .maybeSingle();

  const verifiedDate = formatDate(cert?.last_verified_at || cert?.issued_at || pro.updated_at);

  // Base payload (all tiers)
  const agent = {
    name: pro.name || 'Unknown',
    slug: pro.canonical_slug,
    state: stateDisplay,
    stateSlug: stateSlug,
    city: cityName,
    citySlug: citySlug,
    tier,
    rating,
    reviewCount,
    transactionCount,
    licenseNumber: pro.license_number || null,
    licenseState: stateAbbr,
    brokerage,
    verifiedDate,
    profileUrl: `https://www.top10lists.us/${stateSlug}/agents/${pro.canonical_slug}`,
    badgeImageUrl: `https://www.top10lists.us/badges/${tier}.png`,
    active: pro.active !== false,
  };

  // Audited & Underwritten: add specialties, community involvement
  const isAuditedOrHigher = tier === 'audited' || tier === 'underwritten';
  if (isAuditedOrHigher) {
    const specs = Array.isArray(pro.specialty) ? pro.specialty : (typeof pro.specialty === 'string' ? (() => { try { return JSON.parse(pro.specialty) || []; } catch { return []; } })() : []);
    const roles = Array.isArray(pro.community_roles) ? pro.community_roles : (typeof pro.community_roles === 'string' ? (() => { try { return JSON.parse(pro.community_roles) || []; } catch { return []; } })() : []);
    agent.specialties = specs.filter(Boolean).map((s) => (typeof s === 'object' ? s.name || s.specialty : s));
    agent.communityRoles = roles.filter(Boolean).map((r) => (typeof r === 'object' ? { organization: r.organization, role: r.role } : { organization: r, role: null }));
  }

  // Underwritten only: add neighborhoods with transaction counts
  if (tier === 'underwritten' && pro.license_number && stateAbbr) {
    const { data: nhRows } = await supabase.rpc('get_agent_neighborhoods_with_transactions', {
      p_license_number: pro.license_number,
      p_state: stateAbbr,
    });
    agent.neighborhoods = (nhRows || []).map((n) => ({
      name: n.neighborhood_name,
      slug: n.neighborhood_slug,
      citySlug: n.city_slug,
      stateSlug: n.state_slug,
      transactionCount: Number(n.transaction_count) || 0,
    }));
  }

  setCacheHeaders();
  res.status(200).json({ agent });
}
