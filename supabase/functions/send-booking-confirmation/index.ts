import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const date = new Date(appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };

    const clientHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}.container{max-width:600px;margin:0 auto;padding:20px;}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;}.content{background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px;}.detail-row{margin:15px 0;padding:12px;background:white;border-radius:6px;}.label{font-weight:bold;color:#667eea;margin-bottom:5px;}.value{color:#333;}.footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #ddd;color:#666;font-size:14px;}.button{display:inline-block;padding:12px 24px;background:#667eea;color:white;text-decoration:none;border-radius:6px;margin:20px 0;}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;">Appointment Confirmed!</h1></div><div class="content"><p>Hi ${name},</p><p>Your appointment has been successfully scheduled. Here are the details:</p><div class="detail-row"><div class="label">Appointment Type</div><div class="value">${appointmentType}</div></div><div class="detail-row"><div class="label">Date</div><div class="value">${formattedDate}</div></div><div class="detail-row"><div class="label">Time</div><div class="value">${formatTime(startTime)} - ${formatTime(endTime)}</div></div>${meetingLink ? `<div class="detail-row" style="background:#e0f2fe;border-left:4px solid #0ea5e9;"><div class="label" style="color:#0369a1;">📹 Zoom Meeting</div><div class="value" style="margin-top:10px;"><a href="${meetingLink}" class="button" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Join Zoom Meeting</a><p style="margin-top:10px;font-size:12px;color:#64748b;">Click the button above to join your appointment at the scheduled time.</p></div></div>` : ''}${phone ? `<div class="detail-row"><div class="label">Contact Phone</div><div class="value">${phone}</div></div>` : ''}<div class="detail-row"><div class="label">Reason for Appointment</div><div class="value">${reason}</div></div><p style="margin-top:30px;">We look forward to meeting with you!</p><div style="text-align:center;margin:30px 0;"><a href="https://top10lists.us/book-appointment-robert" class="button" style="display:inline-block;padding:12px 24px;background:#667eea;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Reschedule Appointment</a></div><p style="text-align:center;color:#666;font-size:14px;">Need to change your appointment time? Click the button above to select a new slot.</p><div class="footer"><p><strong>Top10Lists.us</strong></p><p>Connecting you with trusted professionals</p></div></div></div></body></html>`;

    const adminHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}.container{max-width:600px;margin:0 auto;padding:20px;}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;text-align:center;border-radius:8px 8px 0 0;}.content{background:#f9f9f9;padding:30px;border-radius:0 0 8px 8px;}.detail-row{margin:15px 0;padding:12px;background:white;border-radius:6px;}.label{font-weight:bold;color:#667eea;margin-bottom:5px;}.value{color:#333;}.footer{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #ddd;color:#666;font-size:14px;}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;">📅 New Appointment Booked</h1></div><div class="content"><p><strong>Client Information:</strong></p><div class="detail-row"><div class="label">Name</div><div class="value">${name}</div></div><div class="detail-row"><div class="label">Email</div><div class="value">${email}</div></div>${phone ? `<div class="detail-row"><div class="label">Phone</div><div class="value">${phone}</div></div>` : ''}<hr style="margin:20px 0;border:none;border-top:1px solid #ddd;"><p><strong>Appointment Details:</strong></p><div class="detail-row"><div class="label">Appointment Type</div><div class="value">${appointmentType}</div></div><div class="detail-row"><div class="label">Date</div><div class="value">${formattedDate}</div></div><div class="detail-row"><div class="label">Time</div><div class="value">${formatTime(startTime)} - ${formatTime(endTime)}</div></div>${meetingLink ? `<div class="detail-row" style="background:#e0f2fe;border-left:4px solid #0ea5e9;"><div class="label" style="color:#0369a1;">📹 Zoom Meeting Link</div><div class="value" style="margin-top:5px;"><a href="${meetingLink}" style="color:#0ea5e9;word-break:break-all;">${meetingLink}</a></div></div>` : ''}<div class="detail-row"><div class="label">Reason for Appointment</div><div class="value">${reason}</div></div><div class="footer"><p><strong>Top10Lists.us Admin</strong></p></div></div></div></body></html>`;

    // Send confirmation email to client
    const { error: clientError } = await resend.emails.send({
      from: 'Robert from Top10lists <hello@top10lists.us>',
      replyTo: 'robert@top10lists.us',
      to: [email],
      subject: "Appointment Confirmation - Top10Lists",
      html: clientHtml,
    });

    if (clientError) {
      throw new Error(clientError.message);
    }

    console.log("Client confirmation email sent successfully");

    // Send notification email to admin
    if (ADMIN_EMAIL) {
      const { error: adminError } = await resend.emails.send({
        from: 'Robert from Top10lists <hello@top10lists.us>',
        replyTo: 'robert@top10lists.us',
        to: [ADMIN_EMAIL],
        subject: `New Appointment Booked - ${name}`,
        html: adminHtml,
      });

      if (adminError) {
        console.error("Admin notification email error:", adminError);
      } else {
        console.log("Admin notification email sent successfully");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
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
