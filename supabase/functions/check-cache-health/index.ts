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

interface HealthCheckResult {
  component: string;
  healthy: boolean;
  message: string;
  details?: any;
}

async function checkKVHealth(): Promise<HealthCheckResult> {
  try {
    if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
      return {
        component: "Cloudflare KV",
        healthy: false,
        message: "Missing Cloudflare credentials",
      };
    }

    // List keys to verify KV is accessible
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/keys?limit=10`,
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
        details: data.errors,
      };
    }

    const keyCount = data.result?.length || 0;
    return {
      component: "Cloudflare KV",
      healthy: true,
      message: `KV accessible with ${keyCount} cached keys (sample)`,
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

    // Unhealthy if too many failed or stuck processing items
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

async function checkSamplePageRendering(): Promise<HealthCheckResult> {
  try {
    // Try to fetch a known page to verify rendering works
    const testUrl = "https://top10lists.us/arizona/phoenix/top10realestateagents";
    const response = await fetch(testUrl, {
      headers: { "User-Agent": "CacheHealthCheck/1.0" },
    });

    if (!response.ok) {
      return {
        component: "Page Rendering",
        healthy: false,
        message: `Sample page returned status ${response.status}`,
      };
    }

    const html = await response.text();
    const hasContent = html.includes("Top 10") && html.length > 5000;

    return {
      component: "Page Rendering",
      healthy: hasContent,
      message: hasContent 
        ? `Sample page renders correctly (${Math.round(html.length / 1024)}KB)`
        : "Sample page content appears incomplete",
      details: { contentLength: html.length },
    };
  } catch (error: any) {
    return {
      component: "Page Rendering",
      healthy: false,
      message: `Page fetch failed: ${error.message}`,
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
  
  const resultsHtml = results.map(r => `
    <tr>
      <td style="padding: 10px; border: 1px solid #ddd;">${r.healthy ? "✅" : "❌"}</td>
      <td style="padding: 10px; border: 1px solid #ddd;"><strong>${r.component}</strong></td>
      <td style="padding: 10px; border: 1px solid #ddd;">${r.message}</td>
    </tr>
  `).join("");

  const unhealthyComponents = results.filter(r => !r.healthy);
  const troubleshootingHtml = unhealthyComponents.length > 0 ? `
    <hr />
    <h2>🔧 Troubleshooting</h2>
    ${unhealthyComponents.map(r => `
      <h3>${r.component}</h3>
      <p>${getTroubleshootingAdvice(r)}</p>
    `).join("")}
  ` : "";

  await client.send({
    from: SMTP_FROM_EMAIL!,
    to: "robert@top10lists.us",
    subject: `${statusEmoji} Cache Health Check: ${statusText}`,
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
          <th style="padding: 10px; border: 1px solid #ddd;">Message</th>
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
    case "Cloudflare KV":
      return "Check Cloudflare dashboard for KV namespace status. Verify API token has correct permissions. Check CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_KV_NAMESPACE_ID secrets.";
    case "Cache Invalidation Queue":
      return "Review failed queue items in Admin Dashboard > Cache Management. Clear stuck items and retry. Check if cache invalidation edge function is running correctly.";
    case "Page Rendering":
      return "Check Cloudflare Workers status. Verify the site is accessible. Review Cloudflare Browser Rendering quotas and errors.";
    default:
      return "Review logs for this component in Supabase Edge Function logs.";
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("🏥 Starting cache health check...");

  try {
    // Run all health checks in parallel
    const [kvResult, queueResult, renderResult] = await Promise.all([
      checkKVHealth(),
      checkCacheQueueHealth(),
      checkSamplePageRendering(),
    ]);

    const results = [kvResult, queueResult, renderResult];
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
