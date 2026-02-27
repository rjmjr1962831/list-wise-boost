/**
 * ENV VAR SAFETY — fail loud, fail fast
 * Uses SUPABASE_* if set; otherwise VITE_SUPABASE_* (same vars as frontend, so one set in Vercel works).
 * Service role key: SUPABASE_SERVICE_ROLE_KEY only (no fallback to anon).
 */
export function requireSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    const missing = [];
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl) missing.push('SUPABASE_URL or VITE_SUPABASE_URL');
    throw new Error(
      `[FATAL] Missing env vars in serverless runtime: ${missing.join(', ')}. ` +
      'Check Vercel env vars for ALL environments and redeploy.'
    );
  }

  return { serviceRoleKey, supabaseUrl };
}
