import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });
  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
  const conn = await pool.connect();

  // Enable pg_cron extension
  await conn.queryObject(`CREATE EXTENSION IF NOT EXISTS pg_cron`);

  // Schedule sequence-processor every 5 min; first run 05:00 MST (12:00 UTC). 1 send per run = 5-min spacing.
  await conn.queryObject(`SELECT cron.unschedule('sequence-processor') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sequence-processor')`).catch(() => {});
  
  await conn.queryObject(`
    SELECT cron.schedule(
      'sequence-processor',
      '*/5 * * * *',
      $$
        SELECT net.http_post(
          url := '${Deno.env.get("SUPABASE_URL")}/functions/v1/sequence-processor',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}'
          ),
          body := '{}'::jsonb
        )
      $$
    )
  `);

  const jobs = await conn.queryObject(`SELECT jobname, schedule, active FROM cron.job`);
  conn.release();
  await pool.end();
  return new Response(JSON.stringify({ ok: true, jobs: jobs.rows }), { headers: { "Content-Type": "application/json" } });
});
