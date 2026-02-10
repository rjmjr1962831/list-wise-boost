const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // For now, accept webhooks without signature verification
  // TODO: Add Stripe signature verification when STRIPE_WEBHOOK_SECRET is set
  
  const event = req.body;

  try {
    console.log('Stripe webhook received:', event.type);

    switch (event.type) {
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

async function handleInvoicePaid(invoice) {
  const customerEmail = invoice.customer_email;
  const amountPaid = invoice.amount_paid / 100;

  if (!customerEmail) {
    console.error('No customer email in invoice');
    return;
  }

  // Determine tier based on amount
  let tier = 'certified';
  if (amountPaid >= 150) {
    tier = 'underwritten';
  } else if (amountPaid >= 50) {
    tier = 'accredited';
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

async function handlePaymentFailed(invoice) {
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

async function handleSubscriptionDeleted(subscription) {
  // This requires looking up customer by ID
  // For now, log and skip
  console.log('Subscription deleted, customer lookup required');
}

async function handleSubscriptionUpdated(subscription) {
  // This requires looking up customer and price
  // For now, log and skip
  console.log('Subscription updated, customer/price lookup required');
}
