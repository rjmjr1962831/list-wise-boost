import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "npm:postgres@3.4.5";

serve(async (req) => {
  try {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");

    if (!dbUrl) {
      return new Response(JSON.stringify({ success: false, error: "No SUPABASE_DB_URL" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const sql = postgres(dbUrl, { ssl: false, max: 1 });

    const statements = [
      `SELECT 1`, -- placeholder; update with DDL statements as needed
    ];

    const results = [];
    for (const stmt of statements) {
      try {
        await sql.unsafe(stmt);
        results.push({ ok: true, stmt: stmt.slice(0, 60) });
      } catch (e: any) {
        results.push({ ok: false, stmt: stmt.slice(0, 60), error: e.message });
      }
    }

    await sql.end();
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: e.message,
      stack: e.stack?.slice(0, 500)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
