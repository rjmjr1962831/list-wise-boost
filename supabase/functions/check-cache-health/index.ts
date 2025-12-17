import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");

const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN");
const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CacheContentCheck {
  url: string;
  cacheKey: string;
  hasContent: boolean;
  isPrerendered: boolean;
  contentSize: number;
  issues: string[];
  agentCount: number;
  hasStructuredData: boolean;
  hasAgentCards: boolean;
  sampleAgentName?: string;
}

interface HealthCheckResult {
  component: string;
  healthy: boolean;
  message: string;
  details?: any;
}

// Convert URL to cache key format used by warm-cache
function urlToCacheKey(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 512);
}

// Fetch content directly from KV cache
async function fetchFromKV(cacheKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${cacheKey}`,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.log(`KV fetch failed for ${cacheKey}: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error(`KV fetch error for ${cacheKey}:`, error);
    return null;
  }
}

// Analyze cached HTML content for quality
function analyzeContent(html: string, url: string): CacheContentCheck {
  const issues: string[] = [];
  const cacheKey = urlToCacheKey(url);
  
  // Check for empty React shell indicators
  const isEmptyShell = html.includes('<div id="root"></div>') && 
                       !html.includes('class="professional-card"') &&
                       html.length < 50000;
  
  // Check for agent cards (the rendered content)
  const hasAgentCards = html.includes('ProfessionalCard') || 
                        html.includes('professional-card') ||
                        html.includes('data-professional-id') ||
                        html.includes('itemtype="https://schema.org/RealEstateAgent"');
  
  // Check for structured data (JSON-LD)
  const hasStructuredData = html.includes('application/ld+json') && 
                           (html.includes('ItemList') || html.includes('RealEstateAgent'));
  
  // Count agent mentions by looking for common patterns
  const agentNameMatches = html.match(/class="[^"]*agent-name[^"]*"|itemProp="name"/g) || [];
  const agentCount = agentNameMatches.length;
  
  // Extract a sample agent name if present
  const nameMatch = html.match(/<h3[^>]*>([A-Z][a-z]+ [A-Z][a-z]+)<\/h3>/);
  const sampleAgentName = nameMatch ? nameMatch[1] : undefined;
  
  // Check for proper meta tags
  const hasMetaTags = html.includes('<meta name="description"') && 
                      html.includes('<title>');
  
  // Determine if content is properly prerendered
  const isPrerendered = !isEmptyShell && 
                        html.length > 50000 && 
                        (hasAgentCards || hasStructuredData || agentCount > 0);
  
  // Build issues list
  if (isEmptyShell) {
    issues.push("Content appears to be empty React shell (not prerendered)");
  }
  if (html.length < 30000) {
    issues.push(`Content too small (${Math.round(html.length / 1024)}KB) - likely incomplete`);
  }
  if (!hasStructuredData) {
    issues.push("Missing JSON-LD structured data");
  }
  if (!hasMetaTags) {
    issues.push("Missing meta description or title tags");
  }
  if (agentCount === 0 && url.includes('top10realestateagents')) {
    issues.push("No agent content detected on agent listing page");
  }
  
  return {
    url,
    cacheKey,
    hasContent: html.length > 0,
    isPrerendered,
    contentSize: html.length,
    issues,
    agentCount,
    hasStructuredData,
    hasAgentCards,
    sampleAgentName,
  };
}

