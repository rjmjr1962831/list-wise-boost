import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Supabase edge functions have SUPABASE_DB_URL set internally
  // Fallback: use the pooler connection with the password from secrets
  const DB_URL = Deno.env.get('SUPABASE_DB_URL') ||
    Deno.env.get('DB_URL') ||
    '';

  const { sql, debug } = await req.json();
  if (!sql) return new Response(JSON.stringify({ error: 'sql required' }), { status: 400 });

  if (debug) {
    // List available env vars (names only, no values)
    const envNames = Array.from(Object.keys(Deno.env.toObject())).filter(k =>
      k.includes('DB') || k.includes('SUPA') || k.includes('PG') || k.includes('DATABASE') || k.includes('POSTGRES')
    );
    return new Response(JSON.stringify({ envNames, db_url_set: !!DB_URL, db_url_prefix: DB_URL.slice(0, 40) }));
  }

  if (!DB_URL) return new Response(JSON.stringify({ error: 'No DB_URL available' }), { status: 500 });

  try {
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const db = postgres(DB_URL);
    const result = await db.unsafe(sql);
    await db.end();
    return new Response(JSON.stringify({ success: true, rows: result.length }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
