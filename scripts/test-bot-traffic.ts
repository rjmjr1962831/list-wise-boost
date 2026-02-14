import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

function loadEnv(): void {
  const env = readFileSync('.env', 'utf-8');
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
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const testPages = [
  'https://www.top10lists.us/arizona/phoenix/top10realestateagents',
  'https://www.top10lists.us/arizona/phoenix/arcadia/top10realestateagents',
  'https://www.top10lists.us/arizona/scottsdale/top10realestateagents',
  'https://www.top10lists.us/arizona/tucson/top10realestateagents',
  'https://www.top10lists.us/arizona/mesa/top10realestateagents'
];

async function makeRequest(url: string, userAgent: string, attempt: number) {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent
      }
    });
    
    const duration = Date.now() - startTime;
    const cacheStatus = response.headers.get('cf-cache-status') || 'UNKNOWN';
    const rayId = response.headers.get('cf-ray') || 'N/A';
    
    console.log(`  [Attempt ${attempt}] ${response.status} - Cache: ${cacheStatus} - ${duration}ms - Ray: ${rayId}`);
    
    return {
      url,
      status: response.status,
      cacheStatus,
      rayId,
      duration
    };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function testAsBot() {
  console.log('🤖 Testing site as bot traffic...\n');
  
  // Bot user agents to test
  const botAgents = [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Claude-Web/1.0'
  ];
  
  const botAgent = botAgents[0]; // Use Googlebot
  console.log(`User-Agent: ${botAgent}\n`);
  
  // Make 2 requests to each page to test cache warming
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Round ${attempt} - ${attempt === 1 ? 'Cold Cache' : 'Cache Test'}`);
    console.log('='.repeat(60));
    
    for (const url of testPages) {
      const shortUrl = url.replace('https://www.top10lists.us', '');
      console.log(`\n📄 ${shortUrl}`);
      await makeRequest(url, botAgent, attempt);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Longer delay between rounds
    if (attempt === 1) {
      console.log('\n⏳ Waiting 2 seconds before round 2...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Check if logs were recorded
  console.log('\n' + '='.repeat(60));
  console.log('Checking database logs...');
  console.log('='.repeat(60) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for logs to be written
  
  const { data: logs, error } = await supabase
    .from('cloudflare_request_logs')
    .select('timestamp, path, cache_status, bot_type')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error fetching logs:', error);
  } else if (logs && logs.length > 0) {
    console.log('📊 Recent logs in database:');
    logs.forEach((log, i) => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      console.log(`  ${i + 1}. ${time} - ${log.path || 'N/A'} - Cache: ${log.cache_status || 'N/A'} - Bot: ${log.bot_type || 'N/A'}`);
    });
  } else {
    console.log('⚠️ No recent logs found in database');
  }
  
  // Show cache statistics
  const { data: allLogs } = await supabase
    .from('cloudflare_request_logs')
    .select('cache_status');
  
  if (allLogs && allLogs.length > 0) {
    const hits = allLogs.filter(l => l.cache_status === 'HIT').length;
    const misses = allLogs.filter(l => l.cache_status === 'MISS').length;
    const dynamic = allLogs.filter(l => l.cache_status === 'DYNAMIC').length;
    const total = allLogs.length;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : 0;
    
    console.log('\n📈 Cache Statistics:');
    console.log(`   Total requests: ${total}`);
    console.log(`   Cache HITs: ${hits} (${hitRate}%)`);
    console.log(`   Cache MISSes: ${misses}`);
    console.log(`   DYNAMIC: ${dynamic}`);
  }
}

testAsBot();
