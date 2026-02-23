import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });
  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
  const conn = await pool.connect();

  await conn.queryObject(`ALTER TABLE professionals ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN DEFAULT false`);
  await conn.queryObject(`ALTER TABLE crm_sequence_enrollments ADD COLUMN IF NOT EXISTS assigned_account TEXT`);

  conn.release();
  await pool.end();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
