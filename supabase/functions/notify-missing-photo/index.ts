import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  professionalName: string;
  professionalEmail: string | null;
  professionalPhone: string | null;
  professionalWebsite: string | null;
  rank: number;
  category: string;
  city: string;
  state: string;
  pageUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      professionalName,
      professionalEmail,
      professionalPhone,
      professionalWebsite,
      rank,
      category,
      city,
      state,
      pageUrl,
    }: NotificationRequest = await req.json();

    console.log(`Sending notification for ${professionalName} without photo`);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .info-box {
            background-color: #f5f5f5;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .warning-box {
            background-color: #fff3cd;
            padding: 15px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
            color: #856404;
          }
          .detail-row {
            margin: 15px 0;
            padding: 12px;
            background: white;
            border-radius: 6px;
          }
          .label {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
          }
          .value {
            color: #333;
          }
          .button {
            display: inline-block;
            background-color: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
            text-align: center;
          }
          ul {
            line-height: 1.8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">New Listee Added Without Photo</h1>
        </div>
        
        <div class="content">
          <div class="info-box">
            <h2 style="color: #667eea; margin-top: 0;">Listee Information</h2>
            <p><strong>Name:</strong> ${professionalName}</p>
            <p><strong>Rank:</strong> #${rank}</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Location:</strong> ${city}, ${state}</p>
          </div>

          <div class="warning-box">
            <p style="margin: 0;">
              <strong>⚠️ Action Required:</strong> This listee was added without a professional photo.
            </p>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #333;">Contact Details:</h3>
            <ul>
              ${professionalEmail ? `<li><strong>Email:</strong> <a href="mailto:${professionalEmail}">${professionalEmail}</a></li>` : '<li>Email: Not provided</li>'}
              ${professionalPhone ? `<li><strong>Phone:</strong> ${professionalPhone}</li>` : '<li>Phone: Not provided</li>'}
              ${professionalWebsite ? `<li><strong>Website:</strong> <a href="https://${professionalWebsite}" target="_blank">${professionalWebsite}</a></li>` : '<li>Website: Not provided</li>'}
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${pageUrl}" class="button">View Page</a>
          </div>

          <div class="footer">
            <p>This is an automated notification from Top10Lists.us</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { error } = await resend.emails.send({
      from: 'Robert from Top10lists <hello@top10lists.us>',
      replyTo: 'robert@top10lists.us',
      to: ['robert@top10lists.us'],
      subject: `New Listee Without Photo: ${professionalName} - ${city}, ${state}`,
      html: emailHtml,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log("Notification email sent successfully to robert@top10lists.us");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-missing-photo function:", error);
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
