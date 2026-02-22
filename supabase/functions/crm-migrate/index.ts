import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });

  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
  const conn = await pool.connect();
  const results: any[] = [];

  // Delete any existing test contacts first
  await conn.queryObject(`DELETE FROM professionals WHERE email IN ('robert@maynard.com', 'robert@aryah.ai')`);

  const inserts = [
    `INSERT INTO professionals (id, name, email, company, verification_token, business_city, state_slug, num_total_reviews, review_stars_rating, years_experience, specialty, current_tier, badge_tier, active, profile_link)
     VALUES ('8ac93eb9-4fa3-4327-afe2-c624cf2dae18', 'Robert Maynard', 'robert@maynard.com', 'Top10Lists.us', 'd01aea1c-248d-4cf3-bbaa-fe5240f3c003', 'Scottsdale', 'arizona', 127, 5, 22, '["Buyer''s Agent","Listing Agent","Luxury Homes"]'::jsonb, 'listed', 'certified', true, 'https://www.top10lists.us/funnel/d01aea1c-248d-4cf3-bbaa-fe5240f3c003')`,
    `INSERT INTO professionals (id, name, email, company, verification_token, business_city, state_slug, num_total_reviews, review_stars_rating, years_experience, specialty, current_tier, badge_tier, active, profile_link)
     VALUES ('a1db08b3-0ca6-4884-96cc-5feb26067246', 'Robert Aryah', 'robert@aryah.ai', 'Aryah Realty', '3c5d82ad-2f54-4b77-8789-90104473943f', 'Phoenix', 'arizona', 84, 5, 15, '["Buyer''s Agent","Listing Agent","Investment Properties"]'::jsonb, 'listed', 'certified', true, 'https://www.top10lists.us/funnel/3c5d82ad-2f54-4b77-8789-90104473943f')`,
  ];

  for (const sql of inserts) {
    try {
      await conn.queryObject(sql);
      results.push({ ok: true, contact: sql.includes('maynard') ? 'robert@maynard.com' : 'robert@aryah.ai' });
    } catch (e: any) {
      results.push({ error: e.message, contact: sql.includes('maynard') ? 'robert@maynard.com' : 'robert@aryah.ai' });
    }
  }

  conn.release();
  await pool.end();
  return new Response(JSON.stringify({ ok: true, results, ids: ['8ac93eb9-4fa3-4327-afe2-c624cf2dae18','a1db08b3-0ca6-4884-96cc-5feb26067246'] }), {
    headers: { "Content-Type": "application/json" }
  });
});
