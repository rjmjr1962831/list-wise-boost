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

interface FrontendErrorRequest {
  errorMessage: string;
  errorStack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { errorMessage, errorStack, componentStack, url, userAgent, timestamp }: FrontendErrorRequest = await req.json();

    console.log("Frontend error alert received:", { errorMessage, url, timestamp });

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
      subject: `🚨 Frontend Error on ${url}`,
      html: `
        <h1>🚨 Frontend Error Alert</h1>
        <p><strong>Page:</strong> ${url}</p>
        <p><strong>Time:</strong> ${timestamp}</p>
        <p><strong>Browser:</strong> ${userAgent}</p>
        <hr />
        <h2>Error Message:</h2>
        <pre style="background: #ffebee; padding: 15px; border-radius: 5px; color: #c62828;">${errorMessage}</pre>
        ${errorStack ? `
          <h2>Stack Trace:</h2>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; font-size: 12px; overflow-x: auto;">${errorStack}</pre>
        ` : ''}
        ${componentStack ? `
          <h2>Component Stack:</h2>
          <pre style="background: #fff3e0; padding: 15px; border-radius: 5px; font-size: 12px;">${componentStack}</pre>
        ` : ''}
        <hr />
        <p style="color: #666; font-size: 12px;">This alert was sent by Top10Lists.us error monitoring system.</p>
      `,
    });

    await client.close();

    console.log("Frontend error alert email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending frontend error alert:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
