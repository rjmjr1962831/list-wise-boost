import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { agentId } = req.query;

  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid agentId' });
  }

  try {
    // Query professional by id or short_code
    const { data: professional, error } = await supabase
      .from('professionals')
      .select('id, short_code, badge_tier, badge_status')
      .or(`id.eq.${agentId},short_code.eq.${agentId}`)
      .single();

    if (error || !professional) {
      // Default to certified badge for unknown agents
      return serveBadge(res, 'certified');
    }

    // Determine which badge to serve based on status
    let badgeTier = 'certified'; // Default

    if (professional.badge_status === 'active') {
      // Active subscription - show their tier
      badgeTier = professional.badge_tier || 'certified';
    } else if (professional.badge_status === 'grace_period') {
      // Grace period - still show their tier
      badgeTier = professional.badge_tier || 'certified';
    } else if (professional.badge_status === 'lapsed') {
      // Lapsed - downgrade to certified
      badgeTier = 'certified';
    }

    return serveBadge(res, badgeTier);
  } catch (err) {
    console.error('Badge serving error:', err);
    return serveBadge(res, 'certified');
  }
}

function serveBadge(res: VercelResponse, tier: string) {
  try {
    // Read badge file from public/badges directory
    const badgePath = join(process.cwd(), 'public', 'badges', `${tier}.png`);
    const badge = readFileSync(badgePath);

    // Set cache headers - 5 minute cache to allow tier changes to propagate
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.status(200).send(badge);
  } catch (err) {
    console.error(`Failed to load badge ${tier}:`, err);
    res.status(500).json({ error: 'Failed to load badge' });
  }
}
