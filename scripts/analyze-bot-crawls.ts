/**
 * Analyze Bot Crawl Logs
 * 
 * Queries Cloudflare logs from Supabase and matches bot visits to agent profiles
 * Run: npx tsx scripts/analyze-bot-crawls.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const p of ['.env', '.env.local']) {
  try {
    const env = readFileSync(p, 'utf-8');
    for (const line of env.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      process.env[key] = val;
    }
    break;
  } catch { /* try next */ }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) {
  console.error('Need VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

interface BotCrawlStats {
  bot_type: string;
  total_visits: number;
  unique_pages: number;
  cache_hits: number;
  cache_misses: number;
  top_pages: Array<{ url: string; visits: number }>;
}

interface AgentProfileVisit {
  agent_id: string;
  agent_name: string;
  bot_type: string;
  visits: number;
  first_seen: string;
  last_seen: string;
}

async function analyzeBotCrawls(days: number = 7) {
  console.log(`\n📊 Analyzing bot crawls from last ${days} days...\n`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  // 1. Get bot visit summary
  const { data: botStats, error: botError } = await supabase
    .from('cloudflare_request_logs')
    .select('bot_type, cache_status, path')
    .eq('is_bot', true)
    .gte('timestamp', cutoffDate.toISOString())
    .order('timestamp', { ascending: false });
  
  if (botError) {
    console.error('Error fetching bot stats:', botError);
    return;
  }
  
  if (!botStats || botStats.length === 0) {
    console.log('No bot visits found in this period.');
    return;
  }
  
  // Group by bot type
  const botSummary = new Map<string, BotCrawlStats>();
  
  for (const log of botStats) {
    const botType = log.bot_type || 'unknown';
    
    if (!botSummary.has(botType)) {
      botSummary.set(botType, {
        bot_type: botType,
        total_visits: 0,
        unique_pages: 0,
        cache_hits: 0,
        cache_misses: 0,
        top_pages: [],
      });
    }
    
    const stats = botSummary.get(botType)!;
    stats.total_visits++;
    
    if (log.cache_status === 'HIT') stats.cache_hits++;
    if (log.cache_status === 'MISS') stats.cache_misses++;
  }
  
  // Print bot summary
  console.log('🤖 Bot Visit Summary:');
  console.log('─'.repeat(80));
  
  const sortedBots = Array.from(botSummary.values()).sort((a, b) => b.total_visits - a.total_visits);
  
  for (const stats of sortedBots) {
    const cacheHitRate = stats.total_visits > 0 
      ? ((stats.cache_hits / stats.total_visits) * 100).toFixed(1) 
      : '0.0';
    
    console.log(`${stats.bot_type.padEnd(20)} | Visits: ${String(stats.total_visits).padStart(5)} | Cache Hit Rate: ${cacheHitRate}%`);
  }
  
  console.log('\n');
  
  // 2. Match URLs to agent profiles
  console.log('🔍 Matching bot visits to agent profiles...\n');
  
  const agentVisits = new Map<string, AgentProfileVisit>();
  
  for (const log of botStats) {
    // Parse URL to extract city and check if it's an agent listing
    if (!log.path || !log.path.includes('/top10realestateagents')) continue;
    
    // Extract state, city from path like: /arizona/mesa/top10realestateagents
    // or /arizona/mesa/85201/old-town/top10realestateagents
    const pathParts = log.path.split('/').filter(Boolean);
    
    if (pathParts.length < 3) continue;
    
    const stateSlug = pathParts[0];
    const citySlug = pathParts[1];
    
    // Query professionals for this city (simplified - in production you'd want to cache this)
    // For now, just log the URL pattern
    const key = `${stateSlug}/${citySlug}`;
    
    if (!agentVisits.has(key)) {
      agentVisits.set(key, {
        agent_id: key,
        agent_name: `${citySlug}, ${stateSlug}`,
        bot_type: log.bot_type || 'unknown',
        visits: 0,
        first_seen: log.timestamp || new Date().toISOString(),
        last_seen: log.timestamp || new Date().toISOString(),
      });
    }
    
    const visit = agentVisits.get(key)!;
    visit.visits++;
  }
  
  // Print agent visit summary
  console.log('📍 Top Agent Pages Visited by Bots:');
  console.log('─'.repeat(80));
  
  const sortedAgents = Array.from(agentVisits.values()).sort((a, b) => b.visits - a.visits);
  
  for (const visit of sortedAgents.slice(0, 20)) {
    console.log(`${visit.agent_name.padEnd(40)} | Visits: ${String(visit.visits).padStart(4)}`);
  }
  
  console.log('\n');
  
  // 3. Summary
  console.log('📈 Summary:');
  console.log('─'.repeat(80));
  console.log(`Total bot requests: ${botStats.length}`);
  console.log(`Unique bot types: ${botSummary.size}`);
  console.log(`Agent pages visited: ${agentVisits.size}`);
  console.log(`Date range: ${cutoffDate.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`);
  console.log('\n');
}

// Parse command line args
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 7;

analyzeBotCrawls(days).catch(console.error);
