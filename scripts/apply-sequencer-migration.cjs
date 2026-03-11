const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) env[t.slice(0, eq)] = t.slice(eq + 1);
}

const client = new Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Supabase PostgreSQL');

  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260309100000_sequencer_v2.sql'),
    'utf-8'
  );

  await client.query(sql);
  console.log('Migration applied successfully');

  // Verify
  const res = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'email_%' ORDER BY table_name"
  );
  console.log('Tables created:', res.rows.map(r => r.table_name));

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
