/**
 * Scrape active agents' published websites for:
 *   - Brokerage name
 *   - Brokerage address
 *   - Phone numbers (all, with labels: office, mobile, fax, etc.)
 *   - Email address
 *
 * Uses only local fetch + HTML parsing (no Firecrawl). Extracts from JSON-LD,
 * tel:/mailto: links, and regex over page text.
 *
 * Writes each agent's result to professionals.raw_scraper_data.website_contact
 * (merged with existing blob). Also writes CSV + JSON to scripts/output/.
 *
 * Run: npx tsx scripts/scrape-agent-websites.ts [--limit N] [--delay 1500]
 * Default: no limit (all active agents with website). Use --limit 10 for a quick test.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
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
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY!);

// --- Types ---
export interface PhoneWithLabel {
  number: string;
  label: string;
}

export interface ScrapedContact {
  agentId: string;
  agentName: string;
  website: string;
  brokerageName: string | null;
  brokerageAddress: string | null;
  phoneNumbers: PhoneWithLabel[];
  email: string | null;
  error?: string;
}

// --- Regex and constants ---
const PHONE_REGEX = /(?:(?:\+?1)?[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)?\d{3}[\s\-.]?\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,6})?/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MOBILE_HINTS = ['mobile', 'cell', 'text', 'sms', 'm:'];
const OFFICE_HINTS = ['office', 'main', 'business', 'work', 'direct', 'o:'];
const FAX_HINTS = ['fax', 'f:'];
// US-style address: number + street, optional suite, city, state zip
const ADDRESS_LINE_REGEX = /\d+[\s\w.-]+(?:street|st|avenue|ave|road|rd|blvd|drive|dr|lane|ln|way|court|ct|circle|cir|suite|ste|#)[\s\w.-]*/gi;
const CITY_STATE_ZIP_REGEX = /[A-Za-z\s]+,\s*[A-Za-z]{2}\s+\d{5}(?:-\d{4})?/g;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D+/g, '');
  const ten = digits.length === 10 ? digits : digits.startsWith('1') && digits.length === 11 ? digits.slice(1) : null;
  return ten ? ten.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : null;
}

