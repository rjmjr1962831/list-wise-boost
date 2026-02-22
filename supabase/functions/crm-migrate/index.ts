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
     VALUES ('6e3d668b-9e1e-4144-802b-25d170e0a820', 'Robert Maynard', 'robert@maynard.com', 'Top10Lists.us', '3a8c9f58-63f7-488c-9be4-616bde34d0a2', 'Scottsdale', 'arizona', 127, 5, 22, ARRAY['Buyer''s Agent','Listing Agent','Luxury Homes'], 'listed', 'certified', true, 'https://www.top10lists.us/funnel/3a8c9f58-63f7-488c-9be4-616bde34d0a2')
     ON CONFLICT (id) DO UPDATE SET email='robert@maynard.com', verification_token='3a8c9f58-63f7-488c-9be4-616bde34d0a2'`,
    `INSERT INTO professionals (id, name, email, company, verification_token, business_city, state_slug, num_total_reviews, review_stars_rating, years_experience, specialty, current_tier, badge_tier, active, profile_link)
     VALUES ('618204da-462f-43d2-ad03-06ce71ebf70c', 'Robert Aryah', 'robert@aryah.ai', 'Aryah Realty', '7437538c-9af8-4610-bb30-2e1a2bf4cae8', 'Phoenix', 'arizona', 84, 5, 15, ARRAY['Buyer''s Agent','Listing Agent','Investment Properties'], 'listed', 'certified', true, 'https://www.top10lists.us/funnel/7437538c-9af8-4610-bb30-2e1a2bf4cae8')
     ON CONFLICT (id) DO UPDATE SET email='robert@aryah.ai', verification_token='7437538c-9af8-4610-bb30-2e1a2bf4cae8'`,
  ];

  for (const sql of inserts) {
    try {
      await conn.queryObject(sql);
      results.push({ sql: sql.slice(0,60), ok: true });
    } catch (e: any) {
      results.push({ sql: sql.slice(0,60), error: e.message });
    }
  }

  conn.release();
  await pool.end();

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" }
  });
});
