/**
 * Resolve email_provider for custom domains via MX lookup.
 * Only processes domains currently classified as private (not gmail/outlook consumer domains).
 *
 * Usage:
 *   npm run email-provider:mx              -- Check MX for all private domains, update DB to gmail/outlook where applicable
 *   npm run email-provider:mx -- --report  -- Report only: look up MX for each private domain, print domain -> provider (no DB update)
 *
 * Env: .env (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import * as dns from 'dns';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const resolveMx = promisify(dns.resolveMx);

function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const env = readFileSync(envPath, 'utf-8');
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wiotrvoirdgzfacuuiem.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const DELAY_MS = 400; // between domain lookups (reduced so full run finishes in ~3 min)
const BATCH_SIZE = 100; // max professionals to update per domain per round

const REPORT_ONLY = process.argv.includes('--report');

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function domainFromEmail(email: string | null): string | null {
  if (!email || !email.includes('@')) return null;
  const part = email.trim().split('@')[1]?.trim().toLowerCase();
  return part || null;
}

const KNOWN_CONSUMER_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'passport.com',
  'hotmail.co.uk', 'live.co.uk', 'outlook.co.uk', 'outlook.fr', 'outlook.de',
  'outlook.es', 'outlook.it', 'outlook.jp', 'outlook.kr', 'outlook.com.au',
  'outlook.at', 'outlook.be', 'outlook.cl', 'outlook.dk', 'outlook.gr',
  'outlook.ie', 'outlook.in', 'outlook.nl', 'outlook.pt', 'outlook.sa',
  'outlook.se', 'outlook.sg', 'outlook.tw', 'outlook.my', 'outlook.co.th',
  'outlook.ph', 'outlook.vn', 'outlook.co.id', 'outlook.co.nz', 'outlook.hu',
  'outlook.rs', 'outlook.sk', 'outlook.co.za', 'outlook.ae', 'outlook.eg',
  'outlook.com.br', 'outlook.com.mx', 'outlook.com.ar', 'outlook.com.pe',
  'outlook.com.co', 'outlook.com.ve', 'outlook.qa', 'outlook.pk', 'outlook.bg',
  'outlook.hr', 'outlook.lv', 'outlook.lt', 'outlook.ee', 'outlook.si',
  'outlook.ro', 'outlook.by', 'outlook.az', 'outlook.ge', 'outlook.kz',
  'outlook.ua', 'outlook.uz', 'outlook.tm', 'outlook.tj', 'outlook.kg',
  'outlook.am', 'outlook.md',
]);

function isConsumerDomain(domain: string): boolean {
  return KNOWN_CONSUMER_DOMAINS.has(domain) ||
    domain.endsWith('.outlook.') || domain.startsWith('outlook.') ||
    domain.endsWith('.hotmail.') || domain.startsWith('hotmail.') ||
    domain.endsWith('.live.') || domain.startsWith('live.');
}

/**
 * Resolve MX for domain; return 'gmail' | 'outlook' | 'private'.
 */
async function resolveProviderFromMx(domain: string): Promise<'gmail' | 'outlook' | 'private'> {
  try {
    const records = await resolveMx(domain);
    if (!records || records.length === 0) return 'private';
    const sorted = records.slice().sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const exchange = (sorted[0].exchange || '').toLowerCase();
    if (exchange.includes('google.com') || exchange.includes('aspmx.l.google') || exchange.includes('smtp.google')) return 'gmail';
    if (exchange.includes('outlook') || exchange.includes('office365') || exchange.includes('microsoft.com') || exchange.includes('protection.outlook')) return 'outlook';
    return 'private';
  } catch {
    return 'private';
  }
}

async function main() {
  if (!SUPABASE_KEY) {
    console.error('Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_PUBLISHABLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: rows, error: fetchError } = await supabase
    .from('professionals')
    .select('id, email, email_provider')
    .eq('email_provider', 'private')
    .not('email', 'is', null);

  if (fetchError) {
    console.error('Fetch error:', fetchError);
    process.exit(1);
  }

  const withDomain = (rows || []).filter((r: { email?: string | null }) => {
    const d = domainFromEmail(r.email ?? null);
    return d && !isConsumerDomain(d);
  });

  const domainToIds = new Map<string, string[]>();
  for (const r of withDomain) {
    const d = domainFromEmail((r as { email?: string | null }).email ?? null);
    if (!d) continue;
    const ids = domainToIds.get(d) || [];
    ids.push((r as { id: string }).id);
    domainToIds.set(d, ids);
  }

  const domains = Array.from(domainToIds.keys());
  if (REPORT_ONLY) {
    console.log('MX lookup for private domains only (no DB update).\n');
    console.log('domain\tprovider\tprofessional_count');
    console.log('------\t--------\t-------------------');
    let gmailCount = 0, outlookCount = 0, privateCount = 0;
    for (const domain of domains) {
      await sleep(DELAY_MS);
      const provider = await resolveProviderFromMx(domain);
      const count = domainToIds.get(domain)!.length;
      if (provider === 'gmail') gmailCount += count;
      else if (provider === 'outlook') outlookCount += count;
      else privateCount += count;
      console.log(`${domain}\t${provider}\t${count}`);
    }
    console.log('------\t--------\t-------------------');
    console.log(`\nSummary: gmail=${gmailCount}, outlook=${outlookCount}, private=${privateCount} (from MX for ${domains.length} custom domains)`);
    return;
  }

  console.log(`Found ${domains.length} custom domains (${withDomain.length} professionals). Resolving MX and updating DB...\n`);

  let updatedGmail = 0;
  let updatedOutlook = 0;
  let failed = 0;

  for (const domain of domains) {
    await sleep(DELAY_MS);
    const provider = await resolveProviderFromMx(domain);
    const ids = domainToIds.get(domain)!;
    if (provider === 'gmail' || provider === 'outlook') {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('professionals')
          .update({ email_provider: provider })
          .in('id', chunk);

        if (error) {
          console.error(`  ${domain} -> ${provider} update error:`, error.message);
          failed += chunk.length;
        } else {
          if (provider === 'gmail') updatedGmail += chunk.length;
          else updatedOutlook += chunk.length;
        }
      }
      console.log(`  ${domain} -> ${provider} (${ids.length} row(s))`);
    }
  }

  console.log(`\nDone. Updated: gmail=${updatedGmail}, outlook=${updatedOutlook}. Failed=${failed}.`);
}

main().catch(console.error);
