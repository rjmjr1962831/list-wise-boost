import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    
    let event: Stripe.Event

    // Verify webhook signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // No signature verification (testing)
      event = JSON.parse(body)
    }

    console.log('Stripe webhook received:', event.type)

    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object, supabase)
        break
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        await handleInvoicePaid(event.data.object, supabase)
        break
      }

      case 'invoice.payment_failed': {
        await handlePaymentFailed(event.data.object, supabase)
        break
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object, supabase)
        break
      }

      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object, supabase)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleCheckoutSessionCompleted(session: any, supabase: any) {
  const professionalId = session.metadata?.professional_id
  const tier = session.metadata?.tier
  if (!professionalId || !tier) {
    console.log('checkout.session.completed: missing professional_id or tier in metadata, skipping generate-certification')
    return
  }
  const markets = typeof session.metadata?.markets_covered === 'string'
    ? (() => { try { return JSON.parse(session.metadata.markets_covered) } catch { return [] } })()
    : (session.metadata?.markets_covered ?? [])
  const neighborhoods = typeof session.metadata?.neighborhoods_covered === 'string'
    ? (() => { try { return JSON.parse(session.metadata.neighborhoods_covered) } catch { return [] } })()
    : (session.metadata?.neighborhoods_covered ?? [])
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const fnUrl = `${supabaseUrl}/functions/v1/generate-certification`
  try {
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        professional_id: professionalId,
        tier: tier === 'audited' ? 'accredited' : tier,
        markets_covered: Array.isArray(markets) ? markets : [],
        neighborhoods_covered: Array.isArray(neighborhoods) ? neighborhoods : [],
        trigger: 'stripe_webhook',
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error('generate-certification failed:', res.status, text)
      return
    }
    console.log('generate-certification succeeded for', professionalId, tier)
  } catch (e) {
    console.error('Failed to call generate-certification:', e)
  }
}

async function handleInvoicePaid(invoice: any, supabase: any) {
  const customerEmail = invoice.customer_email
  const amountPaid = invoice.amount_paid / 100

  console.log('Processing payment:', { email: customerEmail, amount: amountPaid })

  if (!customerEmail) {
    console.error('No customer email in invoice')
    return
  }

  // Determine tier based on amount
  let tier = 'certified'
  if (amountPaid >= 150) {
    tier = 'underwritten'
  } else if (amountPaid >= 50) {
    tier = 'accredited' // Audited tier; DB still stores as 'accredited' (legacy)
  }

  console.log('Determined tier:', tier)

  // Find professional by email (case-insensitive)
  const { data: professional, error: lookupError } = await supabase
    .from('professionals')
    .select('id, name, email')
    .ilike('email', customerEmail)
    .single()

  if (lookupError || !professional) {
    console.error('Professional not found for email:', customerEmail, lookupError)
    return
  }

  console.log('Found professional:', professional.id)

  // Update professional with new tier
  const { error: updateError } = await supabase
    .from('professionals')
    .update({
      badge_tier: tier,
      badge_status: 'active',
      last_payment_at: new Date().toISOString(),
      payment_failed_at: null,
      grace_period_ends_at: null,
      subscription_status: 'active',
      monthly_revenue_cents: amountPaid * 100,
      last_payment_status: 'succeeded',
    })
    .eq('id', professional.id)

  if (updateError) {
    console.error('Failed to update professional:', updateError)
    return
  }

  console.log(`✅ Updated professional ${professional.id} to tier ${tier}`)
}

async function handlePaymentFailed(invoice: any, supabase: any) {
  const customerEmail = invoice.customer_email

  console.log('Processing payment failure:', customerEmail)

  if (!customerEmail) {
    console.error('No customer email in invoice')
    return
  }

  // Find professional by email
  const { data: professional, error: lookupError } = await supabase
    .from('professionals')
    .select('id, name, email')
    .ilike('email', customerEmail)
    .single()

  if (lookupError || !professional) {
    console.error('Professional not found for email:', customerEmail)
    return
  }

  const gracePeriodEnd = new Date()
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3)

  // Set grace period
  const { error: updateError } = await supabase
    .from('professionals')
    .update({
      badge_status: 'grace_period',
      payment_failed_at: new Date().toISOString(),
      grace_period_ends_at: gracePeriodEnd.toISOString(),
      last_payment_status: 'failed',
      subscription_status: 'past_due',
    })
    .eq('id', professional.id)

  if (updateError) {
    console.error('Failed to update professional:', updateError)
    return
  }

  console.log(`✅ Set grace period for professional ${professional.id} until ${gracePeriodEnd}`)
}

async function handleSubscriptionDeleted(subscription: any, supabase: any) {
  // Need to get customer email from subscription
  const customerId = subscription.customer
  
  console.log('Processing subscription deletion:', customerId)

  // We need the customer email, which requires looking up the customer
  // For now, log that manual intervention may be needed
  console.log('⚠️ Subscription deleted - will be downgraded by cron if payment fails')
}

async function handleSubscriptionUpdated(subscription: any, supabase: any) {
  console.log('Subscription updated:', subscription.id)
  
  // Similar issue - need customer email
  // The tier should be managed via invoice.paid events
  console.log('⚠️ Subscription updated - tier changes handled by invoice.paid')
}
