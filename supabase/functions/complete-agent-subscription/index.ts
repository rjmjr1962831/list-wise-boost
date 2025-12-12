import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from 'https://esm.sh/stripe@18.5.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[COMPLETE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const { sessionId, professionalId } = await req.json();
    logStep('Request received', { sessionId, professionalId });

    if (!sessionId || !professionalId) {
      throw new Error('Missing sessionId or professionalId');
    }

    // Initialize clients
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Verify the checkout session is paid
    logStep('Retrieving Stripe session');
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (session.payment_status !== 'paid') {
      throw new Error('Payment not completed');
    }
    logStep('Payment verified', { status: session.payment_status });

    // Get professional data
    const { data: professional, error: fetchError } = await supabase
      .from('professionals')
      .select('id, name, email, city_id, cities!inner(name, state)')
      .eq('id', professionalId)
      .single();

    if (fetchError || !professional) {
      throw new Error(`Could not find professional: ${fetchError?.message}`);
    }
    logStep('Professional found', { name: professional.name });

    // Update professional as brand builder with enhanced tracking
    const { error: updateError } = await supabase
      .from('professionals')
      .update({
        is_brand_builder: true,
        funnel_status: 'subscribed',
        funnel_completed_at: new Date().toISOString(),
        subscription_status: 'active',
        last_payment_at: new Date().toISOString(),
        last_payment_status: 'succeeded',
      })
      .eq('id', professionalId);

    if (updateError) {
      throw new Error(`Could not update professional: ${updateError.message}`);
    }
    logStep('Professional marked as brand builder');

    // Create subscription records for selected cities
    const cityIds = session.metadata?.cityIds?.split(',') || [];
    if (cityIds.length > 0) {
      const subscriptionRecords = cityIds.map((cityId: string) => ({
        professional_id: professionalId,
        city_id: cityId,
        subscription_type: 'premium',
        stripe_subscription_id: typeof session.subscription === 'string' 
          ? session.subscription 
          : session.subscription?.id,
        is_active: true,
        started_at: new Date().toISOString(),
      }));

      const { error: subError } = await supabase
        .from('agent_city_subscriptions')
        .upsert(subscriptionRecords, { 
          onConflict: 'professional_id,city_id',
          ignoreDuplicates: false 
        });

      if (subError) {
        logStep('Warning: Could not create subscription records', { error: subError.message });
      } else {
        logStep('City subscriptions created', { count: cityIds.length });
      }
    }

    // Get the city name for the email
    const cityName = (professional as any).cities?.name || 'your selected cities';
    const stateName = (professional as any).cities?.state || 'Arizona';

    // Send confirmation email via SMTP
    if (professional.email) {
      try {
        const smtpClient = new SMTPClient({
          connection: {
            hostname: "smtp.gmail.com",
            port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
            tls: true,
            auth: {
              username: Deno.env.get('SMTP_USERNAME') || '',
              password: Deno.env.get('SMTP_PASSWORD') || '',
            },
          },
        });

        const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') || 'hello@top10lists.us';

        await smtpClient.send({
          from: fromEmail,
          to: professional.email,
          subject: '🎉 Welcome to Top10Lists Premium Placement!',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
              <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h1 style="color: #1a1a1a; margin-bottom: 24px;">Welcome to Premium Placement! 🎉</h1>
                
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                  Hi ${professional.name},
                </p>
                
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                  Congratulations! Your Premium Placement subscription is now active. You're now a <strong>Brand Builder</strong> on Top10Lists.us, which means your profile will be featured prominently when buyers search for top agents in your area.
                </p>

                <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #22c55e;">
                  <h3 style="color: #166534; margin: 0 0 12px 0;">✅ Your subscription is active!</h3>
                  <p style="color: #4b5563; margin: 0;">
                    Your profile is now live and visible to potential clients searching in ${cityName}, ${stateName}.
                  </p>
                </div>

                <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 32px;">How to See Your Listing</h2>
                
                <ol style="color: #4b5563; font-size: 16px; line-height: 1.8; padding-left: 20px;">
                  <li>Go to <a href="https://top10lists.us" style="color: #2563eb;">top10lists.us</a></li>
                  <li>Search for your city (e.g., "${cityName}")</li>
                  <li>You'll see your profile featured in the Top 10 results!</li>
                </ol>

                <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 24px 0;">
                  <h3 style="color: #1e40af; margin: 0 0 12px 0;">What happens next?</h3>
                  <ul style="color: #4b5563; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                    <li>Your profile is now AI-optimized for maximum visibility</li>
                    <li>When buyers ask AI assistants for agent recommendations, you'll be featured</li>
                    <li>Your guaranteed Top 10 placement is locked in for 24 months at your current rate</li>
                  </ul>
                </div>

                <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
                  Questions? Just reply to this email – we're here to help!
                </p>

                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-top: 32px;">
                  Best regards,<br>
                  <strong>The Top10Lists Team</strong>
                </p>
              </div>
              
              <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
                © ${new Date().getFullYear()} Top10Lists.us | Helping buyers find the best agents
              </p>
            </body>
            </html>
          `,
        });

        await smtpClient.close();
        logStep('Confirmation email sent via SMTP');
      } catch (emailError: any) {
        logStep('Warning: Email send failed', { error: emailError.message });
        // Don't throw - email failure shouldn't block the subscription
      }
    }

    logStep('Subscription completion successful');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Subscription completed successfully',
        professionalId,
        isBrandBuilder: true,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    logStep('ERROR', { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
