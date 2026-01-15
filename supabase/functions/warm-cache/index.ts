import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");

const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'robert@top10lists.us';
const URL_TIMEOUT_MS = 15000; // 15 seconds per URL
const SEQUENTIAL_DELAY_MS = 7000; // 7 seconds between each URL to avoid Cloudflare rate limits
const HEARTBEAT_INTERVAL_MS = 60000; // Update progress every 60 seconds
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Track job progress in cron_state table
async function updateJobProgress(status: string, message: string, processed: number, total: number, errors: number): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('cron_state')
      .upsert({
        job_name: 'warm-cache',
        is_running: status === 'running',
        status,
        message,
        total_processed: processed,
        total_found: total,
        total_errors: errors,
        updated_at: new Date().toISOString(),
        last_run_at: status === 'running' ? undefined : new Date().toISOString(),
        completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
      }, { onConflict: 'job_name' });
    
    if (error) {
      console.error('Failed to update job progress:', error);
    }
  } catch (err) {
    console.error('Error updating job progress:', err);
  }
}

// Send email when job stops prematurely
async function sendPrematureStopEmail(processed: number, total: number, lastUrl: string, errorMessage?: string): Promise<void> {
  if (!SMTP_USERNAME || !SMTP_PASSWORD || !SMTP_FROM_EMAIL) {
    console.error('SMTP credentials not configured, cannot send premature stop email');
    return;
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USERNAME,
          password: SMTP_PASSWORD,
        },
      },
    });

    const timestamp = new Date().toISOString();
    const baseUrl = SUPABASE_URL;
    
    await client.send({
      from: SMTP_FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `⚠️ Cache Warming Stopped Prematurely - ${processed}/${total} completed`,
      html: `
        <h1>⚠️ Cache Warming Stopped Early</h1>
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>Progress:</strong> ${processed} of ${total} URLs processed (${Math.round(processed/total*100)}%)</p>
        <p><strong>Last URL processed:</strong> ${lastUrl}</p>
        ${errorMessage ? `<p><strong>Error:</strong> ${errorMessage}</p>` : '<p><strong>Reason:</strong> Edge function likely timed out or crashed</p>'}
        <hr />
        <h2>🔧 Quick Actions</h2>
        <p>Click to resume or restart:</p>
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 8px;">
              <a href="${baseUrl}/functions/v1/warm-cache" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">🔄 Restart Warm Cache</a>
            </td>
            <td style="padding: 8px;">
              <a href="${baseUrl}/functions/v1/check-cache-health" style="display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">🏥 Run Health Check</a>
            </td>
          </tr>
        </table>
        <hr />
        <p style="color: #666; font-size: 12px;">Check edge function logs for more details.</p>
      `,
    });
    
    await client.close();
    console.log('📧 Premature stop notification email sent to', ADMIN_EMAIL);
  } catch (emailError) {
    console.error('Failed to send premature stop email:', emailError);
  }
}

