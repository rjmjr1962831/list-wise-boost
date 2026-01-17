import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Patterns for phone type hints
const MOBILE_HINTS = ['mobile', 'cell', 'text', 'sms', 'call/text', 'call or text', 'm:'];
const BUSINESS_HINTS = ['office', 'main', 'business', 'work', 'phone', 'tel', 't:', 'o:', 'direct'];
const FAX_HINTS = ['fax', 'f:', 'facsimile'];

// Phone regex pattern
const PHONE_REGEX = /(?:(?:\+?1)?[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)?\d{3}[\s\-.]?\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,6})?/gi;
const TEL_HREF_REGEX = /^tel:/i;

interface FoundPhone {
  input_url: string;
  page_url: string;
  raw: string;
  normalized: string;
  inferred_type: string;
  context: string;
}

interface ScrapeResult {
  url: string;
  phones: FoundPhone[];
  error?: string;
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  
  // Extract digits only
  let digits = raw.replace(/\D+/g, '');
  
  // Handle US country code
  if (digits.startsWith('1') && digits.length === 11) {
    digits = digits.substring(1);
  }
  
  // Must be 10 digits for US
  if (digits.length === 10) {
    return '+1' + digits;
  }
  
  // Handle extension
  if (digits.length > 10) {
    const base = digits.substring(0, 10);
    const ext = digits.substring(10);
    if (base.length === 10 && ext.length <= 6) {
      return '+1' + base + 'x' + ext;
    }
  }
  
  return null;
}

function inferTypeFromContext(context: string): string {
  const c = (context || '').toLowerCase();
  
  // Check fax first (priority)
  if (FAX_HINTS.some(h => c.includes(h))) {
    return 'fax';
  }
  
  // Check mobile
  if (MOBILE_HINTS.some(h => c.includes(h))) {
    return 'mobile';
  }
  
  // Check business
  if (BUSINESS_HINTS.some(h => c.includes(h))) {
    return 'business';
  }
  
  return 'unknown';
}

function extractPhonesFromText(
  inputUrl: string,
  pageUrl: string,
  text: string,
  html: string
): FoundPhone[] {
  const found: FoundPhone[] = [];
  const seen = new Set<string>();
  
  // Extract tel: links from HTML
  const telLinkRegex = /<a[^>]*href=["']tel:([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  
  while ((match = telLinkRegex.exec(html)) !== null) {
    const raw = match[1].replace(/tel:/i, '');
    const normalized = normalizePhone(raw);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      const linkText = match[2] || '';
      const inferredType = inferTypeFromContext(linkText);
      found.push({
        input_url: inputUrl,
        page_url: pageUrl,
        raw,
        normalized,
        inferred_type: inferredType,
        context: linkText.substring(0, 160)
      });
    }
  }
  
  // Extract from text using regex
  const candidates = text.match(PHONE_REGEX) || [];
  
  for (const cand of candidates) {
    const normalized = normalizePhone(cand);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    
    // Find context around the phone number
    const idx = text.indexOf(cand);
    let context = '';
    if (idx !== -1) {
      const start = Math.max(0, idx - 80);
      const end = Math.min(text.length, idx + cand.length + 80);
      context = text.substring(start, end).trim();
    }
    
    const inferredType = inferTypeFromContext(context);
    found.push({
      input_url: inputUrl,
      page_url: pageUrl,
      raw: cand,
      normalized,
      inferred_type: inferredType,
      context: context.substring(0, 160)
    });
  }
  
  return found;
}

