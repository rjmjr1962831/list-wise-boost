/**
 * One-time backfill script to normalize bot_crawl_logs for 2026-03-21
 * based on the 3-day average (Mar 14-16) minus what's already recorded today.
 *
 * Run: npx tsx scripts/backfill-crawl-logs.ts
 */
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sb = createClient(SB_URL, SB_KEY);

// 3-day average (Mar 14-16) for city + neighborhood pages
const TARGETS: { bot_name: string; page_type: 'city' | 'neighborhood'; avg_daily: number }[] = [
  { bot_name: 'Meta-ExternalAgent', page_type: 'neighborhood', avg_daily: 118772 },
  { bot_name: 'AhrefsBot', page_type: 'neighborhood', avg_daily: 8134 },
  { bot_name: 'Applebot', page_type: 'neighborhood', avg_daily: 4581 },
  { bot_name: 'Googlebot', page_type: 'neighborhood', avg_daily: 4078 },
  { bot_name: 'Bingbot', page_type: 'neighborhood', avg_daily: 2962 },
  { bot_name: 'Meta-ExternalAgent', page_type: 'city', avg_daily: 1979 },
  { bot_name: 'ByteSpider', page_type: 'neighborhood', avg_daily: 995 },
  { bot_name: 'SEMrushBot', page_type: 'neighborhood', avg_daily: 935 },
  { bot_name: 'ChatGPT-User', page_type: 'neighborhood', avg_daily: 428 },
  { bot_name: 'PerplexityBot', page_type: 'neighborhood', avg_daily: 383 },
  { bot_name: 'Googlebot', page_type: 'city', avg_daily: 120 },
  { bot_name: 'AhrefsBot', page_type: 'city', avg_daily: 78 },
  { bot_name: 'GPTBot', page_type: 'neighborhood', avg_daily: 46 },
  { bot_name: 'OAI-SearchBot', page_type: 'neighborhood', avg_daily: 43 },
  { bot_name: 'Applebot', page_type: 'city', avg_daily: 41 },
  { bot_name: 'Bingbot', page_type: 'city', avg_daily: 26 },
  { bot_name: 'GPTBot', page_type: 'city', avg_daily: 18 },
  { bot_name: 'SEMrushBot', page_type: 'city', avg_daily: 14 },
  { bot_name: 'FacebookExternalHit', page_type: 'neighborhood', avg_daily: 15 },
];

// Today's existing counts (from query)
const TODAY: Record<string, number> = {
  'AhrefsBot:neighborhood': 433,
  'Applebot:neighborhood': 171,
  'PerplexityBot:neighborhood': 124,
  'Applebot:city': 49,
  'Googlebot:neighborhood': 42,
  'GPTBot:city': 37,
  'AhrefsBot:city': 21,
  'Bingbot:neighborhood': 15,
  'OAI-SearchBot:neighborhood': 14,
  'ChatGPT-User:neighborhood': 14,
  'Googlebot:city': 10,
  'Bingbot:city': 6,
  'ByteSpider:neighborhood': 5,
  'GPTBot:neighborhood': 4,
  'PerplexityBot:city': 4,
  'SEMrushBot:city': 0,
  'Meta-ExternalAgent:neighborhood': 0,
  'Meta-ExternalAgent:city': 0,
  'FacebookExternalHit:neighborhood': 0,
};

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

function randomTimestamp(): string {
  // Random time during 2026-03-21 UTC
  const start = new Date('2026-03-21T00:00:00Z').getTime();
  const end = new Date('2026-03-21T23:59:59Z').getTime();
  return new Date(start + Math.random() * (end - start)).toISOString();
}

async function main() {
  console.log('Fetching page paths from good days...');
  const [cityPaths, nhPaths] = await Promise.all([
    fetchPaths('city'),
    fetchPaths('neighborhood'),
  ]);
  console.log(`  City paths: ${cityPaths.length}, Neighborhood paths: ${nhPaths.length}`);

  const allRows: any[] = [];

  for (const target of TARGETS) {
    const key = `${target.bot_name}:${target.page_type}`;
    const existing = TODAY[key] || 0;
    const needed = Math.max(0, target.avg_daily - existing);
    if (needed === 0) continue;

    const paths = target.page_type === 'city' ? cityPaths : nhPaths;
    if (paths.length === 0) { console.warn(`  No paths for ${key}, skipping`); continue; }

    const ua = UA_MAP[target.bot_name] || target.bot_name;
    console.log(`  ${key}: need ${needed} (avg ${target.avg_daily} - existing ${existing})`);

    for (let i = 0; i < needed; i++) {
      const path = paths[Math.floor(Math.random() * paths.length)];
      allRows.push({
        page_path: path,
        bot_name: target.bot_name,
        user_agent: ua,
        crawled_at: randomTimestamp(),
      });
    }
  }

  console.log(`\nTotal rows to insert: ${allRows.length.toLocaleString()}`);

  // Batch insert (1000 at a time)
  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const batch = allRows.slice(i, i + BATCH);
    const { error } = await sb.from('bot_crawl_logs').insert(batch);
    if (error) {
      console.error(`  Insert error at batch ${i}: ${error.message}`);
      break;
    }
    inserted += batch.length;
    if (inserted % 10000 === 0 || i + BATCH >= allRows.length) {
      console.log(`  Inserted ${inserted.toLocaleString()} / ${allRows.length.toLocaleString()}`);
    }
  }

  console.log(`\nDone. Inserted ${inserted.toLocaleString()} backfill rows for 2026-03-21.`);
}

main().catch(console.error);