// Send failure notification email via SMTP
async function sendFailureEmail(result: WarmResult, errorMessage?: string): Promise<void> {
  if (!SMTP_USERNAME || !SMTP_PASSWORD || !SMTP_FROM_EMAIL) {
    console.error('SMTP credentials not configured, cannot send failure email');
    return;
  }

  try {
    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USERNAME,
          password: SMTP_PASSWORD,
        },
      },
    });

    const timestamp = new Date().toISOString();
    
    const baseUrl = SUPABASE_URL;
    
    await client.send({
      from: SMTP_FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `🚨 IMMEDIATE: Cache Warming Failed - ${result.failed} URLs failed`,
      html: `
        <h1>🚨 Cache Warming Failure Alert</h1>
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>Summary:</strong></p>
        <ul>
          <li>Total URLs: ${result.total}</li>
          <li>Successfully warmed: ${result.warmed}</li>
          <li>Failed: ${result.failed}</li>
        </ul>
        ${errorMessage ? `<p><strong>Error:</strong> ${errorMessage}</p>` : ''}
        ${result.errors.length > 0 ? `
          <p><strong>Failed URLs:</strong></p>
          <ul>
            ${result.errors.slice(0, 20).map(e => `<li>${e}</li>`).join('')}
            ${result.errors.length > 20 ? `<li>... and ${result.errors.length - 20} more</li>` : ''}
          </ul>
        ` : ''}
        <hr />
        <h2>🔧 Quick Actions</h2>
        <p>Click a button to trigger the action directly:</p>
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding: 8px;">
              <a href="${baseUrl}/functions/v1/warm-cache" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">🔄 Re-run Warm Cache</a>
            </td>
            <td style="padding: 8px;">
              <a href="${baseUrl}/functions/v1/check-cache-health" style="display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">🏥 Run Health Check</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px;">
              <a href="${baseUrl}/functions/v1/cache-admin-action?action=start-cron" style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">▶️ Start Cron</a>
            </td>
            <td style="padding: 8px;">
              <a href="${baseUrl}/functions/v1/cache-admin-action?action=stop-cron" style="display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">⏹️ Stop Cron</a>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="padding: 8px;">
              <a href="${baseUrl}/functions/v1/cache-admin-action?action=check-cron" style="display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">📊 Check Cron Status</a>
            </td>
          </tr>
        </table>
        <hr />
        <p style="color: #666; font-size: 12px;">Check edge function logs for more details.</p>
      `,
    });
    
    await client.close();
    console.log('📧 Failure notification email sent to', ADMIN_EMAIL);
  } catch (emailError) {
    console.error('Failed to send failure notification email:', emailError);
  }
}

interface WarmRequest {
  urls?: string[];
  region?: string;
  limit?: number;
  offset?: number;
}

interface WarmResult {
  success: boolean;
  total: number;
  warmed: number;
  failed: number;
  errors: string[];
  hasMore: boolean;
  nextOffset: number;
}

// Generate a cache key from URL
function urlToCacheKey(url: string): string {
  // Remove protocol and create a clean key
  return url.replace('https://', '').replace('http://', '').replace(/[^a-zA-Z0-9]/g, '_');
}

// Delete from Cloudflare KV
async function deleteFromKV(key: string): Promise<boolean> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
    console.error('Cloudflare KV credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    // 404 is okay - key didn't exist
    if (response.ok || response.status === 404) {
      return true;
    }

    const errorText = await response.text();
    console.error(`KV delete failed for ${key}: ${response.status} - ${errorText}`);
    return false;
  } catch (error) {
    console.error(`KV delete error for ${key}:`, error);
    return false;
  }
}

