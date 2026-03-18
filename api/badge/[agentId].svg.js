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
 * Tier orb color schemes (HAL 9000 inspired)
 */
const TIER_COLORS = {
  certified: {
    core: '#3B82F6',        // blue core
    glow: '#60A5FA',        // blue glow
    outerGlow: '#1D4ED8',   // deep blue outer
    ring: '#93C5FD',        // light blue ring
  },
  audited: {
    core: '#D97706',        // amber/bronze core
    glow: '#F59E0B',        // gold glow
    outerGlow: '#B45309',   // deep bronze outer
    ring: '#FCD34D',        // light gold ring
  },
  underwritten: {
    core: '#F59E0B',        // gold core
    glow: '#FBBF24',        // bright gold glow
    outerGlow: '#D97706',   // deep gold outer
    ring: '#FDE68A',        // pale gold ring
  },
};

function renderBadgeSvg(tier) {
  const colors = TIER_COLORS[tier];
  if (!colors) return null;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <defs>
    <!-- Outer ambient glow -->
    <radialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${colors.outerGlow}" stop-opacity="0.3" />
      <stop offset="70%" stop-color="${colors.outerGlow}" stop-opacity="0.08" />
      <stop offset="100%" stop-color="${colors.outerGlow}" stop-opacity="0" />
    </radialGradient>
    <!-- Orb body gradient -->
    <radialGradient id="orbBody" cx="40%" cy="35%" r="50%">
      <stop offset="0%" stop-color="${colors.glow}" />
      <stop offset="60%" stop-color="${colors.core}" />
      <stop offset="100%" stop-color="${colors.outerGlow}" />
    </radialGradient>
    <!-- Specular highlight -->
    <radialGradient id="specular" cx="38%" cy="30%" r="30%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.7" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </radialGradient>
    <!-- Inner lens depth -->
    <radialGradient id="lens" cx="50%" cy="50%" r="35%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.4" />
      <stop offset="50%" stop-color="#000000" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Ambient glow -->
  <circle cx="40" cy="40" r="39" fill="url(#ambientGlow)" />

  <!-- Outer ring -->
  <circle cx="40" cy="40" r="30" fill="none" stroke="${colors.ring}" stroke-width="1.5" opacity="0.4" />

  <!-- Orb body -->
  <circle cx="40" cy="40" r="26" fill="url(#orbBody)" />

  <!-- Inner lens depth -->
  <circle cx="40" cy="40" r="18" fill="url(#lens)" />

  <!-- Specular highlight -->
  <circle cx="36" cy="34" r="12" fill="url(#specular)" />

  <!-- Inner ring detail -->
  <circle cx="40" cy="40" r="20" fill="none" stroke="${colors.ring}" stroke-width="0.5" opacity="0.3" />
</svg>`;
}

function renderNotFoundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <defs>
    <radialGradient id="grayOrb" cx="40%" cy="35%" r="50%">
      <stop offset="0%" stop-color="#9CA3AF" />
      <stop offset="100%" stop-color="#4B5563" />
    </radialGradient>
  </defs>
  <circle cx="40" cy="40" r="26" fill="url(#grayOrb)" opacity="0.5" />
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
