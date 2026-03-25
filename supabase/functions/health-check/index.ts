import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "robert@top10lists.us";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Key pages to monitor
const PAGES_TO_CHECK = [
  { path: "/arizona/scottsdale/top10realestateagents", name: "Scottsdale Realtors" },
  { path: "/arizona/phoenix/top10realestateagents", name: "Phoenix Realtors" },
  { path: "/arizona/gilbert/top10realestateagents", name: "Gilbert Realtors" },
  { path: "/", name: "Homepage" },
];

const BASE_URL = "https://www.top10lists.us";

interface HealthCheckResult {
  page: string;
  name: string;
  status: "ok" | "error" | "warning";
  statusCode?: number;
  errorMessage?: string;
  responseTime?: number;
}

interface DatabaseCheckResult {
  status: "ok" | "error";
  errorMessage?: string;
  professionalCount?: number;
  cityCount?: number;
}

interface CrawlLogCheckResult {
  status: "ok" | "error" | "warning";
  errorMessage?: string;
  recentCount?: number;
  latestEntry?: string;
}

async function checkPage(path: string, name: string): Promise<HealthCheckResult> {
  const url = `${BASE_URL}${path}`;
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Top10Lists-HealthCheck/1.0",
      },
    });
    
    const responseTime = Date.now() - startTime;
    const text = await response.text();
    
    // Check for common error patterns in the HTML
    const hasRuntimeError = text.includes("ReferenceError") || 
                           text.includes("TypeError") || 
                           text.includes("SyntaxError") ||
                           text.includes("is not defined");
    
    const hasReactError = text.includes("Error boundary") || 
                         text.includes("Something went wrong");
    
    if (!response.ok) {
      return {
        page: path,
        name,
        status: "error",
        statusCode: response.status,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }

    // Verify Content-Type is text/html — Supabase gateway can force text/plain,
    // which makes browsers display raw HTML source instead of rendering the page
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return {
        page: path,
        name,
        status: "error",
        statusCode: response.status,
        errorMessage: `Wrong Content-Type: "${contentType}" (expected text/html). Page will not render in browsers.`,
        responseTime,
      };
    }

    if (hasRuntimeError || hasReactError) {
      // Try to extract error message
      const errorMatch = text.match(/(?:ReferenceError|TypeError|SyntaxError)[^<]*/);
      return {
        page: path,
        name,
        status: "error",
        statusCode: response.status,
        errorMessage: errorMatch ? errorMatch[0] : "JavaScript runtime error detected",
        responseTime,
      };
    }
    
    // Check for slow response (warning if > 1 second)
    if (responseTime > 1000) {
      return {
        page: path,
        name,
        status: "warning",
        statusCode: response.status,
        errorMessage: `Slow response time: ${responseTime}ms`,
        responseTime,
      };
    }
    
    return {
      page: path,
      name,
      status: "ok",
      statusCode: response.status,
      responseTime,
    };
  } catch (error: any) {
    return {
      page: path,
      name,
      status: "error",
      errorMessage: error.message,
      responseTime: Date.now() - startTime,
    };
  }
}

async function checkDatabase(): Promise<DatabaseCheckResult> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check professionals table
    const { count: professionalCount, error: profError } = await supabase
      .from("professionals")
      .select("*", { count: "exact", head: true })
      .eq("active", true);
    
    if (profError) {
      return {
        status: "error",
        errorMessage: `Professionals query failed: ${profError.message}`,
      };
    }
    
    // Check cities table
    const { count: cityCount, error: cityError } = await supabase
      .from("cities")
      .select("*", { count: "exact", head: true })
      .eq("active", true);
    
    if (cityError) {
      return {
        status: "error",
        errorMessage: `Cities query failed: ${cityError.message}`,
      };
    }
    
    return {
      status: "ok",
      professionalCount: professionalCount || 0,
      cityCount: cityCount || 0,
    };
  } catch (error: any) {
    return {
      status: "error",
      errorMessage: error.message,
    };
  }
}

async function checkCrawlLogs(): Promise<CrawlLogCheckResult> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Count crawl log entries in the last 15 minutes
    const { count, error: countError } = await supabase
      .from("bot_crawl_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fifteenMinAgo);

    if (countError) {
      return {
        status: "error",
        errorMessage: `Crawl log query failed: ${countError.message}`,
      };
    }

    // Get the most recent entry timestamp
    const { data: latest, error: latestError } = await supabase
      .from("bot_crawl_logs")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestError && latestError.code !== "PGRST116") {
      return {
        status: "error",
        errorMessage: `Crawl log latest query failed: ${latestError.message}`,
      };
    }

    const recentCount = count || 0;

    if (recentCount === 0) {
      return {
        status: "error",
        recentCount: 0,
        latestEntry: latest?.created_at || "never",
        errorMessage: `No crawl logs in the last 15 minutes. logBotVisit() may be broken. Last entry: ${latest?.created_at || "none found"}`,
      };
    }

    return {
      status: "ok",
      recentCount,
      latestEntry: latest?.created_at,
    };
  } catch (error: any) {
    return {
      status: "error",
      errorMessage: error.message,
    };
  }
}

