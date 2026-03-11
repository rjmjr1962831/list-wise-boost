/**
 * Enrich all CA agents missing emails via batch-memo23-enrichment.
 * Uses proxy-cheap residential proxies via the deployed edge function.
 * Run: npx tsx scripts/enrich-ca-missing-emails.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
const envPath = resolve(import.meta.dirname || '.', '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx);
    const val = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPABASE_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 5_000; // 5s between batches to avoid rate limits

async function runBatch(offset: number): Promise<{ nextOffset: number | null; stats: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/batch-memo23-enrichment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SRK}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      stateSlug: 'california',
      batchSize: BATCH_SIZE,
      offset,
      missingEmailOnly: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }

  return { nextOffset: data.nextOffset, stats: data.stats };
}

async function main() {
  console.log('🚀 Starting CA missing-email enrichment via memo23 + proxy-cheap');
  console.log(`   Batch size: ${BATCH_SIZE}, Delay: ${DELAY_BETWEEN_BATCHES_MS}ms\n`);

  let offset = 0;
  let totalSuccess = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  let batchNum = 0;

  while (true) {
    batchNum++;
    const startTime = Date.now();

    try {
      console.log(`📦 Batch ${batchNum} (offset ${offset})...`);
      const { nextOffset, stats } = await runBatch(offset);

      totalSuccess += stats.batchSuccess || 0;
      totalErrors += stats.batchErrors || 0;
      totalSkipped += stats.batchSkipped || 0;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ✅ ${stats.batchSuccess} success, ${stats.batchErrors} errors, ${stats.batchSkipped} skipped (${elapsed}s)`);
      console.log(`   📊 Progress: ${stats.processed}/${stats.total} (${stats.remaining} remaining)`);

      if (!nextOffset || stats.remaining <= 0) {
        console.log('\n🏁 All batches complete!');
        break;
      }

      // Use offset 0 each time since successfully enriched agents drop out of the missingEmailOnly filter
      // But if some agents fail (no email found), they stay in the queue - use nextOffset to skip them
      offset = nextOffset;

      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch...\n`);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    } catch (err: any) {
      console.error(`   ❌ Batch ${batchNum} failed: ${err.message}`);
      totalErrors++;

      // Wait longer on error, then continue
      console.log('   ⏳ Waiting 30s after error...\n');
      await new Promise(r => setTimeout(r, 30_000));
      offset += BATCH_SIZE; // skip this batch
    }
  }

  console.log(`\n📊 Final stats:`);
  console.log(`   Success: ${totalSuccess}`);
  console.log(`   Errors:  ${totalErrors}`);
  console.log(`   Skipped: ${totalSkipped}`);
  console.log(`   Total batches: ${batchNum}`);
}

main().catch(console.error);
