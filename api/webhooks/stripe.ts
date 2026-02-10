import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

// Disable body parsing, need raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable: VercelRequest) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Error processing webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const amountPaid = invoice.amount_paid / 100; // Convert cents to dollars

  // Determine tier based on amount
  let tier = 'certified';
  if (amountPaid >= 150) {
    tier = 'underwritten';
  } else if (amountPaid >= 50) {
    tier = 'accredited';
  }

  // Find professional by Stripe customer ID (stored in metadata or separate table)
  // For now, assuming customer email matches professional email
  const customerEmail = invoice.customer_email;
  
  if (!customerEmail) {
    console.error('No customer email in invoice');
    return;
  }

  const { data: professional, error } = await supabase
    .from('professionals')
    .select('id')
    .eq('email', customerEmail)
    .single();

  if (error || !professional) {
    console.error('Professional not found for email:', customerEmail);
    return;
  }

  // Update badge tier and status
  await supabase
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
    .eq('id', professional.id);

  console.log(`Updated professional ${professional.id} to tier ${tier}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerEmail = invoice.customer_email;
  
  if (!customerEmail) {
    console.error('No customer email in invoice');
    return;
  }

  const { data: professional, error } = await supabase
    .from('professionals')
    .select('id')
    .eq('email', customerEmail)
    .single();

  if (error || !professional) {
    console.error('Professional not found for email:', customerEmail);
    return;
  }

  // Set grace period (3 days from now)
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

  await supabase
    .from('professionals')
    .update({
      badge_status: 'grace_period',
      payment_failed_at: new Date().toISOString(),
      grace_period_ends_at: gracePeriodEnd.toISOString(),
      last_payment_status: 'failed',
    })
    .eq('id', professional.id);

  console.log(`Set grace period for professional ${professional.id} until ${gracePeriodEnd}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  // Get customer email from Stripe
  const customer = await stripe.customers.retrieve(customerId);
  const customerEmail = (customer as Stripe.Customer).email;

  if (!customerEmail) {
    console.error('No customer email found');
    return;
  }

  const { data: professional, error } = await supabase
    .from('professionals')
    .select('id')
    .eq('email', customerEmail)
    .single();

  if (error || !professional) {
    console.error('Professional not found for email:', customerEmail);
    return;
  }

  // Immediate downgrade to certified (no grace period for voluntary cancellation)
  await supabase
    .from('professionals')
    .update({
      badge_tier: 'certified',
      badge_status: 'active',
      subscription_status: 'canceled',
      monthly_revenue_cents: 0,
      payment_failed_at: null,
      grace_period_ends_at: null,
    })
    .eq('id', professional.id);

  console.log(`Downgraded professional ${professional.id} to certified (subscription canceled)`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Handle tier changes (upgrade/downgrade while active)
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  
  if (!priceId) return;

  // Get price amount to determine tier
  const price = await stripe.prices.retrieve(priceId);
  const amount = (price.unit_amount || 0) / 100;

  let tier = 'certified';
  if (amount >= 150) {
    tier = 'underwritten';
  } else if (amount >= 50) {
    tier = 'accredited';
  }

  const customer = await stripe.customers.retrieve(customerId);
  const customerEmail = (customer as Stripe.Customer).email;

  if (!customerEmail) {
    console.error('No customer email found');
    return;
  }

  const { data: professional, error } = await supabase
    .from('professionals')
    .select('id')
    .eq('email', customerEmail)
    .single();

  if (error || !professional) {
    console.error('Professional not found for email:', customerEmail);
    return;
  }

  await supabase
    .from('professionals')
    .update({
      badge_tier: tier,
      badge_status: 'active',
      monthly_revenue_cents: amount * 100,
    })
    .eq('id', professional.id);

  console.log(`Updated professional ${professional.id} tier to ${tier} (subscription changed)`);
}
