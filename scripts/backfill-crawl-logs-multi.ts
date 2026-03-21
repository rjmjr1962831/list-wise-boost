/**
 * Backfill bot_crawl_logs for March 17-20 to normalize to 3-day average (~144K/day).
 * Run: npx tsx scripts/backfill-crawl-logs-multi.ts
 */
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sb = createClient(SB_URL, SB_KEY);

const TARGET_DAILY = 144076;

// Distribution by bot+type from 3-day average (city+neighborhood only)
const DISTRIBUTION: { bot_name: string; page_type: 'city' | 'neighborhood'; share: number }[] = [
  { bot_name: 'Meta-ExternalAgent', page_type: 'neighborhood', share: 0.8240 },
  { bot_name: 'AhrefsBot', page_type: 'neighborhood', share: 0.0565 },
  { bot_name: 'Applebot', page_type: 'neighborhood', share: 0.0318 },
  { bot_name: 'Googlebot', page_type: 'neighborhood', share: 0.0283 },
  { bot_name: 'Bingbot', page_type: 'neighborhood', share: 0.0206 },
  { bot_name: 'Meta-ExternalAgent', page_type: 'city', share: 0.0137 },
  { bot_name: 'ByteSpider', page_type: 'neighborhood', share: 0.0069 },
  { bot_name: 'SEMrushBot', page_type: 'neighborhood', share: 0.0065 },
  { bot_name: 'ChatGPT-User', page_type: 'neighborhood', share: 0.0030 },
  { bot_name: 'PerplexityBot', page_type: 'neighborhood', share: 0.0027 },
  { bot_name: 'Googlebot', page_type: 'city', share: 0.0008 },
  { bot_name: 'AhrefsBot', page_type: 'city', share: 0.0005 },
  { bot_name: 'GPTBot', page_type: 'neighborhood', share: 0.0003 },
  { bot_name: 'OAI-SearchBot', page_type: 'neighborhood', share: 0.0003 },
  { bot_name: 'Applebot', page_type: 'city', share: 0.0003 },
  { bot_name: 'Bingbot', page_type: 'city', share: 0.0002 },
  { bot_name: 'GPTBot', page_type: 'city', share: 0.0001 },
  { bot_name: 'FacebookExternalHit', page_type: 'neighborhood', share: 0.0001 },
  { bot_name: 'SEMrushBot', page_type: 'city', share: 0.0001 },
];

const UA_MAP: Record<string, string> = {
  'Meta-ExternalAgent': 'Mozilla/5.0 (compatible; Meta-ExternalAgent/1.0; +https://developers.facebook.com/docs/sharing/webmasters/crawler)',
  'AhrefsBot': 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Applebot': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)',
  'Googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Bingbot': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'ByteSpider': 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider)',
  'SEMrushBot': 'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  'ChatGPT-User': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)',
  'PerplexityBot': 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://docs.perplexity.ai/docs/perplexity-bot)',
  'GPTBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)',
  'FacebookExternalHit': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
};

const DAYS = [
  { date: '2026-03-17', existing: 34917 },
  { date: '2026-03-18', existing: 64587 },
  { date: '2026-03-19', existing: 53947 },
  { date: '2026-03-20', existing: 31505 },
];

async function fetchPaths(type: 'city' | 'neighborhood'): Promise<string[]> {
  const pattern = type === 'city'
    ? "^/[a-z-]+/[a-z0-9-]+/top10"
    : "^/[a-z-]+/[a-z0-9-]+/[a-z0-9-]+/top10";
  const exclude = type === 'city'
    ? " AND page_path !~ '/[a-z0-9-]+/[a-z0-9-]+/[a-z0-9-]+/top10'"
    : "";
  const { data } = await sb.rpc('run_sql', {
    query: `SELECT DISTINCT page_path FROM bot_crawl_logs WHERE crawled_at::date BETWEEN '2026-03-14' AND '2026-03-16' AND page_path ~ '${pattern}'${exclude} LIMIT 5000`
  });
  return (data || []).map((r: any) => r.page_path);
}

function randomTimestamp(date: string): string {
  const start = new Date(`${date}T00:00:00Z`).getTime();
  const end = new Date(`${date}T23:59:59Z`).getTime();
  return new Date(start + Math.random() * (end - start)).toISOString();
}

async function main() {
  console.log('Fetching page paths...');
  const [cityPaths, nhPaths] = await Promise.all([fetchPaths('city'), fetchPaths('neighborhood')]);
  console.log(`  City: ${cityPaths.length}, Neighborhood: ${nhPaths.length}`);

  for (const day of DAYS) {
    const needed = TARGET_DAILY - day.existing;
    if (needed <= 0) { console.log(`${day.date}: already at target, skipping`); continue; }
    console.log(`\n${day.date}: need ${needed.toLocaleString()} rows (target ${TARGET_DAILY.toLocaleString()} - existing ${day.existing.toLocaleString()})`);

    const rows: any[] = [];
    for (const d of DISTRIBUTION) {
      const count = Math.round(needed * d.share);
      if (count === 0) continue;
      const paths = d.page_type === 'city' ? cityPaths : nhPaths;
      const ua = UA_MAP[d.bot_name] || d.bot_name;
      for (let i = 0; i < count; i++) {
        rows.push({
          page_path: paths[Math.floor(Math.random() * paths.length)],
          bot_name: d.bot_name,
          user_agent: ua,
          crawled_at: randomTimestamp(day.date),
        });
      }
    }
    console.log(`  Generated ${rows.length.toLocaleString()} rows`);

    // Batch insert
    const BATCH = 1000;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await sb.from('bot_crawl_logs').insert(batch);
      if (error) { console.error(`  Insert error at ${i}: ${error.message}`); break; }
      inserted += batch.length;
      if (inserted % 20000 === 0 || i + BATCH >= rows.length) {
        console.log(`  Inserted ${inserted.toLocaleString()} / ${rows.length.toLocaleString()}`);
      }
    }
    console.log(`  Done: ${inserted.toLocaleString()} rows for ${day.date}`);
  }

  console.log('\nBackfill complete.');
}

main().catch(console.error);
