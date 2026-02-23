import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const key = req.headers.get("x-migration-key");
  if (key !== "crm_migrate_2026") return new Response("Unauthorized", { status: 401 });

  const { Pool } = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);
  const conn = await pool.connect();
  const results: any[] = [];

  const statements = [
    `CREATE TABLE IF NOT EXISTS crm_sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      from_account TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      on_reply_sequence_id UUID REFERENCES crm_sequences(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS crm_sequence_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id UUID NOT NULL REFERENCES crm_sequences(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      delay_days INTEGER NOT NULL DEFAULT 0,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS crm_sequence_enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sequence_id UUID NOT NULL REFERENCES crm_sequences(id),
      professional_id UUID REFERENCES professionals(id),
      email TEXT NOT NULL,
      first_name TEXT,
      status TEXT DEFAULT 'active',
      current_step INTEGER DEFAULT 0,
      enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      next_send_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      replied_at TIMESTAMPTZ,
      metadata JSONB DEFAULT '{}',
      UNIQUE(sequence_id, email)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_status ON crm_sequence_enrollments(status)`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_next_send ON crm_sequence_enrollments(next_send_at)`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON crm_sequence_enrollments(sequence_id)`,
    `CREATE INDEX IF NOT EXISTS idx_enrollments_email ON crm_sequence_enrollments(email)`,
  ];

  for (const sql of statements) {
    try {
      await conn.queryObject(sql);
      results.push({ ok: true, sql: sql.slice(0, 50) });
    } catch (e: any) {
      results.push({ error: e.message, sql: sql.slice(0, 50) });
    }
  }

  conn.release();
  await pool.end();
  return new Response(JSON.stringify({ ok: true, results }), { headers: { "Content-Type": "application/json" } });
});
