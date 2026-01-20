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
const CLOUDFLARE_API_EMAIL = Deno.env.get('CLOUDFLARE_API_EMAIL');
const CLOUDFLARE_API_KEY = Deno.env.get('CLOUDFLARE_GLOBAL_API_KEY'); // Note: matches your secret name

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') || 'robert@top10lists.us';

const RENDER_TIMEOUT_MS = 60000; // 60 seconds for browser rendering
const SEQUENTIAL_DELAY_MS = 7000; // 7 seconds between each URL to avoid rate limits
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
      subject: `Cache Warming Stopped Prematurely - ${processed}/${total} completed`,
      html: `
        <h2>Cache Warming Stopped Early</h2>
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>Progress:</strong> ${processed} of ${total} URLs processed (${Math.round(processed/total*100)}%)</p>
        <p><strong>Last URL processed:</strong> ${lastUrl}</p>
        ${errorMessage ? `<p style="color: red;"><strong>Error:</strong> ${errorMessage}</p>` : '<p>Reason: Edge function likely timed out or crashed</p>'}
        
        <h3>Quick Actions</h3>
        <p>Click to resume or restart:</p>
        <div style="margin: 20px 0;">
          <table cellspacing="10">
            <tr>
              <td>
                <a href="${baseUrl}/functions/v1/warm-cache" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Restart Warm Cache</a>
              </td>
              <td>
                <a href="${baseUrl}/functions/v1/warm-cache-health" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Run Health Check</a>
              </td>
            </tr>
          </table>
        </div>
        
        <p style="color: #666; font-size: 12px;">Check edge function logs for more details.</p>
      `,
    });
    
    await client.close();
    console.log('Premature stop notification email sent to', ADMIN_EMAIL);
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
      subject: `IMMEDIATE: Cache Warming Failed - ${result.failed} URLs failed`,
      html: `
        <h2>Cache Warming Failure Alert</h2>
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>Summary:</strong></p>
        <ul>
          <li><strong>Total URLs:</strong> ${result.total}</li>
          <li><strong>Successfully warmed:</strong> ${result.warmed}</li>
          <li style="color: red;"><strong>Failed:</strong> ${result.failed}</li>
        </ul>
        ${errorMessage ? `<p style="color: red;"><strong>Error:</strong> ${errorMessage}</p>` : ''}
        ${result.errors.length > 0 ? `
          <h3>Failed URLs:</h3>
          <ul style="font-family: monospace; font-size: 12px;">
            ${result.errors.slice(0, 20).map(e => `<li>${e}</li>`).join('')}
            ${result.errors.length > 20 ? `<li>... and ${result.errors.length - 20} more</li>` : ''}
          </ul>
        ` : ''}
        
        <h3>Quick Actions</h3>
        <p>Click a button to trigger the action directly:</p>
        <div style="margin: 20px 0;">
          <table cellspacing="10">
            <tr>
              <td>
                <a href="${baseUrl}/functions/v1/warm-cache" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Re-run Warm Cache</a>
              </td>
              <td>
                <a href="${baseUrl}/functions/v1/warm-cache-health" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Run Health Check</a>
              </td>
            </tr>
          </table>
        </div>
        
        <p style="color: #666; font-size: 12px;">Check edge function logs for more details.</p>
      `,
    });
    
    await client.close();
    console.log('Failure notification email sent to', ADMIN_EMAIL);
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

