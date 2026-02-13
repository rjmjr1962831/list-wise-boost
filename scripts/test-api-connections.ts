/**
 * Test all API connections and report any errors.
 * Run: npx tsx scripts/test-api-connections.ts
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const env = readFileSync(envPath, 'utf-8');
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ENRICHMENT_KEY = 't10l_enrich_0448c4870d72ed90fd43171123fd0e44558f019a2b5807d1b297604dad6b235a';

interface TestResult {
  name: string;
  status: 'ok' | 'error';
  message?: string;
  details?: unknown;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, status: 'ok' });
    console.log(`✅ ${name}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const details = err instanceof Error ? { stack: err.stack } : err;
    results.push({ name, status: 'error', message: msg, details });
    console.error(`❌ ${name}: ${msg}`);
  }
}

async function main() {
  console.log('\n=== API Connection Tests ===\n');
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('Anon key set:', !!SUPABASE_ANON_KEY);
  console.log('');

  if (!SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_PUBLISHABLE_KEY not set in .env');
    process.exit(1);
  }

  // 1. Supabase REST API - professionals table
  await test('Supabase REST: professionals (anon)', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/professionals?select=id&active=eq.true&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  });

  // 2. Supabase REST API - cities table
  await test('Supabase REST: cities (anon)', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cities?select=id&active=eq.true&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
  });

  // 3. Enrichment API - audit (requires X-Enrichment-Key)
  await test('Enrichment API: audit', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/enrichment-api?action=audit`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Enrichment-Key': ENRICHMENT_KEY,
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error);
  });

  // 4. Public API - agents-search (optional; may need redeploy of enrichment-api)
  await test('Public API: agents-search', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/enrichment-api?action=agents-search&city=Scottsdale&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Enrichment-Key': ENRICHMENT_KEY,
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.error && !Array.isArray(data) && !data.results) throw new Error(data.error);
  });

  // 5. Public API - markets
  await test('Public API: markets', async () => {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/enrichment-api?action=markets`,
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'X-Enrichment-Key': ENRICHMENT_KEY,
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.error && !Array.isArray(data) && !data.states) throw new Error(data.error);
  });

  // 6. Live site homepage
  await test('Live site: www.top10lists.us', async () => {
    const res = await fetch('https://www.top10lists.us/', {
      headers: { 'User-Agent': 'Top10Lists-API-Test/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    if (html.includes('ReferenceError') || html.includes('TypeError') || html.includes('SyntaxError')) {
      throw new Error('JavaScript error detected in page');
    }
  });

  // 7. Vercel API proxy (badge endpoint)
  await test('Vercel API: badge route', async () => {
    const res = await fetch('https://www.top10lists.us/api/v1/badge/test-agent-id');
    // 404 or 500 would indicate an error; 200 or 302 might be ok
    if (res.status >= 500) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
    }
  });

  // Summary
  const errors = results.filter((r) => r.status === 'error');
  console.log('\n--- Summary ---');
  console.log(`Passed: ${results.length - errors.length}`);
  console.log(`Failed: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach((e) => console.log(`  - ${e.name}: ${e.message}`));
    process.exit(1);
  }
  console.log('\nAll API connections OK.\n');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
