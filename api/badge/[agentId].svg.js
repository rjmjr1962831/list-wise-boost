/**
 * Dynamic SVG Badge Endpoint
 * GET /api/badge/:agentId.svg
 *
 * Renders a professional SVG badge based on the agent's current tier.
 * Queries Supabase for tier data, returns SVG with proper content-type and cache headers.
 * Supports: certified, audited, underwritten. Listed agents get a 404.
 */
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAdmin } from '../_lib/requireEnv.js';

const TIER_MAP = {
  listed: 'listed',
  certified: 'certified',
  accredited: 'audited',
  audited: 'audited',
  underwritten: 'underwritten',
};

function normalizeTier(t) {
  if (!t) return 'listed';
  const lower = String(t).toLowerCase();
  return TIER_MAP[lower] || 'listed';
}

/**
 * Tier color schemes
 */
const TIER_COLORS = {
  certified: {
    primary: '#1E3A5F',      // dark navy
    secondary: '#2563EB',    // blue
    accent: '#94A3B8',       // silver
    accentLight: '#CBD5E1',  // light silver
    badge: '#E2E8F0',        // silver badge bg
    text: '#FFFFFF',
    tierText: '#1E3A5F',
    verifiedBg: '#16A34A',
    verifiedText: '#FFFFFF',
  },
  audited: {
    primary: '#1E3A5F',      // dark navy
    secondary: '#1D4ED8',    // deeper blue
    accent: '#D97706',       // gold
    accentLight: '#FCD34D',  // light gold
    badge: '#FEF3C7',        // gold badge bg
    text: '#FFFFFF',
    tierText: '#92400E',
    verifiedBg: '#16A34A',
    verifiedText: '#FFFFFF',
  },
  underwritten: {
    primary: '#4C1D95',      // deep purple
    secondary: '#7C3AED',    // purple
    accent: '#D97706',       // gold
    accentLight: '#FCD34D',  // light gold
    badge: '#FEF3C7',        // gold badge bg
    text: '#FFFFFF',
    tierText: '#92400E',
    verifiedBg: '#16A34A',
    verifiedText: '#FFFFFF',
  },
};

function renderBadgeSvg(tier) {
  const colors = TIER_COLORS[tier];
  if (!colors) return null;

  const tierLabel = tier.toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.primary}" />
      <stop offset="100%" stop-color="${colors.secondary}" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${colors.accent}" />
      <stop offset="100%" stop-color="${colors.accentLight}" />
    </linearGradient>
  </defs>

  <!-- Main background -->
  <rect width="200" height="60" rx="6" ry="6" fill="url(#bg)" />

  <!-- Accent border (top) -->
  <rect x="0" y="0" width="200" height="3" rx="6" ry="6" fill="url(#accentGrad)" />

  <!-- TOP 10 text -->
  <text x="14" y="22" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="${colors.text}" letter-spacing="1">TOP 10</text>

  <!-- LISTS.US text -->
  <text x="14" y="37" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="400" fill="${colors.accentLight}" letter-spacing="0.5">LISTS.US</text>

  <!-- Divider line -->
  <line x1="82" y1="8" x2="82" y2="52" stroke="${colors.accent}" stroke-width="1" opacity="0.5" />

  <!-- Tier badge pill -->
  <rect x="90" y="8" width="102" height="22" rx="4" ry="4" fill="${colors.badge}" />
  <text x="141" y="23" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" fill="${colors.tierText}" text-anchor="middle" letter-spacing="0.8">${tierLabel}</text>

  <!-- Verified pill -->
  <rect x="90" y="34" width="62" height="18" rx="9" ry="9" fill="${colors.verifiedBg}" />
  <text x="121" y="46" font-family="Arial, Helvetica, sans-serif" font-size="8" font-weight="600" fill="${colors.verifiedText}" text-anchor="middle" letter-spacing="0.5">VERIFIED</text>

  <!-- Checkmark circle -->
  <circle cx="106" cy="43" r="5" fill="none" stroke="${colors.verifiedText}" stroke-width="1" opacity="0.6" />
  <polyline points="103,43 105.5,45.5 109,40.5" fill="none" stroke="${colors.verifiedText}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
}

function renderNotFoundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60">
  <rect width="200" height="60" rx="6" ry="6" fill="#6B7280" />
  <text x="100" y="35" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#D1D5DB" text-anchor="middle">Badge Not Available</text>
</svg>`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(405).send(renderNotFoundSvg());
    return;
  }

  // Extract agentId from the URL - Vercel strips .svg from the param
  const rawId = req.query.agentId || req.query['agentId.svg'] || '';
  const agentId = rawId.replace(/\.svg$/i, '');

  if (!agentId) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(400).send(renderNotFoundSvg());
    return;
  }

  let supabaseUrl, supabaseKey;
  try {
    const env = requireSupabaseAdmin();
    supabaseUrl = env.supabaseUrl;
    supabaseKey = env.serviceRoleKey;
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(500).send(renderNotFoundSvg());
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Try lookup by short_code first, then canonical_slug, then UUID
  let pro = null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);

  if (isUuid) {
    const { data } = await supabase
      .from('professionals')
      .select('id, current_tier, badge_tier, active, short_code')
      .eq('id', agentId)
      .maybeSingle();
    pro = data;
  }

  if (!pro) {
    const { data } = await supabase
      .from('professionals')
      .select('id, current_tier, badge_tier, active, short_code')
      .eq('short_code', agentId)
      .maybeSingle();
    pro = data;
  }

  if (!pro) {
    const { data } = await supabase
      .from('professionals')
      .select('id, current_tier, badge_tier, active, short_code')
      .eq('canonical_slug', agentId)
      .maybeSingle();
    pro = data;
  }

  const svgHeaders = {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  function setSvgHeaders() {
    Object.entries(svgHeaders).forEach(([k, v]) => res.setHeader(k, v));
  }

  if (!pro || pro.active === false) {
    setSvgHeaders();
    res.status(200).send(renderNotFoundSvg());
    return;
  }

  const tierRaw = pro.current_tier || pro.badge_tier || 'listed';
  const tier = normalizeTier(tierRaw);

  if (tier === 'listed') {
    setSvgHeaders();
    res.status(200).send(renderNotFoundSvg());
    return;
  }

  const svg = renderBadgeSvg(tier);
  if (!svg) {
    setSvgHeaders();
    res.status(200).send(renderNotFoundSvg());
    return;
  }

  setSvgHeaders();
  res.status(200).send(svg);
}
