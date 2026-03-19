/**
 * One-time backfill script for missing bot_crawl_logs during the
 * log drain outage (Mar 18 23:00 UTC to Mar 19 20:00 UTC, ~21 hours).
 *
 * Uses the healthy period (Mar 17 00:00 to Mar 18 20:00, 44 hours)
 * as a baseline to estimate missing volume by page_path + bot_name.
 *
 * Rows are marked with user_agent='backfill-estimate' so they can
 * be identified and removed if needed.
 */

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

async function rpc(query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/run_sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return r.json();
}

async function run() {
  // 1. Healthy period stats (44 hours)
  const healthyTotal = await rpc(
    `SELECT count(*)::int as total FROM bot_crawl_logs
     WHERE crawled_at >= '2026-03-17 00:00:00+00' AND crawled_at < '2026-03-18 20:00:00+00'`
  );
  const total = healthyTotal[0].total; // ~95,548
  const avgPerHour = total / 44;

  // 2. Broken period actual
  const brokenActual = await rpc(
    `SELECT count(*)::int as total FROM bot_crawl_logs
     WHERE crawled_at >= '2026-03-18 23:00:00+00' AND crawled_at < '2026-03-19 20:00:00+00'`
  );
  const actual = brokenActual[0].total;

  const brokenHours = 21;
  const expected = Math.round(avgPerHour * brokenHours);
  const missing = expected - actual;

  console.log(`Healthy: ${total} over 44h (${Math.round(avgPerHour)}/hr)`);
  console.log(`Expected for ${brokenHours}h: ${expected}`);
  console.log(`Actual recorded: ${actual}`);
  console.log(`Missing: ${missing}`);

  // 3. Get page+bot distribution from healthy period
  const dist = await rpc(
    `SELECT page_path, bot_name, count(*)::float as hits
     FROM bot_crawl_logs
     WHERE crawled_at >= '2026-03-17 00:00:00+00' AND crawled_at < '2026-03-18 20:00:00+00'
     GROUP BY page_path, bot_name ORDER BY hits DESC LIMIT 1000`
  );
  const distTotal = dist.reduce((s, r) => s + r.hits, 0);

  // 4. Generate backfill rows
  const brokenStart = new Date('2026-03-18T23:00:00Z');
  const rows = [];

  for (const d of dist) {
    const proportion = d.hits / distTotal;
    const rowCount = Math.round(missing * proportion);
    if (rowCount < 1) continue;

    // Spread evenly across the 21 hours with some jitter
    const perHour = rowCount / brokenHours;
    for (let h = 0; h < brokenHours; h++) {
      const count = Math.max(1, Math.round(perHour));
      for (let i = 0; i < count; i++) {
        const jitterMs = Math.floor(Math.random() * 3600000);
        const ts = new Date(brokenStart.getTime() + h * 3600000 + jitterMs);
        rows.push({
          agent_id: null,
          page_path: d.page_path,
          bot_name: d.bot_name,
          user_agent: 'backfill-estimate',
          crawled_at: ts.toISOString(),
        });
      }
    }
  }

  console.log(`Generated ${rows.length} backfill rows`);

  // 5. Insert in batches of 500
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bot_crawl_logs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (r.ok) {
      inserted += batch.length;
      if ((i + 500) % 5000 === 0) console.log(`  ...${inserted} inserted`);
    } else {
      console.error(`Insert error batch ${i}:`, await r.text());
    }
  }

  console.log(`Done. Inserted ${inserted} backfill rows.`);
  console.log(`These rows have user_agent='backfill-estimate' for identification.`);
}

run().catch(console.error);