function inferPhoneLabel(context: string): string {
  const c = context.toLowerCase();
  if (FAX_HINTS.some((h) => c.includes(h))) return 'fax';
  if (MOBILE_HINTS.some((h) => c.includes(h))) return 'mobile';
  if (OFFICE_HINTS.some((h) => c.includes(h))) return 'office';
  return 'phone';
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// --- JSON-LD extraction (schema.org Organization, RealEstateAgent, LocalBusiness) ---
function extractFromJsonLd(html: string): { brokerageName: string | null; brokerageAddress: string | null } {
  let brokerageName: string | null = null;
  let brokerageAddress: string | null = null;

  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRegex.exec(html)) !== null) {
    try {
      const raw = m[1].trim();
      let data = JSON.parse(raw) as unknown;
      const items = Array.isArray(data) ? data : data && typeof data === 'object' && '@graph' in data ? (data as { '@graph': unknown[] })['@graph'] : [data];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
        const type = obj['@type'];
        const typeStr = Array.isArray(type) ? type.join(' ') : typeof type === 'string' ? type : '';
        if (!/Organization|RealEstateAgent|LocalBusiness|RealEstateOrganization/i.test(typeStr)) continue;

        if (!brokerageName && obj.name && typeof obj.name === 'string') {
          const name = cleanText(obj.name);
          if (name.length > 1 && name.length < 200) brokerageName = name;
        }
        if (!brokerageAddress && obj.address) {
          const addr = obj.address;
          if (typeof addr === 'string' && addr.length > 5 && addr.length < 300) {
            brokerageAddress = cleanText(addr);
          } else if (addr && typeof addr === 'object' && !Array.isArray(addr)) {
            const a = addr as Record<string, unknown>;
            const parts = [
              a.streetAddress,
              a.addressLocality,
              a.addressRegion,
              a.postalCode,
            ].filter(Boolean).map(String).map(cleanText);
            if (parts.length > 0) brokerageAddress = parts.join(', ');
          }
        }
        // Nested organization (e.g. RealEstateAgent worksFor Organization)
        if (!brokerageName && obj.worksFor && typeof obj.worksFor === 'object' && !Array.isArray(obj.worksFor)) {
          const w = obj.worksFor as Record<string, unknown>;
          if (w.name && typeof w.name === 'string') {
            const name = cleanText(w.name);
            if (name.length > 1 && name.length < 200) brokerageName = name;
          }
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }
  return { brokerageName, brokerageAddress };
}

// --- Brokerage name from page text (e.g. "at Coldwell Banker", "Keller Williams") ---
const BROKERAGE_PATTERNS = [
  /\b(at|with|@)\s+([A-Za-z0-9\s&.'-]+(?:Realty|Real Estate|Properties|Property Group|Homes|Group|RE\/MAX|Coldwell\s+Banker|Keller\s+Williams|eXp\s+Realty|Compass|Sotheby's|Berkshire\s+Hathaway|Century\s+21)[^\n.,]*)/i,
  /(?:brokerage|licensed\s+with)\s*[:\s]+([A-Za-z0-9\s&.'-]{2,80})/i,
  /(?:company|office)\s*[:\s]+([A-Za-z0-9\s&.'-]{2,80})/i,
];

function extractBrokerageNameFromText(text: string): string | null {
  for (const re of BROKERAGE_PATTERNS) {
    const match = text.match(re);
    if (match) {
      const name = cleanText(match[2] ?? match[1] ?? '');
      if (name.length > 2 && name.length < 150) return name;
    }
  }
  return null;
}

// --- Address from page text (footer-style lines) ---
function extractAddressFromText(text: string): string | null {
  // Prefer multi-line block that looks like street + city state zip
  const blocks = text.split(/\n+/).map((l) => cleanText(l)).filter((l) => l.length > 5);
  for (let i = 0; i < blocks.length; i++) {
    const line = blocks[i];
    if (!/\d{5}/.test(line)) continue;
    const cityStateZip = line.match(/[A-Za-z\s]+,\s*[A-Za-z]{2}\s+\d{5}(?:-\d{4})?/);
    if (cityStateZip) {
      const prev = i > 0 ? blocks[i - 1] : '';
      const street = prev && /\d+/.test(prev) && prev.length < 80 ? prev : '';
      const full = street ? `${street}, ${cityStateZip[0]}` : cityStateZip[0];
      if (full.length > 10 && full.length < 250) return full;
    }
  }
  const oneLiner = text.match(/\d+[\s\w.-]+(?:st|street|ave|avenue|rd|road|blvd|dr|drive)[\s\w.,-]+[A-Za-z]{2}\s+\d{5}/i);
  if (oneLiner) {
    const a = cleanText(oneLiner[0]);
    if (a.length > 10 && a.length < 250) return a;
  }
  return null;
}

// --- Full HTML extraction ---
function extractFromHtml(html: string): {
  brokerageName: string | null;
  brokerageAddress: string | null;
  phoneNumbers: PhoneWithLabel[];
  email: string | null;
} {
  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '\n');
  const seenPhone = new Set<string>();
  const phoneNumbers: PhoneWithLabel[] = [];

  // 1. JSON-LD
  const fromLd = extractFromJsonLd(html);
  let brokerageName = fromLd.brokerageName;
  let brokerageAddress = fromLd.brokerageAddress;

  // 2. Brokerage name from text if not in JSON-LD
  if (!brokerageName) brokerageName = extractBrokerageNameFromText(text);
  if (!brokerageAddress) brokerageAddress = extractAddressFromText(text);

  // 3. tel: links (with context for label)
  const telRe = /<a[^>]*href=["']tel:([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = telRe.exec(html)) !== null) {
    const raw = m[1].replace(/^tel:/i, '').trim();
    const normalized = normalizePhone(raw);
    if (normalized && !seenPhone.has(normalized)) {
      seenPhone.add(normalized);
      const context = (m[2] || '').trim();
      phoneNumbers.push({ number: normalized, label: inferPhoneLabel(context) });
    }
  }

  // 4. Phones from text
  const phoneMatches = text.match(PHONE_REGEX) || [];
  for (const raw of phoneMatches) {
    const normalized = normalizePhone(raw);
    if (!normalized || seenPhone.has(normalized)) continue;
    seenPhone.add(normalized);
    const idx = text.indexOf(raw);
    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + raw.length + 60);
    const context = text.slice(start, end);
    phoneNumbers.push({ number: normalized, label: inferPhoneLabel(context) });
  }

  // 5. mailto: for email (prefer first mailto)
  const mailtoRe = /<a[^>]*href=["']mailto:([^"']+)["']/gi;
  let mailtoMatch: RegExpExecArray | null;
  let email: string | null = null;
  while ((mailtoMatch = mailtoRe.exec(html)) !== null) {
    const raw = mailtoMatch[1].replace(/\?.*$/, '').trim().toLowerCase();
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(raw) && !/\.(png|jpg|gif|css|js|woff)/i.test(raw)) {
      email = raw;
      break;
    }
  }
  if (!email) {
    const emails = text.match(EMAIL_REGEX) || [];
    const filtered = emails.filter((e) => !/\.(png|jpg|jpeg|gif|css|js|woff|ico)$/i.test(e) && e.length < 80);
    if (filtered.length > 0) email = filtered[0];
  }

  return { brokerageName, brokerageAddress, phoneNumbers, email };
}

async function scrapeUrl(url: string): Promise<Omit<ScrapedContact, 'agentId' | 'agentName' | 'website'>> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Top10Lists/1.0; +https://www.top10lists.us)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { brokerageName: null, brokerageAddress: null, phoneNumbers: [], email: null };
    const html = await res.text();
    return extractFromHtml(html);
  } catch {
    return { brokerageName: null, brokerageAddress: null, phoneNumbers: [], email: null };
  }
}

function normalizeUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : 'https://' + u;
}

// --- Main ---
async function main() {
  const args = process.argv.slice(2);
  const getArg = (key: string, def: string) => {
    const eq = args.find((a) => a.startsWith(`${key}=`));
    if (eq) return eq.split('=')[1];
    const i = args.indexOf(key);
    if (i >= 0 && args[i + 1]) return args[i + 1];
    return def;
  };
  const maxTotal = parseInt(getArg('--limit', '0'), 10) || 0; // 0 = no cap, run all
  const delayMs = parseInt(getArg('--delay', '1500'), 10);
  const BATCH_SIZE = 1000; // Supabase default max per request

  console.log('\n=== Scrape active agents’ websites (local fetch, no Firecrawl) ===\n');
  console.log('Options: maxTotal=%s, delay=%s ms (0 = all agents)\n', maxTotal || 'all', delayMs);

  const results: ScrapedContact[] = [];
  let offset = 0;
  let totalProcessed = 0;

  while (true) {
    const limitThisBatch = maxTotal > 0 ? Math.min(BATCH_SIZE, maxTotal - totalProcessed) : BATCH_SIZE;
    if (maxTotal > 0 && limitThisBatch <= 0) break;

    const { data: agents, error } = await supabase
      .from('professionals')
      .select('id, name, website, raw_scraper_data')
      .eq('active', true)
      .not('website', 'is', null)
      .neq('website', '')
      .range(offset, offset + limitThisBatch - 1);

    if (error) {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }
    if (!agents?.length) {
      console.log('No more agents. Total processed:', totalProcessed);
      break;
    }

    console.log(`\n--- Batch: offset ${offset}, ${agents.length} agents ---\n`);

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const website = agent.website?.trim();
      if (!website) continue;

      const url = normalizeUrl(website);
      const scraped = await scrapeUrl(url);
      const row: ScrapedContact = {
        agentId: agent.id,
        agentName: agent.name ?? '',
        website: url,
        ...scraped,
      };
      results.push(row);
      totalProcessed += 1;

      const websiteContact = {
        scrapedAt: new Date().toISOString(),
        brokerageName: row.brokerageName,
        brokerageAddress: row.brokerageAddress,
        phoneNumbers: row.phoneNumbers,
        email: row.email,
      };
      const existingRaw = (agent as { raw_scraper_data?: Record<string, unknown> | null }).raw_scraper_data;
      const mergedRaw =
        existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)
          ? { ...existingRaw, website_contact: websiteContact }
          : { website_contact: websiteContact };

      const { error: updateErr } = await supabase
        .from('professionals')
        .update({ raw_scraper_data: mergedRaw })
        .eq('id', agent.id);

      if (updateErr) console.error(`  ⚠ Update blob failed for ${agent.name}:`, updateErr.message);
      else console.log(`  [${totalProcessed}] ${agent.name} – brokerage: ${row.brokerageName ?? '—'} | phones: ${row.phoneNumbers.length} | email: ${row.email ? 'yes' : '—'} | blob ✓`);

      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }

    offset += agents.length;
    if (agents.length < BATCH_SIZE || (maxTotal > 0 && totalProcessed >= maxTotal)) break;
  }

  const outDir = resolve(process.cwd(), 'scripts', 'output');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = `scrape-agent-websites-${ts}`;

  const jsonPath = resolve(outDir, `${baseName}.json`);
  writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log('\nWrote:', jsonPath);

  const csvPath = resolve(outDir, `${baseName}.csv`);
  const header = 'agentId,agentName,website,brokerageName,brokerageAddress,phoneNumbers (label: number),email';
  const csvRows = [
    header,
    ...results.map((r) => {
      const phones = r.phoneNumbers.map((p) => `${p.label}: ${p.number}`).join('; ');
      const escape = (s: string | null) => (s == null ? '' : `"${String(s).replace(/"/g, '""')}"`);
      return [r.agentId, r.agentName, r.website, r.brokerageName, r.brokerageAddress, phones, r.email].map(escape).join(',');
    }),
  ];
  writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
  console.log('Wrote:', csvPath);

  console.log('\nDone. Total:', results.length);
}

main().catch(console.error);
