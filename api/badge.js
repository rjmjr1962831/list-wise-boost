const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

module.exports = async (req, res) => {
  const agentId = req.url.split('/').pop().replace('.png', '');

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }

  try {
    // Query professional by id or short_code
    const { data: professional, error } = await supabase
      .from('professionals')
      .select('id, short_code, badge_tier, badge_status')
      .or(`id.eq.${agentId},short_code.eq.${agentId}`)
      .single();

    // Default to certified badge
    let badgeTier = 'certified';

    if (professional && !error) {
      if (professional.badge_status === 'active' || professional.badge_status === 'grace_period') {
        badgeTier = professional.badge_tier || 'certified';
      }
    }

    // Read badge file
    const badgePath = join(__dirname, '../../public/badges', `${badgeTier}.png`);
    const badge = readFileSync(badgePath);

    // Serve badge with cache headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    res.status(200).send(badge);
  } catch (err) {
    console.error('Badge serving error:', err);
    
    // Fallback to certified badge
    try {
      const fallbackPath = join(__dirname, '../../public/badges/certified.png');
      const fallbackBadge = readFileSync(fallbackPath);
      res.setHeader('Content-Type', 'image/png');
      res.status(200).send(fallbackBadge);
    } catch {
      res.status(500).json({ error: 'Failed to load badge' });
    }
  }
};
