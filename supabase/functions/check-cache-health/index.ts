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
  city: string;
  hasContent: boolean;
  isPrerendered: boolean;
  contentSizeKB: number;
  issues: string[];
  hasStructuredData: boolean;
  hasAgentCards: boolean;
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

// Extract city name from URL
function extractCity(url: string): string {
  const match = url.match(/arizona\/([^/]+)\//);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : "Unknown";
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

// Analyze cached HTML content - NO AGENT DETAILS EXPOSED
function analyzeContent(html: string, url: string): CacheContentCheck {
  const issues: string[] = [];
  const city = extractCity(url);
  const contentSizeKB = Math.round(html.length / 1024);
  
  // Check for empty React shell indicators
  const isEmptyShell = html.includes('<div id="root"></div>') && 
                       !html.includes('itemtype="https://schema.org/RealEstateAgent"') &&
                       html.length < 50000;
  
  // Check for agent cards (the rendered content) - generic check, no names
  const hasAgentCards = html.includes('itemtype="https://schema.org/RealEstateAgent"') ||
                        html.includes('data-professional-id') ||
                        html.includes('professional-card');
  
  // Check for structured data (JSON-LD)
  const hasStructuredData = html.includes('application/ld+json') && 
                           (html.includes('ItemList') || html.includes('RealEstateAgent'));
  
  // Check for proper meta tags
  const hasMetaTags = html.includes('<meta name="description"') && 
                      html.includes('<title>');
  
  // Determine if content is properly prerendered
  const isPrerendered = !isEmptyShell && 
                        html.length > 50000 && 
                        (hasAgentCards || hasStructuredData);
  
  // Build issues list
  if (isEmptyShell) {
    issues.push("Empty React shell - NOT prerendered");
  }
  if (html.length < 30000) {
    issues.push(`Content too small (${contentSizeKB}KB) - likely incomplete`);
  }
  if (!hasStructuredData) {
    issues.push("Missing JSON-LD structured data");
  }
  if (!hasMetaTags) {
    issues.push("Missing meta tags");
  }
  if (!hasAgentCards && url.includes('top10realestateagents')) {
    issues.push("No agent content detected");
  }
  
  return {
    url,
    city,
    hasContent: html.length > 0,
    isPrerendered,
    contentSizeKB,
    issues,
    hasStructuredData,
    hasAgentCards,
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
    console.log(`Checking cache for: ${url}`);
    
    const html = await fetchFromKV(cacheKey);
    
    if (!html) {
      results.push({
        url,
        city: extractCity(url),
        hasContent: false,
        isPrerendered: false,
        contentSizeKB: 0,
        issues: ["Page not found in cache"],
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
    
    console.log(`  - ${check.city}: ${check.contentSizeKB}KB, Prerendered: ${check.isPrerendered}`);
    if (check.issues.length > 0) {
      console.log(`  - Issues: ${check.issues.join(', ')}`);
    }
  }
  
  const isHealthy = prerenderedCount === testUrls.length && totalIssues === 0;
  
  return {
    component: "Prerender Status",
    healthy: isHealthy,
    message: isHealthy 
      ? `All ${testUrls.length} pages properly prerendered`
      : `${prerenderedCount}/${testUrls.length} pages prerendered, ${totalIssues} issues found`,
    details: {
      results,
      prerenderedCount,
      totalPages: testUrls.length,
      totalIssues,
    },
  };
}

// Check KV is accessible
async function checkKVHealth(): Promise<HealthCheckResult> {
  try {
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return {
        component: "Cloudflare KV",
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
        component: "Cloudflare KV",
        healthy: false,
        message: `KV API error: ${data.errors?.[0]?.message || "Unknown error"}`,
      };
    }

    const keyCount = data.result?.length || 0;
    
    return {
      component: "Cloudflare KV",
      healthy: keyCount > 0,
      message: keyCount > 0 
        ? `KV accessible with ${keyCount}+ cached pages`
        : "KV accessible but no cached pages found",
      details: { keyCount },
    };
  } catch (error: any) {
    return {
      component: "Cloudflare KV",
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
        component: "Cache Queue",
        healthy: false,
        message: `Database query failed: ${error.message}`,
      };
    }

    const pending = data?.filter(r => r.status === "pending").length || 0;
    const processing = data?.filter(r => r.status === "processing").length || 0;
    const failed = data?.filter(r => r.status === "failed").length || 0;

    const isHealthy = failed < 10 && processing < 5;
    
    return {
      component: "Cache Queue",
      healthy: isHealthy,
      message: isHealthy 
        ? `Queue healthy: ${pending} pending, ${processing} processing, ${failed} failed`
        : `Queue issues: ${failed} failed items, ${processing} stuck processing`,
      details: { pending, processing, failed },
    };
  } catch (error: any) {
    return {
      component: "Cache Queue",
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
  const statusText = overallHealthy ? "HEALTHY" : "ISSUES DETECTED";
  
  // Build page status table for prerender check
  const prerenderResult = results.find(r => r.component === "Prerender Status");
  let pageStatusHtml = "";
  
  if (prerenderResult?.details?.results) {
    pageStatusHtml = `
      <h3>Page Status</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">City</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Prerendered</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Size</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Issues</th>
        </tr>
        ${prerenderResult.details.results.map((r: CacheContentCheck) => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${r.city}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${r.isPrerendered ? "✅" : "❌"}</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${r.contentSizeKB}KB</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${r.issues.length > 0 ? r.issues.join(", ") : "None"}</td>
          </tr>
        `).join("")}
      </table>
    `;
  }

  // Build component status
  const componentStatusHtml = results.map(r => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${r.healthy ? "✅" : "❌"}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${r.component}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${r.message}</td>
    </tr>
  `).join("");

  // Troubleshooting for unhealthy components
  const unhealthyComponents = results.filter(r => !r.healthy);
  const troubleshootingHtml = unhealthyComponents.length > 0 ? `
    <hr />
    <h2>🔧 Troubleshooting</h2>
    ${unhealthyComponents.map(r => `
      <p><strong>${r.component}:</strong> ${getTroubleshootingAdvice(r)}</p>
    `).join("")}
  ` : "";

  await client.send({
    from: SMTP_FROM_EMAIL!,
    to: "robert@top10lists.us",
    subject: `${statusEmoji} Cache Health: ${statusText} - ${new Date().toLocaleDateString()}`,
    html: `
      <h1>${statusEmoji} Cache Health Report</h1>
      <p><strong>Status:</strong> ${statusText}</p>
      <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      <hr />
      
      <h2>Component Status</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; border: 1px solid #ddd;">Status</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Component</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Details</th>
        </tr>
        ${componentStatusHtml}
      </table>
      
      ${pageStatusHtml}
      ${troubleshootingHtml}
      
      <hr />
      <p style="color: #666; font-size: 12px;">Automated 12-hour cache health check from Top10Lists.</p>
    `,
  });

  await client.close();
}

function getTroubleshootingAdvice(result: HealthCheckResult): string {
  switch (result.component) {
    case "Cloudflare KV":
      return "Check Cloudflare dashboard. Verify API token permissions.";
    case "Cache Queue":
      return "Review failed items in Admin Dashboard > Cache Management.";
    case "Prerender Status":
      return "Run warm-cache manually. Verify Prerender.io is working.";
    default:
      return "Review edge function logs.";
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🏥 Starting cache health check...");

  try {
    // Run all health checks in parallel
    const [kvResult, queueResult, contentResult] = await Promise.all([
      checkKVHealth(),
      checkCacheQueueHealth(),
      checkCachedContent(),
    ]);

    const results = [contentResult, kvResult, queueResult];
    const overallHealthy = results.every(r => r.healthy);

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
        subject: "🚨 IMMEDIATE: Cache Health Check FAILED",
        html: `
          <h1>🚨 Cache Health Check Error</h1>
          <p>The health check function encountered an error:</p>
          <pre style="background: #f5f5f5; padding: 15px;">${error.message}</pre>
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