// Generate a cache key from URL - matches Cloudflare Worker format
function urlToCacheKey(url: string): string {
  const urlObj = new URL(url);
  let pathname = urlObj.pathname;
  if (pathname !== '/' && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  return `html:${pathname}`;
}

// Delete from Cloudflare KV
async function deleteFromKV(key: string): Promise<boolean> {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
    console.error('Cloudflare KV credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

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
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`,
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

// Validate that rendered HTML contains expected content
function isValidContent(html: string, url: string): { valid: boolean; reason?: string } {
  if (!html || html.length < 2000) {
    return { valid: false, reason: 'HTML too short' };
  }
  
  if (html.includes('429') && html.includes('Too Many Requests')) {
    return { valid: false, reason: 'Rate limited' };
  }
  
  if (html.includes('500') && html.includes('Internal Server Error')) {
    return { valid: false, reason: 'Server error page' };
  }
  
  const hasDoctype = html.includes('<!DOCTYPE') || html.includes('<!doctype');
  if (!hasDoctype) {
    return { valid: false, reason: 'No doctype' };
  }
  
  const hasContent = html.includes('Top10Lists') || html.includes('top10lists');
  if (!hasContent) {
    return { valid: false, reason: 'No Top10Lists content' };
  }
  
  if (html.includes('Authenticating') && html.includes('lovable')) {
    return { valid: false, reason: 'Lovable auth page' };
  }
  
  const hasSpinner = html.includes('animate-spin');
  const hasRealContent = html.includes('Neighborhood Expert') || 
                         html.includes('Verified') ||
                         html.includes('Merit-Based') ||
                         html.includes('FAQ') ||
                         html.includes('methodology') ||
                         html.includes('About Top10Lists');
  
  if (hasSpinner && !hasRealContent) {
    return { valid: false, reason: 'Page still showing spinner' };
  }

  const urlPath = new URL(url).pathname;
  
  if (urlPath !== '/' && urlPath !== '') {
    const hasDefaultTitle = html.includes('>Top 10 Real Estate Agents | Top10Lists.us<');
    const hasDefaultH1 = html.includes('Find the Top 10 Real Estate Agents in Your City');
    if (hasDefaultTitle && hasDefaultH1) {
      return { valid: false, reason: 'Page showing homepage default content' };
    }
  }

  return { valid: true };
}

// Render a page using Cloudflare Browser Rendering API
async function renderPageWithBrowser(url: string): Promise<{ success: boolean; html?: string; error?: string }> {
  if (!CLOUDFLARE_ACCOUNT_ID) {
    return { success: false, error: 'CLOUDFLARE_ACCOUNT_ID not configured' };
  }
  
  const hasApiToken = !!CLOUDFLARE_API_TOKEN;
  const hasEmailKey = !!(CLOUDFLARE_API_EMAIL && CLOUDFLARE_API_KEY);
  
  if (!hasApiToken && !hasEmailKey) {
    return { success: false, error: 'Cloudflare API credentials not configured' };
  }

  try {
    console.log(`    Browser rendering: ${url}`);
    
    const urlPath = new URL(url).pathname;
    const isListingPage = urlPath.includes('top10realestateagents') || 
                          urlPath.includes('best-real-estate-agents');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Prefer Email+Key for Browser Rendering API
    if (hasEmailKey) {
      headers['X-Auth-Email'] = CLOUDFLARE_API_EMAIL!;
      headers['X-Auth-Key'] = CLOUDFLARE_API_KEY!;
    } else {
      headers['Authorization'] = `Bearer ${CLOUDFLARE_API_TOKEN}`;
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/content`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url,
          gotoOptions: {
            waitUntil: 'networkidle0',
            timeout: RENDER_TIMEOUT_MS,
          },
          waitForTimeout: isListingPage ? 8000 : 3000,
          viewport: {
            width: 1280,
            height: 800,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`    Browser Rendering API error: ${response.status} - ${errorText}`);
      return { success: false, error: `API error ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json();
    const html = data.result || '';
    
    if (!html) {
      return { success: false, error: 'No HTML returned from Browser Rendering API' };
    }

    const validation = isValidContent(html, url);
    if (!validation.valid) {
      console.warn(`    Validation failed: ${validation.reason}`);
      return { success: false, error: validation.reason };
    }

    console.log(`    Rendered successfully: ${html.length} bytes`);
    return { success: true, html };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`    Render error: ${message}`);
    return { success: false, error: message };
  }
}

// Warm a single URL: render with Browser API and store in KV
async function warmUrl(url: string): Promise<{ success: boolean; error?: string }> {
  const cacheKey = urlToCacheKey(url);
  
  if (isStaticFile(url)) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      const content = await response.text();
      if (content.length < 100) {
        return { success: false, error: 'Static file appears empty' };
      }
      const kvSuccess = await writeToKV(cacheKey, content);
      if (!kvSuccess) {
        return { success: false, error: 'Failed to write to KV' };
      }
      console.log(`  Cached static file ${url} (${content.length} bytes)`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  const renderResult = await renderPageWithBrowser(url);
  
  if (!renderResult.success || !renderResult.html) {
    return { success: false, error: renderResult.error || 'No HTML returned' };
  }

  const kvSuccess = await writeToKV(cacheKey, renderResult.html);
  
  if (!kvSuccess) {
    return { success: false, error: 'Failed to write to KV' };
  }

  console.log(`  Cached ${url} (${renderResult.html.length} bytes) -> ${cacheKey}`);
  return { success: true };
}

// Get URLs to warm - static pages + cities + neighborhoods
async function getUrlsToWarm(region?: string, limit?: number, offset?: number): Promise<{ urls: string[]; totalCount: number }> {
  const baseUrl = 'https://www.top10lists.us';

  const staticPages = [
    '',
    '/about',
    '/about/ranking-methodology',
    '/faq',
    '/transparency',
    '/for-agents',
    '/compare',
    '/press',
    '/for-ai',
    '/ai-liability',
    '/protocol-adopters',
    '/protocol-services',
    '/test',
    '/ai-compare',
    '/arizona',
    '/are-you-an-agent',
    '/agent-onboarding',
    '/privacy',
    '/terms',
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

  const staticUrls = staticPages.map((path) => `${baseUrl}${path}`);

  const { data: cities, error: citiesError } = await supabaseAdmin
    .from('cities')
    .select('slug, state_slug')
    .eq('active', true)
    .eq('state_slug', 'arizona');

  if (citiesError) {
    console.error('Error fetching cities:', citiesError);
  }

  const cityUrls = (cities || []).map((c) => `${baseUrl}/${c.state_slug}/${c.slug}/top10realestateagents`);

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

  const neighborhoods = [...(neighborhoodsAZ || []), ...(neighborhoodsArizona || [])];

  const neighborhoodUrls = (neighborhoods || []).map((n) => {
    const stateLower = n.state.toLowerCase() === 'az' ? 'arizona' : n.state.toLowerCase();
    return `${baseUrl}/${stateLower}/${n.city_area_slug}/${n.primary_zip}/${n.neighborhood_slug}/top10realestateagents`;
  });

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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({})) as WarmRequest;
    const { urls: providedUrls, region, limit, offset = 0 } = body;

    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudflare KV credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let urls: string[];
    let totalCount: number;
    
    if (providedUrls && providedUrls.length > 0) {
      urls = providedUrls;
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
    
    console.log(`Starting cache warming for ${urls.length} URLs (batch ${offset}-${nextOffset} of ${totalCount})...`);

    let lastProcessedUrl = '';
    let lastHeartbeat = Date.now();
    
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

    if (offset === 0) {
      console.log(`Purging ${urls.length} URLs from KV before warming...`);
      await updateJobProgress('running', `Purging KV cache...`, 0, totalCount, 0);
      let purged = 0;
      for (const url of urls) {
        const cacheKey = urlToCacheKey(url);
        const deleted = await deleteFromKV(cacheKey);
        if (deleted) purged++;
      }
      console.log(`Purged ${purged}/${urls.length} KV entries`);
    }

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      lastProcessedUrl = url;
      console.log(`[${i + 1}/${urls.length}] Warming: ${url}`);
      
      const warmResult = await warmUrl(url);
      
      if (warmResult.success) {
        result.warmed++;
      } else {
        result.failed++;
        result.errors.push(`${url}: ${warmResult.error}`);
        console.error(`  Failed: ${warmResult.error}`);
      }
      
      if (Date.now() - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
        const processed = result.warmed + result.failed;
        await updateJobProgress('running', `Processing: ${processed}/${totalCount} (${result.failed} errors)`, processed, totalCount, result.failed);
        lastHeartbeat = Date.now();
        console.log(`Progress update: ${processed}/${totalCount}`);
      }
      
      if (i < urls.length - 1) {
        console.log(`  Waiting ${SEQUENTIAL_DELAY_MS / 1000}s before next URL...`);
        await new Promise(resolve => setTimeout(resolve, SEQUENTIAL_DELAY_MS));
      }
    }

    console.log(`Cache warming complete: ${result.warmed}/${result.total} successful, ${result.failed} failed`);
    
    const finalStatus = result.failed > 0 ? 'completed_with_errors' : 'completed';
    await updateJobProgress(finalStatus, `Done: ${result.warmed}/${result.total} warmed, ${result.failed} failed`, result.warmed, result.total, result.failed);

    if (result.failed > 0) {
      result.success = false;
      await sendFailureEmail(result);
    }

    if (!hasMore && result.warmed > 0) {
      console.log('Triggering IndexNow to notify search engines...');
      try {
        const { data: indexNowResult, error: indexNowError } = await supabaseAdmin.functions.invoke('push-indexnow', {
          body: {},
        });

        if (indexNowError) {
          console.error('IndexNow failed:', indexNowError);
          (result as any).indexNowTriggered = false;
          (result as any).indexNowError = indexNowError.message;
        } else {
          const urlsSubmitted = (indexNowResult as any)?.urlsSubmitted || 0;
          console.log(`IndexNow triggered successfully: ${urlsSubmitted} URLs pushed`);
          (result as any).indexNowTriggered = true;
          (result as any).indexNowUrls = urlsSubmitted;
        }
      } catch (indexNowError) {
        console.error('IndexNow error:', indexNowError);
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
    
    await updateJobProgress('failed', errorMessage, 0, 0, 1);
    
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