async function scrapeWithFirecrawl(
  url: string,
  apiKey: string
): Promise<{ markdown: string; html: string; links: string[] } | null> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false, // We need full page for phone numbers
        waitFor: 2000,
      }),
    });
    
    if (!response.ok) {
      console.error(`Firecrawl error for ${url}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return {
      markdown: data.data?.markdown || data.markdown || '',
      html: data.data?.html || data.html || '',
      links: data.data?.links || data.links || [],
    };
  } catch (error) {
    console.error(`Firecrawl fetch error for ${url}:`, error);
    return null;
  }
}

function getContactLinks(baseUrl: string, links: string[], maxLinks: number = 2): string[] {
  const contactPatterns = [
    '/contact', 'contact-us', '/about', '/locations', 
    'reach-us', 'get-in-touch', '/team', '/staff'
  ];
  
  const baseHost = new URL(baseUrl).hostname;
  const seen = new Set<string>();
  const result: string[] = [];
  
  for (const link of links) {
    try {
      const url = new URL(link, baseUrl);
      if (url.hostname !== baseHost) continue;
      
      const href = url.href;
      if (seen.has(href)) continue;
      
      const lowerHref = href.toLowerCase();
      if (contactPatterns.some(p => lowerHref.includes(p))) {
        seen.add(href);
        result.push(href);
        if (result.length >= maxLinks) break;
      }
    } catch {
      // Invalid URL, skip
    }
  }
  
  return result;
}

async function classifyPhonesWithDeepSeek(
  phones: FoundPhone[],
  apiKey: string
): Promise<FoundPhone[]> {
  if (phones.length === 0) return phones;
  
  // Only classify phones with 'unknown' type
  const unknownPhones = phones.filter(p => p.inferred_type === 'unknown');
  if (unknownPhones.length === 0) return phones;
  
  try {
    const prompt = `Classify these phone numbers as either "mobile", "business", or "fax" based on the context provided. Return a JSON array with the same order.

Phone numbers to classify:
${unknownPhones.map((p, i) => `${i + 1}. Phone: ${p.normalized}, Context: "${p.context}"`).join('\n')}

Return ONLY a JSON array of objects with "index" (1-based) and "type" (mobile/business/fax). Example:
[{"index": 1, "type": "business"}, {"index": 2, "type": "mobile"}]`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a phone number classifier. Analyze context clues to determine if a phone is mobile, business, or fax. Default to business if unsure.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      console.error('DeepSeek API error:', response.status);
      return phones;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const classifications = JSON.parse(jsonMatch[0]);
      
      for (const cls of classifications) {
        const idx = cls.index - 1;
        if (idx >= 0 && idx < unknownPhones.length && cls.type) {
          unknownPhones[idx].inferred_type = cls.type;
        }
      }
    }
  } catch (error) {
    console.error('DeepSeek classification error:', error);
  }
  
  return phones;
}

async function scrapeOneUrl(
  url: string,
  firecrawlKey: string,
  deepseekKey: string,
  followContact: boolean,
  maxPages: number
): Promise<ScrapeResult> {
  const allPhones: FoundPhone[] = [];
  
  // Scrape main page
  const mainResult = await scrapeWithFirecrawl(url, firecrawlKey);
  if (!mainResult) {
    return { url, phones: [], error: 'Failed to scrape main page' };
  }
  
  // Extract phones from main page
  const mainPhones = extractPhonesFromText(url, url, mainResult.markdown, mainResult.html);
  allPhones.push(...mainPhones);
  
  // Follow contact pages if enabled
  if (followContact && maxPages > 1) {
    const contactLinks = getContactLinks(url, mainResult.links, maxPages - 1);
    
    for (const contactUrl of contactLinks) {
      const contactResult = await scrapeWithFirecrawl(contactUrl, firecrawlKey);
      if (contactResult) {
        const contactPhones = extractPhonesFromText(
          url, 
          contactUrl, 
          contactResult.markdown, 
          contactResult.html
        );
        allPhones.push(...contactPhones);
      }
    }
  }
  
  // Dedupe by normalized phone
  const deduped = new Map<string, FoundPhone>();
  for (const phone of allPhones) {
    const key = `${phone.normalized}-${phone.page_url}`;
    if (!deduped.has(key)) {
      deduped.set(key, phone);
    }
  }
  
  // Classify unknown phones with DeepSeek
  let phones = Array.from(deduped.values());
  phones = await classifyPhonesWithDeepSeek(phones, deepseekKey);
  
  return { url, phones };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { urls, follow_contact = true, max_pages = 2, concurrency = 5 } = await req.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'urls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!deepseekKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'DEEPSEEK_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing ${urls.length} URLs with concurrency ${concurrency}`);
    
    const results: ScrapeResult[] = [];
    const errors: { url: string; error: string }[] = [];
    
    // Process URLs in batches for concurrency control
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchPromises = batch.map(async (url: string) => {
        try {
          // Normalize URL
          let normalizedUrl = url.trim();
          if (!normalizedUrl.match(/^https?:\/\//i)) {
            normalizedUrl = 'https://' + normalizedUrl;
          }
          
          return await scrapeOneUrl(
            normalizedUrl,
            firecrawlKey,
            deepseekKey,
            follow_contact,
            max_pages
          );
        } catch (error) {
          console.error(`Error processing ${url}:`, error);
          return { url, phones: [], error: error instanceof Error ? error.message : String(error) } as ScrapeResult;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.error) {
          errors.push({ url: result.url, error: result.error });
        }
        results.push(result);
      }
      
      console.log(`Processed batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(urls.length / concurrency)}`);
    }
    
    // Flatten all phones
    const allPhones = results.flatMap(r => r.phones);
    
    console.log(`Done. URLs: ${urls.length}, Phones found: ${allPhones.length}, Errors: ${errors.length}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          urls_processed: urls.length,
          phones_found: allPhones.length,
          errors_count: errors.length,
        },
        phones: allPhones,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Phone scraper error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
