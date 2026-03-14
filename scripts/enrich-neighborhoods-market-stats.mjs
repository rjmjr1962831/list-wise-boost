#!/usr/bin/env node
/**
 * Enrich neighborhoods with market stats via enrich-city-market-stats edge function.
 * Runs in batches, resumable (skips already-enriched neighborhoods).
 *
 * Usage:
 *   node scripts/enrich-neighborhoods-market-stats.mjs [--limit 500] [--batch 15] [--dry-run]
 */
import { readFileSync } from 'fs';

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
    const i = l.indexOf('=');
    return [l.slice(0, i), l.slice(i + 1)];
  })
);

const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const FUNCTION_URL = 'https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/enrich-city-market-stats';

const args = process.argv.slice(2);
const totalLimit = parseInt(args.find((_, i) => args[i - 1] === '--limit') || '10000');
const batchSize = parseInt(args.find((_, i) => args[i - 1] === '--batch') || '15');
const dryRun = args.includes('--dry-run');
const statesArg = args.find((_, i) => args[i - 1] === '--states');
const states = statesArg ? statesArg.split(',') : null;

let processed = 0;
let successful = 0;
let errors = 0;
let batchNum = 0;

console.log(`Starting neighborhood market stats enrichment`);
console.log(`Batch size: ${batchSize}, Total limit: ${totalLimit}, Dry run: ${dryRun}, States: ${states ? states.join(', ') : 'all'}`);
console.log('---');

while (processed < totalLimit) {
  batchNum++;
  const remaining = totalLimit - processed;
  const thisBatch = Math.min(batchSize, remaining);

  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'neighborhoods',
        limit: thisBatch,
        dryRun,
        ...(states && { states }),
      }),
      signal: AbortSignal.timeout(120000),
    });

    const data = await res.json();

    if (data.error) {
      console.error(`Batch ${batchNum} error:`, data.error);
      errors++;
      if (errors > 5) { console.error('Too many consecutive errors, stopping'); break; }
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    errors = 0; // reset consecutive error count
    processed += data.processed || 0;
    successful += data.successful || 0;

    const failedNames = (data.results || []).filter(r => r.status !== 'success').map(r => r.name);
    console.log(`Batch ${batchNum}: ${data.successful}/${data.processed} ok | Total: ${successful}/${processed} | ${failedNames.length ? 'Failed: ' + failedNames.join(', ') : ''}`);

    if (data.processed === 0) {
      console.log('No more neighborhoods to process!');
      break;
    }

    // Small pause between batches
    await new Promise(r => setTimeout(r, 1000));
  } catch (err) {
    console.error(`Batch ${batchNum} fetch error:`, err.message);
    errors++;
    if (errors > 5) { console.error('Too many consecutive errors, stopping'); break; }
    await new Promise(r => setTimeout(r, 10000));
  }
}

console.log('---');
console.log(`Done. Processed: ${processed}, Successful: ${successful}`);
