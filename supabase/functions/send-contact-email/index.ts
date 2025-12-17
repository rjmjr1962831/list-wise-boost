import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SMTP_HOST = "mail.privateemail.com";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USERNAME = Deno.env.get("SMTP_USERNAME");
const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactEmailRequest {
  professionalName: string;
  professionalId: string;
  professionalEmail: string;
  listingUrl: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  cityName: string;
  categoryName: string;
  professionalWebsite?: string;
  quizPreferences?: Record<string, string>;
  isFirstContact?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      professionalName,
      professionalId,
      professionalEmail,
      listingUrl,
      contactName,
      contactEmail,
      contactPhone,
      message,
      cityName,
      categoryName,
      professionalWebsite,
      quizPreferences,
      isFirstContact,
    }: ContactEmailRequest = await req.json();

    console.log('Sending contact form email for:', professionalName);

    // Generate verification token if this is first contact
    let verificationLink = '';
    if (isFirstContact && professionalEmail) {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Token expires in 30 days

      // Create Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Update professional with verification token
      const { error: updateError } = await supabase
        .from('professionals')
        .update({
          verification_token: token,
          verification_token_expires_at: expiresAt.toISOString()
        })
        .eq('id', professionalId);

      if (updateError) {
        console.error('Error updating professional with token:', updateError);
      } else {
        verificationLink = `${supabaseUrl.replace('bgdtekbhelormzbymkhh.supabase.co', 'top10lists.us')}/verify/${token}`;
        console.log('Generated verification link:', verificationLink);
      }
    }

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

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .info-section {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              border-left: 4px solid #667eea;
            }
            .info-label {
              font-weight: 600;
              color: #667eea;
              margin-bottom: 5px;
            }
            .info-value {
              color: #333;
              margin-bottom: 15px;
            }
            .message-box {
              background: white;
              padding: 20px;
              border-radius: 8px;
              border: 1px solid #e5e7eb;
              margin-top: 20px;
            }
            .footer {
              background: #1f2937;
              color: #9ca3af;
              padding: 20px;
              text-align: center;
              border-radius: 0 0 8px 8px;
              font-size: 12px;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin-top: 15px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>New Message for Unverified Listee</h1>
          </div>
          
          <div class="content">
            <div class="info-section">
              <div class="info-label">Professional:</div>
              <div class="info-value"><strong>${professionalName}</strong> (ID: ${professionalId})</div>
              
              <div class="info-label">City:</div>
              <div class="info-value">${cityName}</div>
              
              <div class="info-label">Type:</div>
              <div class="info-value">${categoryName}</div>
              
              <div class="info-label">Top10Lists Profile:</div>
              <div class="info-value">
                <a href="${listingUrl}" style="color: #667eea;">${listingUrl}</a>
              </div>
              
              ${professionalWebsite ? `
                <div class="info-label">Professional Website:</div>
                <div class="info-value">
                  <a href="${professionalWebsite.startsWith('http') ? professionalWebsite : 'https://' + professionalWebsite}" style="color: #667eea;" target="_blank">${professionalWebsite}</a>
                </div>
              ` : ''}
            </div>

            <div class="info-section">
              <h3 style="margin-top: 0; color: #667eea;">Contact Information</h3>
              
              <div class="info-label">Name:</div>
              <div class="info-value">${contactName}</div>
              
              <div class="info-label">Email:</div>
              <div class="info-value">
                <a href="mailto:${contactEmail}" style="color: #667eea;">${contactEmail}</a>
              </div>
              
              <div class="info-label">Phone:</div>
              <div class="info-value">
                <a href="tel:${contactPhone}" style="color: #667eea;">${contactPhone}</a>
              </div>
            </div>

            ${quizPreferences && Object.keys(quizPreferences).length > 0 ? `
              <div class="message-box">
                <div class="info-label">Quiz Responses:</div>
                <div class="info-value">
                  ${Object.entries(quizPreferences)
                    .map(([key, value]) => {
                      // Format the key to be more readable
                      const label = key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase())
                        .trim();
                      return `<strong>${label}:</strong> ${value}`;
                    })
                    .join('<br>')}
                </div>
              </div>
            ` : ''}

            ${message ? `
              <div class="message-box" style="margin-top: 15px;">
                <div class="info-label">Additional Message:</div>
                <div class="info-value">${message.replace(/\n/g, '<br>')}</div>
              </div>
            ` : ''}

            ${verificationLink ? `
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px; margin: 30px 0; text-align: center;">
                <h3 style="color: white; margin-top: 0;">🎉 Claim Your Free Listing</h3>
                <p style="color: white; margin: 15px 0;">Take control of your Top10Lists profile and unlock premium features!</p>
                <a href="${verificationLink}" style="display: inline-block; background: white; color: #667eea; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; margin: 10px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                  Verify Your Listing →
                </a>
                <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 15px 0 0 0;">
                  ✓ Control your information<br/>
                  ✓ Get a verified badge<br/>
                  ✓ Receive 3x more leads
                </p>
              </div>
            ` : ''}

            <a href="${listingUrl}" class="button">View Listing</a>
          </div>

          <div class="footer">
            <p>This message was sent via Top10Lists.us contact form</p>
            <p>&copy; ${new Date().getFullYear()} Top10Lists.us. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    // Build subject line with City, Type, and Agent Name
    const subject = `${cityName}: ${categoryName} - ${professionalName}`;

    // Send email to the admin email
    await client.send({
      from: SMTP_FROM_EMAIL!,
      to: 'contactforms@top10lists.us',
      subject: subject,
      html: emailHtml,
    });

    // If verification link exists, also send copy to professional
    if (verificationLink && professionalEmail) {
      await client.send({
        from: SMTP_FROM_EMAIL!,
        to: professionalEmail,
        subject: `New Lead from Top10Lists + Verify Your Listing`,
        html: emailHtml,
      });
      console.log('Verification email also sent to professional:', professionalEmail);
    }

    await client.close();

    console.log('Contact form email sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error sending contact form email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
