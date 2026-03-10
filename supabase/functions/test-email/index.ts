// DEPRECATED — This edge function is no longer in active use. See docs/takeaways for context.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const smtpClient = new SMTPClient({
  connection: {
    hostname: "smtp.gmail.com",
    port: 465,
    tls: true,
    auth: {
      username: "robert@top10lists.us",
      password: "pewacsqsjpocgnsp",
    },
  },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    // Always send to both test addresses plus the requested one
    const recipients = email ? [email, 'robert@maynard.com', 'robert@aryah.ai'] : ['robert@maynard.com', 'robert@aryah.ai'];

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Test Email from Top10Lists</h1>
        </div>
        
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; margin-bottom: 20px;">This is a test email to check deliverability and spam score.</p>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">If you received this, our email configuration is working correctly.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 14px; color: #6b7280; margin: 0;">
            Best regards,<br>
            <strong>Robert Maynard</strong><br>
            <em>Founder, Top10Lists.us</em><br>
            <a href="https://top10lists.us">top10lists.us</a>
          </p>
        </div>
      </body>
      </html>
    `;

    // Send to all recipients
    for (const recipient of recipients) {
      await smtpClient.send({
        from: "Robert Maynard <robert@top10lists.us>",
        to: recipient,
        subject: 'Test Email from Top10Lists',
        content: "auto",
        html: emailHtml,
      });
    }

    console.log("✅ Test email sent to:", recipients.join(", "));

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully", recipients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    try {
      await smtpClient.close();
    } catch (closeError) {
      console.warn('SMTP close error:', closeError);
    }
  }
});
