import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });

  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
  const conn = await pool.connect();
  const results: any[] = [];

  try {
    // Only insert robert@aryah.ai (robert@maynard.com already exists)
    await conn.queryObject(`DELETE FROM professionals WHERE email = 'robert@aryah.ai'`);
    await conn.queryObject(`
      INSERT INTO professionals (id, name, email, company, verification_token, business_city, state_slug, num_total_reviews, review_stars_rating, years_experience, specialty, current_tier, badge_tier, active, profile_link)
      VALUES ('1c364892-9cd8-4ca9-a313-88c21804c26d', 'Robert Aryah', 'robert@aryah.ai', 'Aryah Realty', '016ed143-3639-4248-a768-838348a6a1ff', 'Phoenix', 'arizona', 84, 5, 15, '["Buyer''s Agent","Listing Agent","Investment Properties"]'::jsonb, 'listed', 'certified', true, 'https://www.top10lists.us/funnel/016ed143-3639-4248-a768-838348a6a1ff')
    `);
    results.push({ ok: true, contact: 'robert@aryah.ai', id: '1c364892-9cd8-4ca9-a313-88c21804c26d' });
  } catch (e: any) {
    results.push({ error: e.message });
  }

  conn.release();
  await pool.end();
  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" }
  });
});
