/**
 * Health check for monitoring and smoke tests.
 * GET /api/health → 200 { ok: true, ... }
 */
export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    service: 'top10lists-api',
    timestamp: new Date().toISOString(),
  });
}
