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

async function clearOldCacheLogs() {
  console.log('Clearing old Cloudflare cache logs...\n');
  
  // Calculate "yesterday at noon" cutoff
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(12, 0, 0, 0); // Set to noon
  
  const cutoffDate = yesterday.toISOString();
  console.log(`Cutoff date: ${cutoffDate}`);
  console.log(`(Deleting all records before ${yesterday.toLocaleString()})\n`);
  
  // First, count how many records will be deleted
  const { count: beforeCount, error: countError } = await supabase
    .from('cloudflare_request_logs')
    .select('*', { count: 'exact', head: true })
    .lt('timestamp', cutoffDate);
  
  if (countError) {
    console.error('❌ Error counting records:', countError);
    return;
  }
  
  console.log(`📊 Found ${beforeCount} records to delete\n`);
  
  if (beforeCount === 0) {
    console.log('✅ No old records to delete');
    return;
  }
  
  // Check current cache stats before deletion
  const { data: statsBefore, error: statsBeforeError } = await supabase
    .from('cloudflare_request_logs')
    .select('cache_status')
    .lt('timestamp', cutoffDate);
  
  if (!statsBeforeError && statsBefore) {
    const hits = statsBefore.filter(r => r.cache_status === 'HIT').length;
    const total = statsBefore.length;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : 0;
    console.log(`📈 Cache stats for records being deleted:`);
    console.log(`   Hits: ${hits} / ${total} (${hitRate}%)\n`);
  }
  
  // Delete records in batches to avoid timeouts
  const batchSize = 1000;
  let totalDeleted = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('cloudflare_request_logs')
      .delete()
      .lt('timestamp', cutoffDate)
      .limit(batchSize)
      .select('id');
    
    if (error) {
      console.error('❌ Error deleting batch:', error);
      break;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    totalDeleted += data.length;
    console.log(`🗑️  Deleted ${totalDeleted} records...`);
    
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Deletion complete! Deleted ${totalDeleted} records\n`);
  
  // Show new cache stats
  const { data: statsAfter, error: statsAfterError } = await supabase
    .from('cloudflare_request_logs')
    .select('cache_status');
  
  if (!statsAfterError && statsAfter) {
    const hits = statsAfter.filter(r => r.cache_status === 'HIT').length;
    const total = statsAfter.length;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : 0;
    console.log(`📊 Current cache stats:`);
    console.log(`   Hits: ${hits} / ${total} (${hitRate}%)`);
    console.log(`   Total remaining records: ${total}`);
  }
}

clearOldCacheLogs();