// Check multiple cached pages
async function checkCachedContent(): Promise<HealthCheckResult> {
  const testUrls = [
    "https://www.top10lists.us/arizona/scottsdale/top10realestateagents",
    "https://www.top10lists.us/arizona/phoenix/top10realestateagents",
    "https://www.top10lists.us/arizona/gilbert/top10realestateagents",
  ];
  
  const results: CacheContentCheck[] = [];
  let totalIssues = 0;
  let prerenderedCount = 0;
  
  for (const url of testUrls) {
    const cacheKey = urlToCacheKey(url);
    console.log(`Checking cache for: ${url} (key: ${cacheKey})`);
    
    const html = await fetchFromKV(cacheKey);
    
    if (!html) {
      results.push({
        url,
        cacheKey,
        hasContent: false,
        isPrerendered: false,
        contentSize: 0,
        issues: ["Page not found in cache"],
        agentCount: 0,
        hasStructuredData: false,
        hasAgentCards: false,
      });
      totalIssues++;
      continue;
    }
    
    const check = analyzeContent(html, url);
    results.push(check);
    
    if (check.isPrerendered) {
      prerenderedCount++;
    }
    totalIssues += check.issues.length;
    
    console.log(`  - Size: ${Math.round(check.contentSize / 1024)}KB`);
    console.log(`  - Prerendered: ${check.isPrerendered}`);
    console.log(`  - Agent cards: ${check.hasAgentCards}`);
    console.log(`  - Sample agent: ${check.sampleAgentName || 'none found'}`);
    if (check.issues.length > 0) {
      console.log(`  - Issues: ${check.issues.join(', ')}`);
    }
  }
  
  const isHealthy = prerenderedCount === testUrls.length && totalIssues === 0;
  
  const summaryLines = results.map(r => {
    const status = r.isPrerendered ? "✅" : "❌";
    const size = Math.round(r.contentSize / 1024);
    const cityMatch = r.url.match(/arizona\/([^/]+)\//);
    const city = cityMatch ? cityMatch[1] : r.url;
    const agent = r.sampleAgentName ? ` (e.g. ${r.sampleAgentName})` : '';
    return `${status} ${city}: ${size}KB${agent}${r.issues.length > 0 ? ' - ' + r.issues[0] : ''}`;
  });
  
  return {
    component: "Cached Content Quality",
    healthy: isHealthy,
    message: isHealthy 
      ? `All ${testUrls.length} pages properly prerendered with agent content`
      : `${prerenderedCount}/${testUrls.length} pages prerendered, ${totalIssues} issues found`,
    details: {
      results,
      summary: summaryLines,
      prerenderedCount,
      totalPages: testUrls.length,
      totalIssues,
    },
  };
}

// Check KV is accessible and count keys
async function checkKVHealth(): Promise<HealthCheckResult> {
  try {
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return {
        component: "Cloudflare KV Access",
        healthy: false,
        message: "Missing Cloudflare credentials",
      };
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/keys?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return {
        component: "Cloudflare KV Access",
        healthy: false,
        message: `KV API error: ${data.errors?.[0]?.message || "Unknown error"}`,
        details: data.errors,
      };
    }

    const keyCount = data.result?.length || 0;
    const sampleKeys = data.result?.slice(0, 5).map((k: any) => k.name) || [];
    
    return {
      component: "Cloudflare KV Access",
      healthy: keyCount > 0,
      message: keyCount > 0 
        ? `KV accessible with ${keyCount}+ cached pages`
        : "KV accessible but no cached pages found",
      details: { keyCount, sampleKeys },
    };
  } catch (error: any) {
    return {
      component: "Cloudflare KV Access",
      healthy: false,
      message: `KV check failed: ${error.message}`,
    };
  }
}

// Check cache invalidation queue status
async function checkCacheQueueHealth(): Promise<HealthCheckResult> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("cache_invalidation_queue")
      .select("status")
      .in("status", ["pending", "processing", "failed"]);

    if (error) {
      return {
        component: "Cache Invalidation Queue",
        healthy: false,
        message: `Database query failed: ${error.message}`,
      };
    }

    const pending = data?.filter(r => r.status === "pending").length || 0;
    const processing = data?.filter(r => r.status === "processing").length || 0;
    const failed = data?.filter(r => r.status === "failed").length || 0;

    const isHealthy = failed < 10 && processing < 5;
    
    return {
      component: "Cache Invalidation Queue",
      healthy: isHealthy,
      message: isHealthy 
        ? `Queue healthy: ${pending} pending, ${processing} processing, ${failed} failed`
        : `Queue issues: ${failed} failed items, ${processing} stuck processing`,
      details: { pending, processing, failed },
    };
  } catch (error: any) {
    return {
      component: "Cache Invalidation Queue",
      healthy: false,
      message: `Queue check failed: ${error.message}`,
    };
  }
}

