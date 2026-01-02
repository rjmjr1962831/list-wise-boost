import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "robert@top10lists.us";
const BASE_URL = "https://www.top10lists.us";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://bgdtekbhelormzbymkhh.supabase.co";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

// Test URLs for GEO monitoring
const TEST_URLS = [
  "/arizona/phoenix/top10realestateagents",
  "/arizona/scottsdale/top10realestateagents",
  "/arizona/mesa/top10realestateagents",
  "/arizona/tucson/top10realestateagents",
];

interface BotTestResult {
  url: string;
  success: boolean;
  responseSize: number;
  hasJsonLd: boolean;
  hasAgentData: boolean;
  agentNames: string[];
  error?: string;
}

async function testBotResponse(path: string): Promise<BotTestResult> {
  const fullUrl = `${BASE_URL}${path}`;
  
  try {
    // Request as GPTBot to simulate AI crawler
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) GPTBot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return {
        url: path,
        success: false,
        responseSize: 0,
        hasJsonLd: false,
        hasAgentData: false,
        agentNames: [],
        error: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const responseSize = new TextEncoder().encode(html).length;

    // Check for JSON-LD schema
    const hasJsonLd = html.includes('application/ld+json') && 
                      (html.includes('"@type":"RealEstateAgent"') || 
                       html.includes('"@type":"ItemList"'));

    // Check for actual agent data (not just placeholder)
    const agentNameMatches = html.match(/class="[^"]*agent[^"]*"[^>]*>[^<]*<[^>]*>([A-Z][a-z]+ [A-Z][a-z]+)/gi) || [];
    const profileMatches = html.match(/<h[23][^>]*>([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)<\/h[23]>/g) || [];
    
    // Look for common agent name patterns in the HTML
    const namePattern = /(?:top\s*(?:10|ten)\s*)?(?:real\s*estate\s*)?agents?[^<]*<[^>]*>([A-Z][a-z]+\s+[A-Z][a-z]+)/gi;
    const additionalMatches = html.match(namePattern) || [];
    
    // Extract actual names from matches
    const agentNames: string[] = [];
    const allMatches = [...agentNameMatches, ...profileMatches, ...additionalMatches];
    
    for (const match of allMatches) {
      const nameMatch = match.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1].trim();
        if (!agentNames.includes(name) && name.length > 4 && name.length < 50) {
          agentNames.push(name);
        }
      }
    }

    // Also check for synthesized bio content (strong indicator of rendered data)
    const hasSynthesizedBio = html.includes('years of experience') || 
                              html.includes('specializes in') ||
                              html.includes('licensed since');

    const hasAgentData = responseSize > 60000 && (agentNames.length >= 3 || hasSynthesizedBio);

    return {
      url: path,
      success: hasAgentData,
      responseSize,
      hasJsonLd,
      hasAgentData,
      agentNames: agentNames.slice(0, 5),
    };
  } catch (error) {
    return {
      url: path,
      success: false,
      responseSize: 0,
      hasJsonLd: false,
      hasAgentData: false,
      agentNames: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function sendAlertEmail(results: BotTestResult[], failedCount: number): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return false;
  }

  const restartCronUrl = `${SUPABASE_URL}/functions/v1/geo-monitor-cron?action=restart-cache`;
  
  const failedResults = results.filter(r => !r.success);
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        .alert { background: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .alert h2 { color: #dc2626; margin: 0 0 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f3f4f6; font-weight: 600; }
        .fail { color: #dc2626; }
        .pass { color: #16a34a; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .button:hover { background: #1d4ed8; }
        .size-warning { color: #d97706; font-weight: 600; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="alert">
        <h2>🚨 GEO Bot Test Failed - ${failedCount}/${results.length} URLs</h2>
        <p>AI crawlers (GPTBot, ClaudeBot, PerplexityBot) are receiving empty React shells instead of fully rendered content.</p>
      </div>

      <h3>Test Results</h3>
      <table>
        <thead>
          <tr>
            <th>URL</th>
            <th>Status</th>
            <th>Size</th>
            <th>JSON-LD</th>
            <th>Agent Data</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(r => `
            <tr>
              <td>${r.url}</td>
              <td class="${r.success ? 'pass' : 'fail'}">${r.success ? '✅ PASS' : '❌ FAIL'}</td>
              <td class="${r.responseSize < 60000 ? 'size-warning' : ''}">${(r.responseSize / 1024).toFixed(1)}KB ${r.responseSize < 60000 ? '⚠️' : ''}</td>
              <td>${r.hasJsonLd ? '✅' : '❌'}</td>
              <td>${r.hasAgentData ? '✅' : '❌'} ${r.agentNames.length > 0 ? `(${r.agentNames.length} found)` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${failedResults.length > 0 ? `
        <h3>Failed URL Details</h3>
        ${failedResults.map(r => `
          <div style="background: #fef3c7; padding: 12px; border-radius: 6px; margin: 10px 0;">
            <strong>${r.url}</strong><br>
            Size: ${(r.responseSize / 1024).toFixed(1)}KB (need 60KB+)<br>
            ${r.error ? `Error: ${r.error}<br>` : ''}
            ${r.agentNames.length > 0 ? `Agents found: ${r.agentNames.join(', ')}` : 'No agent names detected'}
          </div>
        `).join('')}
      ` : ''}

      <h3>Action Required</h3>
      <p>Click the button below to restart the cache warming job and re-render all pages:</p>
      
      <a href="${restartCronUrl}" class="button">🔄 Restart Cache Warming Cron</a>

      <p style="color: #6b7280; font-size: 14px;">
        Or manually trigger from: <a href="https://www.top10lists.us/admin/prerender-status">Admin → Prerender Status</a>
      </p>

      <div class="footer">
        <p>This is an automated alert from Top10Lists.us GEO Monitor</p>
        <p>Test ran at: ${new Date().toISOString()}</p>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Top10Lists GEO Monitor <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject: `🚨 GEO Alert: ${failedCount}/${results.length} Bot Tests Failed`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send alert email:", error);
      return false;
    }

    console.log(`Alert email sent to ${ADMIN_EMAIL}`);
    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

async function restartCacheWarming(): Promise<{ success: boolean; message: string }> {
  try {
    // Call the warm-cache function to trigger cache warming
    const response = await fetch(`${SUPABASE_URL}/functions/v1/warm-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ force: true }),
    });

    if (response.ok) {
      return { success: true, message: "Cache warming restarted successfully" };
    } else {
      const text = await response.text();
      return { success: false, message: `Failed to restart: ${text}` };
    }
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  try {
    // Handle restart cache action (from email button)
    if (action === 'restart-cache') {
      console.log("🔄 Restart cache warming requested via email button");
      const result = await restartCacheWarming();
      
      // Return HTML page with result
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Cache Warming ${result.success ? 'Restarted' : 'Failed'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                   display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .card { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; max-width: 500px; }
            .success { color: #16a34a; }
            .error { color: #dc2626; }
            a { color: #2563eb; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 class="${result.success ? 'success' : 'error'}">
              ${result.success ? '✅ Cache Warming Restarted' : '❌ Restart Failed'}
            </h1>
            <p>${result.message}</p>
            <p><a href="https://www.top10lists.us/admin/prerender-status">Go to Prerender Status Dashboard →</a></p>
          </div>
        </body>
        </html>
      `;
      
      return new Response(html, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      });
    }

    // Regular cron job - run bot tests
    console.log("🤖 Starting GEO bot test (hourly cron)...");
    
    const results: BotTestResult[] = [];
    
    for (const path of TEST_URLS) {
      console.log(`Testing: ${path}`);
      const result = await testBotResponse(path);
      results.push(result);
      console.log(`  Size: ${(result.responseSize / 1024).toFixed(1)}KB, JSON-LD: ${result.hasJsonLd}, Agents: ${result.agentNames.length}`);
    }

    const failedCount = results.filter(r => !r.success).length;
    const passedCount = results.filter(r => r.success).length;

    console.log(`\n📊 Results: ${passedCount}/${results.length} passed, ${failedCount} failed`);

    let emailSent = false;
    if (failedCount > 0) {
      console.log("❌ Bot test failed, sending alert email...");
      emailSent = await sendAlertEmail(results, failedCount);
    } else {
      console.log("✅ All bot tests passed!");
    }

    return new Response(JSON.stringify({
      success: failedCount === 0,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
      },
      emailSent: failedCount > 0 ? emailSent : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("GEO monitor error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
