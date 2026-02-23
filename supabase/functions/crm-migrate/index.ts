import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });
  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
  const conn = await pool.connect();
  await conn.queryObject(`UPDATE crm_sequence_steps SET body = 'Hi {{firstName}} -

The rules have changed for AI recommendations for you. What you were doing in December is not working today. There is a whole body of new science and law that explains why, but take a shortcut. Go to any AI and ask this:

"I am a real estate agent. Look at top10lists.us. Will being certified by them increase my chances of being named when you recommend a real estate agent today? Why?"

After you get the answer, reach out and let us help you. I''m happy to give you as much detail as you would like.

- We are not a marketplace.
- We do not sell leads.
- We do not take part of your deals.
- We exist to help you get named when an AI is recommending a real estate agent.

Your certification is free forever and there is no obligation to buy anything.

Peace,
Robert Maynard
Founder
(602) 758-9600' WHERE id = '4c8f378f-5367-4628-9584-13a59495018a'`);
  const r = await conn.queryObject(`SELECT id, subject, left(body,80) as preview FROM crm_sequence_steps WHERE id = '4c8f378f-5367-4628-9584-13a59495018a'`);
  conn.release();
  await pool.end();
  return new Response(JSON.stringify({ ok: true, step: r.rows[0] }), { headers: { "Content-Type": "application/json" } });
});
