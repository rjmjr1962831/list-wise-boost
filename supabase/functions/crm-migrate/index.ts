import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });

  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
  const conn = await pool.connect();
  const results: any[] = [];

  const inserts = [
    `INSERT INTO professionals (id, name, email, company, verification_token, business_city, state_slug, num_total_reviews, review_stars_rating, years_experience, specialty, current_tier, badge_tier, active, profile_link)
     VALUES ('0af6a21f-b020-44bc-b520-fc77dac61c4b', 'Robert Maynard', 'robert@maynard.com', 'Top10Lists.us', '42c32ea8-72d3-4142-b4c8-169e41ae68f5', 'Scottsdale', 'arizona', 127, 5, 22, '["Buyer''s Agent","Listing Agent","Luxury Homes"]'::jsonb, 'listed', 'certified', true, 'https://www.top10lists.us/funnel/42c32ea8-72d3-4142-b4c8-169e41ae68f5')
     ON CONFLICT (email) DO UPDATE SET name='Robert Maynard', verification_token='42c32ea8-72d3-4142-b4c8-169e41ae68f5', business_city='Scottsdale', state_slug='arizona', num_total_reviews=127, review_stars_rating=5, years_experience=22, specialty='["Buyer''s Agent","Listing Agent","Luxury Homes"]'::jsonb, current_tier='listed', badge_tier='certified', active=true`,
    `INSERT INTO professionals (id, name, email, company, verification_token, business_city, state_slug, num_total_reviews, review_stars_rating, years_experience, specialty, current_tier, badge_tier, active, profile_link)
     VALUES ('77ebdc17-1642-4986-a196-c4b785a6a148', 'Robert Aryah', 'robert@aryah.ai', 'Aryah Realty', 'ceefc652-aefd-4aba-b765-7eaeb0a36767', 'Phoenix', 'arizona', 84, 5, 15, '["Buyer''s Agent","Listing Agent","Investment Properties"]'::jsonb, 'listed', 'certified', true, 'https://www.top10lists.us/funnel/ceefc652-aefd-4aba-b765-7eaeb0a36767')
     ON CONFLICT (email) DO UPDATE SET name='Robert Aryah', verification_token='ceefc652-aefd-4aba-b765-7eaeb0a36767', business_city='Phoenix', state_slug='arizona', num_total_reviews=84, review_stars_rating=5, years_experience=15, specialty='["Buyer''s Agent","Listing Agent","Investment Properties"]'::jsonb, current_tier='listed', badge_tier='certified', active=true`,
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

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" }
  });
});
