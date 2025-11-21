import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FailureAlertRequest {
  functionName: string;
  error: string;
  context?: Record<string, any>;
  timestamp?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { functionName, error, context, timestamp }: FailureAlertRequest = await req.json();

    // Initialize SMTP client
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
      subject: "🚨 APIFY GETDATA API FAILURE",
      html: `
        <h1>🚨 Apify API Failure Alert</h1>
        <p><strong>Function:</strong> ${functionName}</p>
        <p><strong>Time:</strong> ${timestamp || new Date().toISOString()}</p>
        <hr />
        <h2>Error Details:</h2>
        <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${error}</pre>
        ${context ? `
          <hr />
          <h2>Additional Context:</h2>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">${JSON.stringify(context, null, 2)}</pre>
        ` : ''}
        <hr />
        <p style="color: #666; font-size: 12px;">This alert was sent by Top10Lists monitoring system.</p>
      `,
    });

    await client.close();

    console.log("Failure alert email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending failure alert:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