function generateDiagnosticAnalysis(pageResults: HealthCheckResult[], dbResult: DatabaseCheckResult, crawlLogResult?: CrawlLogCheckResult): string {
  const errors = pageResults.filter(r => r.status === "error");
  const warnings = pageResults.filter(r => r.status === "warning");
  
  let analysis = "";
  
  if (errors.length > 0) {
    analysis += "## Likely Causes:\n\n";
    
    for (const error of errors) {
      if (error.errorMessage?.includes("is not defined")) {
        const varMatch = error.errorMessage.match(/(\w+) is not defined/);
        const varName = varMatch ? varMatch[1] : "variable";
        analysis += `### ${error.name}\n`;
        analysis += `- **Issue**: JavaScript variable \`${varName}\` is not defined\n`;
        analysis += `- **Likely Cause**: Recent code change renamed or removed the variable without updating all references\n`;
        analysis += `- **Suggested Fix**: Search for all uses of \`${varName}\` in the codebase and ensure it's properly defined before use\n\n`;
      } else if (error.errorMessage?.includes("TypeError")) {
        analysis += `### ${error.name}\n`;
        analysis += `- **Issue**: TypeError - attempting to access property on undefined/null\n`;
        analysis += `- **Likely Cause**: Data not loading correctly or missing null checks\n`;
        analysis += `- **Suggested Fix**: Add optional chaining (?.) or null checks before accessing properties\n\n`;
      } else if (error.statusCode && error.statusCode >= 500) {
        analysis += `### ${error.name}\n`;
        analysis += `- **Issue**: Server error (HTTP ${error.statusCode})\n`;
        analysis += `- **Likely Cause**: Backend/edge function failure or database connectivity issue\n`;
        analysis += `- **Suggested Fix**: Check edge function logs and database connectivity\n\n`;
      } else {
        analysis += `### ${error.name}\n`;
        analysis += `- **Issue**: ${error.errorMessage}\n`;
        analysis += `- **Suggested Fix**: Review recent code changes to this page\n\n`;
      }
    }
  }
  
  if (dbResult.status === "error") {
    analysis += "### Database Issue\n";
    analysis += `- **Issue**: ${dbResult.errorMessage}\n`;
    analysis += `- **Suggested Fix**: Check Supabase dashboard for connection issues or quota limits\n\n`;
  }
  
  if (crawlLogResult && crawlLogResult.status !== "ok") {
    analysis += "### Crawl Log Pipeline\n";
    analysis += `- **Issue**: ${crawlLogResult.errorMessage}\n`;
    analysis += `- **Likely Cause**: logBotVisit() is not firing inside serve-bot edge functions, or bot_crawl_logs table is inaccessible\n`;
    analysis += `- **Suggested Fix**: Check that all serve-bot functions import and call logBotVisit(). Verify bot_crawl_logs table exists and RLS allows inserts from service role\n\n`;
  }

  if (warnings.length > 0) {
    analysis += "## Warnings:\n\n";
    for (const warning of warnings) {
      analysis += `- **${warning.name}**: ${warning.errorMessage}\n`;
    }
  }

  return analysis;
}

