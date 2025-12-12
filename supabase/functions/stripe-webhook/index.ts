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
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Helper to trigger Pipedrive sync for a professional
async function triggerPipedriveSync(professionalId: string): Promise<void> {
  try {
    await supabase
      .from('pipedrive_sync_queue')
      .upsert({
        professional_id: professionalId,
        status: 'pending',
        attempts: 0,
        next_retry_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'professional_id' });
    logStep('Queued Pipedrive sync', { professionalId });
  } catch (err) {
    logStep('Warning: Failed to queue Pipedrive sync', { error: String(err) });
  }
}

// Track funnel event
async function trackFunnelEvent(professionalId: string, eventName: string, eventData: Record<string, any> = {}): Promise<void> {
  try {
    await supabase
      .from('funnel_events')
      .insert({
        professional_id: professionalId,
        event_name: eventName,
        event_data: eventData
      });
    logStep('Tracked funnel event', { professionalId, eventName });
  } catch (err) {
    logStep('Warning: Failed to track funnel event', { error: String(err) });
  }
}

// Send payment failure email
async function sendPaymentFailureEmail(email: string, name: string): Promise<void> {
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
      to: email,
      subject: '⚠️ Payment Issue with Your Top10Lists Subscription',
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h1 style="color: #1a1a1a;">Payment Issue</h1>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Hi ${name},
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              We had trouble processing your latest payment for your Top10Lists Premium Placement subscription.
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Please update your payment method to keep your guaranteed Top 10 placement active.
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              If you have any questions, just reply to this email.
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-top: 32px;">
              Best regards,<br>
              <strong>The Top10Lists Team</strong>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    await smtpClient.close();
    logStep('Sent payment failure email', { email });
  } catch (err) {
    logStep('Warning: Failed to send payment failure email', { error: String(err) });
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    
    // For now, parse without signature verification (add STRIPE_WEBHOOK_SECRET later)
    // const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    // const event = stripe.webhooks.constructEvent(body, sig!, webhookSecret!);
    
    const event = JSON.parse(body) as Stripe.Event;
    
    logStep('Received event', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const professionalId = session.metadata?.professionalId || session.client_reference_id;
        
        if (!professionalId) {
          logStep('No professionalId in session', { sessionId: session.id });
          break;
        }

        logStep('Processing checkout.session.completed', { professionalId, sessionId: session.id });

        // Extract data from session
        const cityIds = session.metadata?.cityIds?.split(',').filter(Boolean) || [];
        const packageName = session.metadata?.packageName || '';
        const monthlyTotal = parseInt(session.metadata?.monthlyTotal || '0');
        
        // Get promo code if used
        let promoCode: string | null = null;
        let discountAmountCents = 0;
        if (session.total_details?.amount_discount) {
          discountAmountCents = session.total_details.amount_discount;
        }
        
        // Expand session to get discount details
        const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['total_details.breakdown.discounts']
        });
        
        const discounts = (expandedSession.total_details?.breakdown as any)?.discounts || [];
        if (discounts.length > 0 && discounts[0].discount?.coupon?.name) {
          promoCode = discounts[0].discount.coupon.name;
        }

        // Get city names
        const { data: cities } = await supabase
          .from('arizona_city_pricing')
          .select('city_name')
          .in('id', cityIds);
        const cityNames = cities?.map(c => c.city_name) || [];

        // Record payment transaction
        await supabase
          .from('payment_transactions')
          .insert({
            professional_id: professionalId,
            stripe_event_id: event.id,
            stripe_subscription_id: typeof session.subscription === 'string' 
              ? session.subscription 
              : (session.subscription as any)?.id,
            event_type: 'checkout.session.completed',
            amount_cents: session.amount_total || 0,
            currency: session.currency || 'usd',
            promo_code: promoCode,
            discount_amount_cents: discountAmountCents,
            status: 'succeeded',
            cities_purchased: cityNames,
            package_name: packageName
          });

        // Update professional with subscription details
        await supabase
          .from('professionals')
          .update({
            is_brand_builder: true,
            funnel_status: 'subscribed',
            funnel_completed_at: new Date().toISOString(),
            subscription_status: 'active',
            promo_code_used: promoCode,
            monthly_revenue_cents: monthlyTotal * 100,
            last_payment_at: new Date().toISOString(),
            last_payment_status: 'succeeded',
            cities_subscribed: cityNames
          })
          .eq('id', professionalId);

        // Track funnel event
        await trackFunnelEvent(professionalId, 'checkout_completed', {
          session_id: session.id,
          amount_cents: session.amount_total,
          promo_code: promoCode,
          discount_cents: discountAmountCents,
          package_name: packageName,
          city_count: cityIds.length,
          city_names: cityNames
        });

        // Trigger Pipedrive sync
        await triggerPipedriveSync(professionalId);

        logStep('Checkout completed', { professionalId, amount: session.amount_total });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' 
          ? invoice.subscription 
          : (invoice.subscription as any)?.id;
        
        if (!subscriptionId) {
          logStep('No subscriptionId in invoice');
          break;
        }

        // Find professional by subscription ID
        const { data: subscription } = await supabase
          .from('agent_city_subscriptions')
          .select('professional_id')
          .eq('stripe_subscription_id', subscriptionId)
          .limit(1)
          .single();

        if (!subscription?.professional_id) {
          logStep('Could not find professional for subscription', { subscriptionId });
          break;
        }

        const professionalId = subscription.professional_id;

        // Record payment transaction
        await supabase
          .from('payment_transactions')
          .insert({
            professional_id: professionalId,
            stripe_event_id: event.id,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: subscriptionId,
            stripe_charge_id: typeof invoice.charge === 'string' ? invoice.charge : null,
            event_type: 'invoice.payment_succeeded',
            amount_cents: invoice.amount_paid || 0,
            currency: invoice.currency || 'usd',
            status: 'succeeded'
          });

        // Update professional payment status
        await supabase
          .from('professionals')
          .update({
            subscription_status: 'active',
            last_payment_at: new Date().toISOString(),
            last_payment_status: 'succeeded'
          })
          .eq('id', professionalId);

        // Track funnel event
        await trackFunnelEvent(professionalId, 'recurring_payment_succeeded', {
          invoice_id: invoice.id,
          amount_cents: invoice.amount_paid
        });

        // Trigger Pipedrive sync
        await triggerPipedriveSync(professionalId);

        logStep('Invoice payment succeeded', { professionalId, amount: invoice.amount_paid });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' 
          ? invoice.subscription 
          : (invoice.subscription as any)?.id;
        
        if (!subscriptionId) break;

        // Find professional
        const { data: subscription } = await supabase
          .from('agent_city_subscriptions')
          .select('professional_id, professionals!inner(name, email)')
          .eq('stripe_subscription_id', subscriptionId)
          .limit(1)
          .single();

        if (!subscription?.professional_id) break;

        const professionalId = subscription.professional_id;
        const professional = (subscription as any).professionals;

        // Record failed payment
        await supabase
          .from('payment_transactions')
          .insert({
            professional_id: professionalId,
            stripe_event_id: event.id,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: subscriptionId,
            event_type: 'invoice.payment_failed',
            amount_cents: invoice.amount_due || 0,
            currency: invoice.currency || 'usd',
            status: 'failed',
            failure_reason: (invoice as any).last_payment_error?.message || 'Payment failed'
          });

        // Update professional status
        await supabase
          .from('professionals')
          .update({
            subscription_status: 'past_due',
            last_payment_at: new Date().toISOString(),
            last_payment_status: 'failed'
          })
          .eq('id', professionalId);

        // Track funnel event
        await trackFunnelEvent(professionalId, 'payment_failed', {
          invoice_id: invoice.id,
          amount_cents: invoice.amount_due
        });

        // Send failure notification email
        if (professional?.email) {
          await sendPaymentFailureEmail(professional.email, professional.name || 'there');
        }

        // Trigger Pipedrive sync
        await triggerPipedriveSync(professionalId);

        logStep('Invoice payment failed', { professionalId });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;

        // Find professional
        const { data: subData } = await supabase
          .from('agent_city_subscriptions')
          .select('professional_id')
          .eq('stripe_subscription_id', subscriptionId)
          .limit(1)
          .single();

        if (!subData?.professional_id) break;

        const professionalId = subData.professional_id;

        // Deactivate all city subscriptions
        await supabase
          .from('agent_city_subscriptions')
          .update({ is_active: false })
          .eq('stripe_subscription_id', subscriptionId);

        // Update professional status
        await supabase
          .from('professionals')
          .update({
            is_brand_builder: false,
            subscription_status: 'canceled',
            funnel_status: 'churned'
          })
          .eq('id', professionalId);

        // Record transaction
        await supabase
          .from('payment_transactions')
          .insert({
            professional_id: professionalId,
            stripe_event_id: event.id,
            stripe_subscription_id: subscriptionId,
            event_type: 'subscription.deleted',
            amount_cents: 0,
            currency: 'usd',
            status: 'canceled'
          });

        // Track funnel event
        await trackFunnelEvent(professionalId, 'subscription_canceled', {
          subscription_id: subscriptionId
        });

        // Trigger Pipedrive sync
        await triggerPipedriveSync(professionalId);

        logStep('Subscription canceled', { professionalId, subscriptionId });
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const invoiceId = typeof charge.invoice === 'string' ? charge.invoice : null;

        // Find professional by invoice
        if (invoiceId) {
          const { data: txn } = await supabase
            .from('payment_transactions')
            .select('professional_id')
            .eq('stripe_invoice_id', invoiceId)
            .limit(1)
            .single();

          if (txn?.professional_id) {
            // Record refund
            await supabase
              .from('payment_transactions')
              .insert({
                professional_id: txn.professional_id,
                stripe_event_id: event.id,
                stripe_charge_id: charge.id,
                event_type: 'charge.refunded',
                amount_cents: charge.amount_refunded || 0,
                currency: charge.currency || 'usd',
                status: 'refunded'
              });

            // Track funnel event
            await trackFunnelEvent(txn.professional_id, 'payment_refunded', {
              charge_id: charge.id,
              amount_refunded: charge.amount_refunded
            });

            logStep('Charge refunded', { professionalId: txn.professional_id, amount: charge.amount_refunded });
          }
        }
        break;
      }

      default:
        logStep('Unhandled event type', { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    logStep('ERROR', { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
