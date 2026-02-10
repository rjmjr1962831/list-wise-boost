import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * API Route: /api/v1/badge/:agentId
 * 
 * Returns machine-readable certification badge payload for AI systems.
 * Proxies to Supabase Edge Function artifact-payload.
 * 
 * Example: GET /api/v1/badge/1b975c55-a33b-4d21-8998-dc2d9b2dd91d
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { agentId } = req.query;

  if (!agentId || typeof agentId !== 'string') {
    return res.status(400).json({ error: 'Agent ID required' });
  }

  try {
    // Proxy to Supabase Edge Function
    const edgeFunctionUrl = `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/${agentId}`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Powered-By', 'Top10Lists Badge API v1');

    return res.status(200).json(data);

  } catch (error) {
    console.error('[badge-api] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
