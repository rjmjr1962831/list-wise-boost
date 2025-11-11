import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SMSRequest {
  professionalId: string;
  phone: string;
  cityName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { professionalId, phone, cityName }: SMSRequest = await req.json();

    // Create verification link
    const verificationLink = `${req.headers.get('origin') || 'https://top10lists.us'}/verify-listing/${professionalId}`;

    // SMS message content
    const message = `Congratulations! Our AI has selected you as a finalist for inclusion as one of ${cityName}'s top ten agents. Click on the link to confirm your info and see how we can make you the answer to "Who's one of the top10 real estate agents in ${cityName}". ${verificationLink}`;

    // For now, just log the SMS instead of actually sending it
    console.log('=== SMS NOTIFICATION ===');
    console.log('To:', phone);
    console.log('Message:', message);
    console.log('Professional ID:', professionalId);
    console.log('Verification Link:', verificationLink);
    console.log('=====================');

    // TODO: When ready to send real SMS, uncomment and configure Twilio:
    /*
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const formData = new URLSearchParams({
      To: phone,
      From: twilioPhone,
      Body: message,
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!twilioResponse.ok) {
      throw new Error(`Twilio API error: ${await twilioResponse.text()}`);
    }

    const twilioData = await twilioResponse.json();
    console.log('SMS sent successfully:', twilioData.sid);
    */

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'SMS logged (fake mode)',
        verificationLink,
        smsContent: message
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-agent-sms function:", error);
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
