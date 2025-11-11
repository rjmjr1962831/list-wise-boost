import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  // Handle CORS preflight requests
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

    const emailResponse = await resend.emails.send({
      from: "Top10Lists Notifications <onboarding@resend.dev>",
      to: ["robert@top10lists.us"],
      subject: `New Listee Without Photo: ${professionalName} - ${city}, ${state}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
            New Listee Added Without Photo
          </h1>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h2 style="color: #0066cc; margin-top: 0;">Listee Information</h2>
            <p><strong>Name:</strong> ${professionalName}</p>
            <p><strong>Rank:</strong> #${rank}</p>
            <p><strong>Category:</strong> ${category}</p>
            <p><strong>Location:</strong> ${city}, ${state}</p>
          </div>

          <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Action Required:</strong> This listee was added without a professional photo.
            </p>
          </div>

          <div style="margin: 20px 0;">
            <h3 style="color: #333;">Contact Details:</h3>
            <ul style="line-height: 1.8;">
              ${professionalEmail ? `<li><strong>Email:</strong> <a href="mailto:${professionalEmail}">${professionalEmail}</a></li>` : '<li>Email: Not provided</li>'}
              ${professionalPhone ? `<li><strong>Phone:</strong> ${professionalPhone}</li>` : '<li>Phone: Not provided</li>'}
              ${professionalWebsite ? `<li><strong>Website:</strong> <a href="https://${professionalWebsite}" target="_blank">${professionalWebsite}</a></li>` : '<li>Website: Not provided</li>'}
            </ul>
          </div>

          <div style="margin: 30px 0;">
            <a href="${pageUrl}" 
               style="display: inline-block; background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Page
            </a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            <p>This is an automated notification from Top10Lists.us</p>
          </div>
        </div>
      `,
    });

    console.log("Notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
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