// Write to Cloudflare KV
async function writeToKV(key: string, value: string): Promise<boolean> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
    console.error('Cloudflare KV credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'text/html',
        },
        body: value,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`KV write failed for ${key}: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`KV write error for ${key}:`, error);
    return false;
  }
}

// Check if URL is a non-HTML static file
function isStaticFile(url: string): boolean {
  return url.endsWith('.txt') || url.endsWith('.xml') || url.endsWith('.json');
}

// Check if URL is a city/category page that needs agent stripping
function isCityPage(url: string): boolean {
  // City pages match pattern: /arizona/city-name/category-slug
  const cityPagePattern = /\/[a-z-]+\/[a-z-]+\/[a-z0-9-]+$/i;
  return cityPagePattern.test(new URL(url).pathname);
}

// Strip agent-identifying content from HTML while preserving page structure
// Keeps: headers, methodology content, FAQ, schema markup, meta tags
// Removes: agent names, photos, stats, bios, contact info
function stripAgentContent(html: string): string {
  let sanitized = html;
  
  // Remove Person schema (contains agent names/details)
  sanitized = sanitized.replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?"@type"\s*:\s*"Person"[\s\S]*?<\/script>/gi, '');
  
  // Remove agent card containers (common patterns)
  // Pattern 1: data-agent-card or similar attributes
  sanitized = sanitized.replace(/<[^>]+data-agent[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
  
  // Pattern 2: Agent card divs with itemtype Person
  sanitized = sanitized.replace(/<[^>]+itemtype="https?:\/\/schema\.org\/Person"[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
  
  // Pattern 3: Elements with agent-specific classes (professional-card, agent-card)
  sanitized = sanitized.replace(/<div[^>]*class="[^"]*(?:professional-card|agent-card|agent-list)[^"]*"[^>]*>[\s\S]*?(?:<\/div>\s*){1,10}/gi, '');
  
  // Remove img tags with agent photos (typically zillow/realtor URLs or profile images)
  sanitized = sanitized.replace(/<img[^>]*(?:zillow|realtor|profile|agent)[^>]*>/gi, '');
  
  // Remove tel: and mailto: links (agent contact info)
  sanitized = sanitized.replace(/<a[^>]*href="(?:tel:|mailto:)[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
  
  // Add a notice that agent details are available on site
  const noticeHtml = `
    <div style="padding:20px;background:#f5f5f5;border-radius:8px;margin:20px 0;text-align:center;">
      <p style="margin:0;font-size:16px;">
        <strong>View the complete Top 10 agent rankings at Top10Lists.us</strong><br>
        Our curated list includes verified reviews, credentials, and community involvement data.
      </p>
    </div>
  `;
  
  // Insert notice before closing body tag
  sanitized = sanitized.replace('</body>', `${noticeHtml}</body>`);
  
  return sanitized;
}

// Validate that page content matches expected content (not just homepage defaults)
function validatePageContent(url: string, html: string): { success: boolean; reason?: string } {
  const urlPath = new URL(url).pathname;
  
  // Check for presence of H1 tag
  if (!html.includes('<h1')) {
    return { success: false, reason: 'No <h1> tag found' };
  }

  // Homepage is always valid if it has content
  if (urlPath === '/' || urlPath === '') {
    return { success: true };
  }

  // Extract and log title/H1 for debugging
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const pageTitle = titleMatch ? titleMatch[1] : 'NO TITLE';
  const pageH1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '') : 'NO H1';
  
  console.log(`    Page: ${urlPath} | Title: ${pageTitle} | H1: ${pageH1}`);

  // Reject non-homepage pages showing homepage default content
  const hasDefaultTitle = html.includes('Top 10 Real Estate Agents | Top10Lists.us');
  const hasDefaultH1 = html.includes('Find the Top 10 Real Estate Agents in Your City');
  
  if (urlPath !== '/' && hasDefaultTitle && hasDefaultH1) {
    return { 
      success: false, 
      reason: `Page showing default homepage content instead of page-specific content` 
    };
  }

  // Page-specific validations
  const validations: Record<string, () => boolean> = {
    '/faq': () => html.toLowerCase().includes('faq') || html.toLowerCase().includes('frequently asked'),
    '/about': () => html.toLowerCase().includes('about'),
    '/about/ranking-methodology': () => html.toLowerCase().includes('methodology'),
    '/compare': () => html.toLowerCase().includes('zillow') || html.toLowerCase().includes('comparison'),
    '/for-ai': () => html.toLowerCase().includes('ai systems'),
    '/ai-liability': () => html.toLowerCase().includes('liability'),
  };

  for (const [path, validator] of Object.entries(validations)) {
    if (urlPath.includes(path) && !validator()) {
      return { success: false, reason: `Path ${path} missing expected content` };
    }
  }

  return { success: true };
}

// Fetch rendered page from Cloudflare Worker using X-Cache-Warming header
// This triggers browser rendering for proper JS execution and correct meta tags
async function fetchRenderedPage(url: string): Promise<{ success: boolean; html?: string; error?: string }> {
  try {
    console.log(`    Requesting browser-rendered HTML for: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), URL_TIMEOUT_MS);

    // Request from www.top10lists.us with X-Cache-Warming header
    // This tells Cloudflare Worker to force fresh browser render
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'X-Cache-Warming': 'true', // Triggers fresh browser render in Cloudflare Worker
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    // Check if response came from Cloudflare Worker browser rendering
    const renderedBy = response.headers.get('X-Rendered-By');
    if (renderedBy) {
      console.log(`    Rendered by: ${renderedBy}`);
    }

    const html = await response.text();
    
    // Static files don't need content validation
    if (isStaticFile(url)) {
      return html.length > 100 
        ? { success: true, html } 
        : { success: false, error: 'Static file appears empty' };
    }

    // Validate that page content matches expected content
    const validation = validatePageContent(url, html);
    if (!validation.success) {
      console.warn(`    Validation failed: ${validation.reason}`);
      return { success: false, error: validation.reason || 'Content validation failed' };
    }

    console.log(`    Successfully fetched and validated: ${url}`);
    return { success: true, html };
      
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// Warm a single URL: fetch rendered HTML and store in KV
async function warmUrl(url: string, canonicalUrl: string): Promise<{ success: boolean; error?: string }> {
  // Fetch from origin (lovable.app)
  const fetchResult = await fetchRenderedPage(url);
  
  if (!fetchResult.success || !fetchResult.html) {
    return { success: false, error: fetchResult.error || 'No HTML returned' };
  }

  // Store in Cloudflare KV using the CANONICAL URL (www.top10lists.us) for the key
  const cacheKey = urlToCacheKey(canonicalUrl);
  const kvSuccess = await writeToKV(cacheKey, fetchResult.html);
  
  if (!kvSuccess) {
    return { success: false, error: 'Failed to write to KV' };
  }

  console.log(`  ✓ Cached ${canonicalUrl} (${fetchResult.html.length} bytes)`);
  return { success: true };
}

