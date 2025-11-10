import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface BookingConfirmationRequest {
  name: string;
  email: string;
  phone?: string;
  appointmentType: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  meetingLink?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      name,
      email,
      phone,
      appointmentType,
      appointmentDate,
      startTime,
      endTime,
      reason,
      meetingLink,
    }: BookingConfirmationRequest = await req.json();

    console.log("Sending booking confirmation to:", email);

    // Format the date nicely
    const date = new Date(appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Convert 24h time to 12h format
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    // Send email via Resend API
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Top10Lists Bookings <onboarding@resend.dev>",
        to: [email],
        subject: "Appointment Confirmation - Top10Lists",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .detail-row { margin: 15px 0; padding: 12px; background: white; border-radius: 6px; }
                .label { font-weight: bold; color: #667eea; margin-bottom: 5px; }
                .value { color: #333; }
                .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
                .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">Appointment Confirmed!</h1>
                </div>
                <div class="content">
                  <p>Hi ${name},</p>
                  <p>Your appointment has been successfully scheduled. Here are the details:</p>
                  
                  <div class="detail-row">
                    <div class="label">Appointment Type</div>
                    <div class="value">${appointmentType}</div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="label">Date</div>
                    <div class="value">${formattedDate}</div>
                  </div>
                  
                  <div class="detail-row">
                    <div class="label">Time</div>
                    <div class="value">${formatTime(startTime)} - ${formatTime(endTime)}</div>
                  </div>
                  
                  ${meetingLink ? `
                  <div class="detail-row" style="background: #e0f2fe; border-left: 4px solid #0ea5e9;">
                    <div class="label" style="color: #0369a1;">📹 Zoom Meeting</div>
                    <div class="value" style="margin-top: 10px;">
                      <a href="${meetingLink}" class="button" style="display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                        Join Zoom Meeting
                      </a>
                      <p style="margin-top: 10px; font-size: 12px; color: #64748b;">
                        Click the button above to join your appointment at the scheduled time.
                      </p>
                    </div>
                  </div>
                  ` : ''}
                  
                  ${phone ? `
                  <div class="detail-row">
                    <div class="label">Contact Phone</div>
                    <div class="value">${phone}</div>
                  </div>
                  ` : ''}
                  
                  <div class="detail-row">
                    <div class="label">Reason for Appointment</div>
                    <div class="value">${reason}</div>
                  </div>
                  
                  <p style="margin-top: 30px;">We look forward to meeting with you!</p>
                  <p>If you need to reschedule or have any questions, please reply to this email.</p>
                  
                  <div class="footer">
                    <p><strong>Top10Lists.us</strong></p>
                    <p>Connecting you with trusted professionals</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailData);
      throw new Error(emailData.message || 'Failed to send email');
    }

    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-booking-confirmation function:", error);
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
