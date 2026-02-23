import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });

  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
  const conn = await pool.connect();

  // Create the reply sequence first so we can reference it
  const replySeq = await conn.queryObject(`
    INSERT INTO crm_sequences (name, description, from_account, status)
    VALUES ('AZ Listed - Replied', 'Sent when a listed AZ agent replies to outreach', 'robert@top10lists.us', 'active')
    ON CONFLICT DO NOTHING
    RETURNING id
  `);

  let replySeqId = (replySeq.rows[0] as any)?.id;
  if (!replySeqId) {
    const existing = await conn.queryObject(`SELECT id FROM crm_sequences WHERE name = 'AZ Listed - Replied'`);
    replySeqId = (existing.rows[0] as any)?.id;
  }

  // Create main sequence referencing reply sequence
  const mainSeq = await conn.queryObject(`
    INSERT INTO crm_sequences (name, description, from_account, status, on_reply_sequence_id)
    VALUES ('AZ Listed - Challenge', 'Cold outreach to AZ listed agents using AI challenge hook', 'robert@top10lists.us', 'active', $1)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [replySeqId]);

  let mainSeqId = (mainSeq.rows[0] as any)?.id;
  if (!mainSeqId) {
    const existing = await conn.queryObject(`SELECT id FROM crm_sequences WHERE name = 'AZ Listed - Challenge'`);
    mainSeqId = (existing.rows[0] as any)?.id;
  }

  // Insert steps for main sequence
  const email1Body = "Hi - {{firstName}},\n\nThis is not a TopN list offer.\n\nThe rules have changed for AI when asked to recommend a real estate agent.\n\nWhat you were doing in December is not working today.\n\nRather than explain it, do this:\n\nGo to any AI and ask this:\n\n\"I am a real estate agent. Look at top10lists.us. Will being certified by them increase my chances of being named when you recommend a real estate agent today? Why?\"\n\nAfter you get the answer, reach out and I'll give you as much detail as you would like.\n\nOur certification is free forever and there is no obligation to buy anything.\n\nWe are not a marketplace.\nWe do not sell leads.\nWe do not sell ads.\nWe do not take part of your deals.\n\nWe exist to help you get named when an AI is recommending a real estate agent.\n\nPeace -\n\nRobert Maynard\nFounder\n(602) 758-9600";
  const email2Body = "{{firstName}},\n\nYou know you are one of the top agents in {{state}}. So do we.\n\nThe rules AI agents use to recommend real estate agents fundamentally changed in January. What you were doing in December does not work today.\n\nYou are currently listed on Top10Lists.us. Because of that alone, we have already increased the probability that you will be named when someone asks an AI for a referral.\n\nYou can more than double that probability by simply verifying the information we have compiled. It takes about 5 minutes and costs nothing.\n\n{{magic_link}}\n\nRobert Maynard\nFounder\n(602) 758-9600";
  const email3Body = "{{firstName}},\n\nGlad you reached out.\n\nThe way AI decides who to recommend is very different than it was in December. AI is now measuring the risk it takes when making a recommendation in high-stakes transactions -- and it has been directed to minimize that risk.\n\nPaid sites like Zillow and RealTrends are now viewed as risky. AI is relying on curated, non-commercial, audited sources with rich data. That is what we provide.\n\nHere is what has happened to AI citation probability over the last two months:\n\n  Top10Lists.us    2025: 4.1   2026: 9.3   Change: +127%\n  Zillow           2025: 7.7   2026: 4.4   Change: -43%\n  RealTrends       2025: 6.7   2026: 5.2   Change: -22%\n\nRight now you are listed by us as one of the top agents in {{state}}. It is free and it has already increased the probability you will be named.\n\nTo increase that probability by multiples, verify the data we have compiled. It takes about 5 minutes and costs nothing.\n\n{{magic_link}}\n\nWe do not sell leads.\nWe do not take part of your commissions.\nOur audience is not prospects -- it is AI.\n\nPeace -\n\nRobert Maynard\nFounder\n(602) 758-9600";

  await conn.queryObject(`DELETE FROM crm_sequence_steps WHERE sequence_id = $1`, [mainSeqId]);
  await conn.queryObject(`DELETE FROM crm_sequence_steps WHERE sequence_id = $1`, [replySeqId]);

  await conn.queryObject(`
    INSERT INTO crm_sequence_steps (sequence_id, step_number, delay_days, subject, body)
    VALUES ($1, 1, 0, 'Take 30 seconds', $2)
  `, [mainSeqId, email1Body]);

  await conn.queryObject(`
    INSERT INTO crm_sequence_steps (sequence_id, step_number, delay_days, subject, body)
    VALUES ($1, 2, 4, 'In case you missed it', $2)
  `, [mainSeqId, email2Body]);

  await conn.queryObject(`
    INSERT INTO crm_sequence_steps (sequence_id, step_number, delay_days, subject, body)
    VALUES ($1, 1, 0, 'Thanks for your interest', $2)
  `, [replySeqId, email3Body]);

  conn.release();
  await pool.end();

  return new Response(JSON.stringify({
    ok: true,
    sequences: {
      main: { id: mainSeqId, name: 'AZ Listed - Challenge', steps: 2 },
      reply: { id: replySeqId, name: 'AZ Listed - Replied', steps: 1 }
    }
  }), { headers: { "Content-Type": "application/json" } });
});