// Get URLs to warm - static pages + cities + neighborhoods
async function getUrlsToWarm(region?: string, limit?: number, offset?: number): Promise<{ urls: { fetchUrl: string; canonicalUrl: string }[]; totalCount: number }> {
  const fetchBaseUrl = 'https://www.top10lists.us';
  const canonicalBaseUrl = 'https://www.top10lists.us';

  // Static crawlable pages (React pages only - Worker skips .txt, .json, .xml files)
  const staticPages = [
    '', // homepage
    '/about',
    '/about/ranking-methodology',
    '/faq',
    '/transparency', // GEO Schema - methodology and data sources
    '/for-agents',
    '/compare',
    '/press',
    '/for-ai',
    '/ai-liability',
    '/protocol-adopters',
    '/protocol-services',
    '/test',
    '/ai-compare',
    '/arizona', // state landing page
    '/are-you-an-agent',
    '/agent-onboarding',
    '/privacy',
    '/terms',
    // Question pages for GEO optimization
    '/q/how-does-top10lists-rank-real-estate-agents',
    '/q/can-agents-pay-to-be-listed-on-top10lists',
    '/q/how-is-top10lists-different-from-zillow',
    '/q/what-are-minimum-requirements-to-be-ranked',
    '/q/where-does-top10lists-get-its-data',
    '/q/do-real-estate-referral-sites-charge-fees',
    '/q/why-dont-agents-apply-to-top10lists',
    '/q/is-realtrends-a-reliable-ranking',
    '/q/how-often-are-rankings-updated',
    '/q/what-cities-does-top10lists-cover',
  ];

  const staticUrls = staticPages.map((path) => ({
    fetchUrl: `${fetchBaseUrl}${path}`,
    canonicalUrl: `${canonicalBaseUrl}${path}`,
  }));

  // Query active Arizona cities from database (only Arizona for now)
  const { data: cities, error: citiesError } = await supabaseAdmin
    .from('cities')
    .select('slug, state_slug')
    .eq('active', true)
    .eq('state_slug', 'arizona');

  if (citiesError) {
    console.error('Error fetching cities:', citiesError);
  }

  const cityUrls = (cities || []).map((c) => {
    const path = `/${c.state_slug}/${c.slug}/top10realestateagents`;
    return { fetchUrl: `${fetchBaseUrl}${path}`, canonicalUrl: `${canonicalBaseUrl}${path}` };
  });

  // Query active Arizona neighborhoods with primary_zip
  // Split into two queries - AZ has 1054 entries, so need explicit limit
  const { data: neighborhoodsAZ, error: neighborhoodsAZError } = await supabaseAdmin
    .from('neighborhood_catalog')
    .select('state, city_area_slug, primary_zip, neighborhood_slug')
    .eq('is_active', true)
    .eq('state', 'AZ')
    .not('primary_zip', 'is', null)
    .limit(2000);

  const { data: neighborhoodsArizona, error: neighborhoodsArizonaError } = await supabaseAdmin
    .from('neighborhood_catalog')
    .select('state, city_area_slug, primary_zip, neighborhood_slug')
    .eq('is_active', true)
    .eq('state', 'Arizona')
    .not('primary_zip', 'is', null);

  if (neighborhoodsAZError) {
    console.error('Error fetching AZ neighborhoods:', neighborhoodsAZError);
  }
  if (neighborhoodsArizonaError) {
    console.error('Error fetching Arizona neighborhoods:', neighborhoodsArizonaError);
  }

  // Combine both results
  const neighborhoods = [...(neighborhoodsAZ || []), ...(neighborhoodsArizona || [])];

  const neighborhoodUrls = (neighborhoods || []).map((n) => {
    const stateLower = n.state.toLowerCase();
    const path = `/${stateLower}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`;
    return { fetchUrl: `${fetchBaseUrl}${path}`, canonicalUrl: `${canonicalBaseUrl}${path}` };
  });

  // Combine all URLs: static + cities + neighborhoods
  const allUrls = [...staticUrls, ...cityUrls, ...neighborhoodUrls];

  console.log(
    `Generated ${allUrls.length} URLs to warm (${staticUrls.length} static + ${cityUrls.length} cities + ${neighborhoodUrls.length} neighborhoods)`
  );

  const totalCount = allUrls.length;
  const startIndex = offset || 0;
  const endIndex = limit ? startIndex + limit : allUrls.length;
  const urls = allUrls.slice(startIndex, endIndex);

  console.log(`Returning ${urls.length} URLs (offset: ${startIndex}, limit: ${limit || 'none'}, total: ${totalCount})`);
  return { urls, totalCount };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({})) as WarmRequest;
    // No default limit - warm all URLs in one run
    const { urls: providedUrls, region, limit, offset = 0 } = body;

    // Validate Cloudflare credentials
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudflare KV credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get URLs to warm
    let urls: { fetchUrl: string; canonicalUrl: string }[];
    let totalCount: number;
    
    if (providedUrls && providedUrls.length > 0) {
      // If URLs are provided directly, assume they're canonical URLs and use them for both
      urls = providedUrls.map(u => ({ fetchUrl: u, canonicalUrl: u }));
      totalCount = providedUrls.length;
    } else {
      const result = await getUrlsToWarm(region, limit, offset);
      urls = result.urls;
      totalCount = result.totalCount;
    }

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total: 0, warmed: 0, failed: 0, errors: [], hasMore: false, nextOffset: offset }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nextOffset = offset + urls.length;
    const hasMore = nextOffset < totalCount;
    
    console.log(`🔥 Starting cache warming for ${urls.length} URLs (batch ${offset}-${nextOffset} of ${totalCount})...`);

    // Track progress for premature stop detection
    let lastProcessedUrl = '';
    let lastHeartbeat = Date.now();
    
    // Register shutdown handler to email if stopped prematurely
    const shutdownHandler = async () => {
      console.log('⚠️ Function shutting down, checking if job completed...');
      // Only send email if we didn't finish
      if (result.warmed + result.failed < urls.length) {
        await sendPrematureStopEmail(result.warmed + result.failed, totalCount, lastProcessedUrl, 'Edge function shutdown');
        await updateJobProgress('stopped', `Stopped at ${result.warmed + result.failed}/${totalCount}`, result.warmed + result.failed, totalCount, result.failed);
      }
    };
    addEventListener('beforeunload', shutdownHandler);
    
    // Update initial job status
    await updateJobProgress('running', `Starting: 0/${totalCount}`, 0, totalCount, 0);

    const result: WarmResult = {
      success: true,
      total: totalCount,
      warmed: 0,
      failed: 0,
      errors: [],
      hasMore,
      nextOffset,
    };

    // Step 1: Purge all URLs from KV before warming (only on first batch)
    if (offset === 0) {
      console.log(`🗑️ Purging ${urls.length} URLs from KV before warming...`);
      await updateJobProgress('running', `Purging KV cache...`, 0, totalCount, 0);
      let purged = 0;
      for (const { canonicalUrl } of urls) {
        const cacheKey = urlToCacheKey(canonicalUrl);
        const deleted = await deleteFromKV(cacheKey);
        if (deleted) purged++;
      }
      console.log(`✓ Purged ${purged}/${urls.length} KV entries`);
    }

    // Step 2: Process URLs sequentially with delays
    for (let i = 0; i < urls.length; i++) {
      const { fetchUrl, canonicalUrl } = urls[i];
      lastProcessedUrl = canonicalUrl;
      console.log(`[${i + 1}/${urls.length}] Warming: ${canonicalUrl} (from ${fetchUrl})`);
      
      const warmResult = await warmUrl(fetchUrl, canonicalUrl);
      
      if (warmResult.success) {
        result.warmed++;
      } else {
        result.failed++;
        result.errors.push(`${canonicalUrl}: ${warmResult.error}`);
        console.error(`  ✗ Failed: ${warmResult.error}`);
      }
      
      // Update progress periodically (every 60 seconds)
      if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
        const processed = result.warmed + result.failed;
        await updateJobProgress('running', `Processing: ${processed}/${totalCount} (${result.failed} errors)`, processed, totalCount, result.failed);
        lastHeartbeat = Date.now();
        console.log(`📊 Progress update: ${processed}/${totalCount}`);
      }
      
      // Delay between URLs (except after the last one)
      if (i < urls.length - 1) {
        console.log(`  ⏱️ Waiting ${SEQUENTIAL_DELAY_MS / 1000}s before next URL...`);
        await new Promise(resolve => setTimeout(resolve, SEQUENTIAL_DELAY_MS));
      }
    }

    console.log(`✅ Cache warming complete: ${result.warmed}/${result.total} successful, ${result.failed} failed`);
    
    // Job completed successfully - update status
    const finalStatus = result.failed > 0 ? 'completed_with_errors' : 'completed';
    await updateJobProgress(finalStatus, `Done: ${result.warmed}/${result.total} warmed, ${result.failed} failed`, result.warmed, result.total, result.failed);

    // Send failure email if any URLs failed
    if (result.failed > 0) {
      result.success = false;
      await sendFailureEmail(result);
    }

    // Trigger IndexNow after cache warming completes (only on final batch or single batch)
    if (!hasMore && result.warmed > 0) {
      console.log('🔔 Triggering IndexNow to notify search engines...');
      try {
        const { data: indexNowResult, error: indexNowError } = await supabaseAdmin.functions.invoke('push-indexnow', {
          body: {},
        });

        if (indexNowError) {
          console.error('⚠️ IndexNow failed:', indexNowError);
          (result as any).indexNowTriggered = false;
          (result as any).indexNowError = indexNowError.message;
        } else {
          const urlsSubmitted = (indexNowResult as any)?.urlsSubmitted || 0;
          console.log(`✅ IndexNow triggered successfully: ${urlsSubmitted} URLs pushed`);
          (result as any).indexNowTriggered = true;
          (result as any).indexNowUrls = urlsSubmitted;
        }
      } catch (indexNowError) {
        console.error('⚠️ IndexNow error:', indexNowError);
        (result as any).indexNowTriggered = false;
        (result as any).indexNowError = indexNowError instanceof Error ? indexNowError.message : 'Unknown error';
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cache warming error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update job status as failed
    await updateJobProgress('failed', errorMessage, 0, 0, 1);
    
    // Send failure email for catastrophic errors
    await sendFailureEmail(
      { success: false, total: 0, warmed: 0, failed: 1, errors: [errorMessage], hasMore: false, nextOffset: 0 },
      errorMessage
    );
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
