/**
 * ENV VAR SAFETY — fail loud, fail fast
 * RULES:
 *   1. Service role key is ALWAYS process.env.SUPABASE_SERVICE_ROLE_KEY
 *   2. No aliases, no fallbacks, no VITE_ prefix in api/ routes
 *   3. Every api/ route that needs Supabase admin calls requireSupabaseAdmin() before doing anything
 *   4. If the key is missing, return 500 with explicit error — never degrade
 */
export function requireSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    const missing = [];
    if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    throw new Error(
      `[FATAL] Missing env vars in serverless runtime: ${missing.join(', ')}. ` +
      'Check Vercel env vars for ALL environments (Production + Preview + Development) and redeploy.'
    );
  }

  return { serviceRoleKey, supabaseUrl };
}
