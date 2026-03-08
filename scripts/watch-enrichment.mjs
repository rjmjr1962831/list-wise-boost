/**
 * Watchdog for CA enrichment process.
 * Polls the DB every 60s and alerts when no new enrichments happen for 3 minutes.
 *
 * Usage: node scripts/watch-enrichment.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const key = readFileSync('.env', 'utf8').match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient('https://wiotrvoirdgzfacuuiem.supabase.co', key);

let lastCount = null;
let staleChecks = 0;
const MAX_STALE = 3; // alert after 3 minutes of no progress

async function check() {
  const { count } = await sb
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .eq('state_slug', 'california')
    .eq('active', true)
    .not('zillow_profile_url', 'is', null)
    .is('email', null)
    .is('phone', null);

  const now = new Date().toLocaleTimeString();
  const remaining = count;
  const enriched = 291 - remaining;

  if (lastCount === null) {
    console.log(`[${now}] Starting watch. ${remaining} remaining, ${enriched} enriched so far.`);
  } else if (remaining < lastCount) {
    const delta = lastCount - remaining;
    console.log(`[${now}] +${delta} enriched. ${remaining} remaining, ${enriched} total done.`);
    staleChecks = 0;
  } else {
    staleChecks++;
    console.log(`[${now}] No change. ${remaining} remaining. (stale check ${staleChecks}/${MAX_STALE})`);

    if (staleChecks >= MAX_STALE) {
      console.log(`\n🚨 ENRICHMENT STOPPED! No progress for ${MAX_STALE} minutes.`);
      console.log(`   ${remaining} agents still need enrichment.`);
      console.log(`   ${enriched}/291 completed.\n`);

      if (remaining === 0) {
        console.log('🎉 All agents enriched! Exiting.');
        process.exit(0);
      }
    }
  }

  if (remaining === 0) {
    console.log(`\n🎉 All done! ${enriched} agents enriched.`);
    process.exit(0);
  }

  lastCount = remaining;
}

// Check every 60 seconds
await check();
setInterval(check, 60000);
