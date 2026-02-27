/**
 * HEALTH ENDPOINT — hit this after every deploy
 * Returns non-sensitive diagnostic info.
 * If any key shows false, fix env vars in Vercel dashboard, redeploy, hit /api/health again.
 */
export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasSupabaseUrl: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      hasSupabaseAnonKey: !!(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
      nodeEnv: process.env.NODE_ENV || 'unknown',
    },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'unknown',
  });
}