async function sendHealthAlert(
  pageResults: HealthCheckResult[],
  dbResult: DatabaseCheckResult,
  crawlLogResult: CrawlLogCheckResult
): Promise<void> {
  const errors = pageResults.filter(r => r.status === "error");
  const warnings = pageResults.filter(r => r.status === "warning");

  if (errors.length === 0 && warnings.length === 0 && dbResult.status === "ok" && crawlLogResult.status === "ok") {
    console.log("All health checks passed, no alert needed");
    return;
  }

  const analysis = generateDiagnosticAnalysis(pageResults, dbResult, crawlLogResult);
  const timestamp = new Date().toISOString();
  
  // Build chat prompt suggestion
  const chatPrompt = errors.length > 0 
    ? `Fix the health check errors found on ${errors.map(e => e.name).join(", ")}. The error was: ${errors[0].errorMessage}`
    : `Review the health check warnings for ${warnings.map(w => w.name).join(", ")}`;
  
  const encodedPrompt = encodeURIComponent(chatPrompt);
  const vercelProjectUrl = "https://vercel.com/dashboard";
  
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

  const statusEmoji = errors.length > 0 ? "🚨" : "⚠️";
  const statusText = errors.length > 0 ? "ERRORS DETECTED" : "WARNINGS";
  
  await client.send({
    from: SMTP_FROM_EMAIL!,
    to: ADMIN_EMAIL,
    subject: `${statusEmoji} Health Check: ${statusText} on Top10Lists.us`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto;">
        <h1 style="color: ${errors.length > 0 ? '#dc2626' : '#f59e0b'};">${statusEmoji} Website Health Check Report</h1>
        <p style="color: #666;"><strong>Time:</strong> ${timestamp}</p>
        
        <h2 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Page Status</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="background: #f9fafb;">
            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Page</th>
            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Status</th>
            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Response Time</th>
            <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Details</th>
          </tr>
          ${pageResults.map(r => `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <a href="${BASE_URL}${r.page}" style="color: #2563eb;">${r.name}</a>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${
                  r.status === 'ok' ? '#dcfce7; color: #166534' : 
                  r.status === 'warning' ? '#fef3c7; color: #92400e' : 
                  '#fee2e2; color: #991b1b'
                };">
                  ${r.status.toUpperCase()}
                </span>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${r.responseTime ? `${r.responseTime}ms` : 'N/A'}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #666;">
                ${r.errorMessage || 'OK'}
              </td>
            </tr>
          `).join('')}
        </table>
        
        <h2 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Database Status</h2>
        <p>
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${
            dbResult.status === 'ok' ? '#dcfce7; color: #166534' : '#fee2e2; color: #991b1b'
          };">
            ${dbResult.status.toUpperCase()}
          </span>
          ${dbResult.status === 'ok' 
            ? ` - ${dbResult.professionalCount} active professionals, ${dbResult.cityCount} active cities`
            : ` - ${dbResult.errorMessage}`
          }
        </p>
        
        <h2 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Crawl Log Pipeline</h2>
        <p>
          <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: ${
            crawlLogResult.status === 'ok' ? '#dcfce7; color: #166534' : '#fee2e2; color: #991b1b'
          };">
            ${crawlLogResult.status.toUpperCase()}
          </span>
          ${crawlLogResult.status === 'ok'
            ? ` - ${crawlLogResult.recentCount} crawl log entries in last 15 min (latest: ${crawlLogResult.latestEntry})`
            : ` - ${crawlLogResult.errorMessage}`
          }
        </p>

        ${errors.length > 0 || warnings.length > 0 || crawlLogResult.status !== 'ok' ? `
          <h2 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 30px;">AI Diagnostic Analysis</h2>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            ${analysis.replace(/\n/g, '<br>').replace(/#{3}\s*([^\n]+)/g, '<h4 style="margin: 16px 0 8px 0; color: #1f2937;">$1</h4>').replace(/#{2}\s*([^\n]+)/g, '<h3 style="margin: 20px 0 12px 0; color: #111827;">$1</h3>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\`([^\`]+)\`/g, '<code style="background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-size: 13px;">$1</code>')}
          </div>
          
          <h2 style="border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 30px;">Quick Fix</h2>
          <p>Copy this prompt into the Vercel chat to fix the issue:</p>
          <div style="background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 14px; margin-bottom: 20px;">
            ${chatPrompt}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${vercelProjectUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Open Vercel to Fix →
            </a>
          </div>
        ` : ''}
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          This automated health check runs every 15 minutes.<br>
          Top10Lists.us Monitoring System
        </p>
      </div>
    `,
  });

  await client.close();
  console.log("Health alert email sent successfully");
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting health check...");
    
    // Check all pages in parallel
    const pageResults = await Promise.all(
      PAGES_TO_CHECK.map(page => checkPage(page.path, page.name))
    );
    
    // Check database and crawl logs in parallel
    const [dbResult, crawlLogResult] = await Promise.all([
      checkDatabase(),
      checkCrawlLogs(),
    ]);

    console.log("Page results:", JSON.stringify(pageResults, null, 2));
    console.log("Database result:", JSON.stringify(dbResult, null, 2));
    console.log("Crawl log result:", JSON.stringify(crawlLogResult, null, 2));

    // Send alert if any issues found
    await sendHealthAlert(pageResults, dbResult, crawlLogResult);

    const hasErrors = pageResults.some(r => r.status === "error") || dbResult.status === "error" || crawlLogResult.status === "error";
    const hasWarnings = pageResults.some(r => r.status === "warning") || crawlLogResult.status === "warning";

    return new Response(
      JSON.stringify({
        status: hasErrors ? "error" : hasWarnings ? "warning" : "ok",
        timestamp: new Date().toISOString(),
        pages: pageResults,
        database: dbResult,
        crawlLogs: crawlLogResult,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Health check failed:", error);
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