async function sendHealthEmail(results: HealthCheckResult[], overallHealthy: boolean): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: SMTP_HOST,
      port: SMTP_PORT,
      tls: true,
      auth: {
        username: SMTP_USERNAME!,
        password: SMTP_PASSWORD!,
      },
    },
  });

  const statusEmoji = overallHealthy ? "✅" : "🚨";
  const statusText = overallHealthy ? "HEALTHY - Prerendered Content Verified" : "ISSUES DETECTED";
  
  // Build detailed results HTML
  let resultsHtml = "";
  for (const r of results) {
    const statusIcon = r.healthy ? "✅" : "❌";
    let detailsHtml = "";
    
    // Special formatting for content quality check
    if (r.component === "Cached Content Quality" && r.details?.summary) {
      detailsHtml = `
        <ul style="margin: 5px 0; padding-left: 20px;">
          ${r.details.summary.map((s: string) => `<li>${s}</li>`).join("")}
        </ul>
      `;
    }
    
    resultsHtml += `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;">${statusIcon}</td>
        <td style="padding: 10px; border: 1px solid #ddd; vertical-align: top;"><strong>${r.component}</strong></td>
        <td style="padding: 10px; border: 1px solid #ddd;">
          ${r.message}
          ${detailsHtml}
        </td>
      </tr>
    `;
  }

  const unhealthyComponents = results.filter(r => !r.healthy);
  const troubleshootingHtml = unhealthyComponents.length > 0 ? `
    <hr />
    <h2>🔧 Troubleshooting</h2>
    ${unhealthyComponents.map(r => `
      <h3>${r.component}</h3>
      <p>${getTroubleshootingAdvice(r)}</p>
      ${r.details?.results ? `
        <h4>Page Details:</h4>
        <ul>
          ${r.details.results.filter((p: CacheContentCheck) => p.issues.length > 0).map((p: CacheContentCheck) => `
            <li><strong>${p.url}</strong>: ${p.issues.join(', ')}</li>
          `).join('')}
        </ul>
      ` : ''}
    `).join("")}
  ` : "";

  await client.send({
    from: SMTP_FROM_EMAIL!,
    to: "robert@top10lists.us",
    subject: `${statusEmoji} Cache Health: ${statusText}`,
    html: `
      <h1>${statusEmoji} Cache Health Report</h1>
      <p><strong>Status:</strong> ${statusText}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <hr />
      <h2>Component Status</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 10px; border: 1px solid #ddd;">Status</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Component</th>
          <th style="padding: 10px; border: 1px solid #ddd;">Details</th>
        </tr>
        ${resultsHtml}
      </table>
      ${troubleshootingHtml}
      <hr />
      <p style="color: #666; font-size: 12px;">Automated cache health check from Top10Lists monitoring system.</p>
    `,
  });

  await client.close();
}

function getTroubleshootingAdvice(result: HealthCheckResult): string {
  switch (result.component) {
    case "Cloudflare KV Access":
      return "Check Cloudflare dashboard for KV namespace status. Verify API token has correct permissions.";
    case "Cache Invalidation Queue":
      return "Review failed queue items in Admin Dashboard > Cache Management. Clear stuck items and retry.";
    case "Cached Content Quality":
      return "Run the warm-cache function manually to refresh cached content. Verify Prerender.io is working correctly. Check that pages have agent data in the database.";
    default:
      return "Review logs for this component in Supabase Edge Function logs.";
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🏥 Starting comprehensive cache health check...");

  try {
    // Run all health checks in parallel
    const [kvResult, queueResult, contentResult] = await Promise.all([
      checkKVHealth(),
      checkCacheQueueHealth(),
      checkCachedContent(),
    ]);

    const results = [contentResult, kvResult, queueResult]; // Content check first
    const overallHealthy = results.every(r => r.healthy);

    console.log(`Health check results:`, JSON.stringify(results, null, 2));
    console.log(`Overall status: ${overallHealthy ? "HEALTHY" : "UNHEALTHY"}`);

    // Send email with results
    await sendHealthEmail(results, overallHealthy);
    console.log("✅ Health check email sent");

    return new Response(
      JSON.stringify({
        success: true,
        healthy: overallHealthy,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Cache health check failed:", error);
    
    // Try to send failure alert
    try {
      const client = new SMTPClient({
        connection: {
          hostname: SMTP_HOST,
          port: SMTP_PORT,
          tls: true,
          auth: {
            username: SMTP_USERNAME!,
            password: SMTP_PASSWORD!,
          },
        },
      });

      await client.send({
        from: SMTP_FROM_EMAIL!,
        to: "robert@top10lists.us",
        subject: "🚨 Cache Health Check FAILED",
        html: `
          <h1>🚨 Cache Health Check Error</h1>
          <p>The health check function itself encountered an error:</p>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${error.message}</pre>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
        `,
      });
      await client.close();
    } catch (emailError) {
      console.error("Failed to send error email:", emailError);
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
