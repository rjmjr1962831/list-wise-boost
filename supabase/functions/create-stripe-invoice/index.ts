import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2'
import Stripe from 'https://esm.sh/stripe@18.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Pricing: Audited $300/mo or $3,000/yr; Underwritten $500/mo or $5,000/yr
const PRICING: Record<string, Record<string, number>> = {
  audited:       { monthly: 30000, annual: 300000 },   // cents
  underwritten:  { monthly: 50000, annual: 500000 },
}

const TIER_LABELS: Record<string, string> = {
  audited: 'Audited',
  underwritten: 'Underwritten',
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
    const { professional_id, tier, billing_cycle } = await req.json()

    if (!professional_id || !tier || !billing_cycle) {
      throw new Error('Missing required fields: professional_id, tier, billing_cycle')
    }

    if (!PRICING[tier]) {
      throw new Error(`Invalid tier: ${tier}. Must be "audited" or "underwritten"`)
    }
    if (billing_cycle !== 'monthly' && billing_cycle !== 'annual') {
      throw new Error('billing_cycle must be "monthly" or "annual"')
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Look up professional
    const { data: professional, error: proError } = await supabase
      .from('professionals')
      .select('id, name, email')
      .eq('id', professional_id)
      .single()

    if (proError || !professional) {
      throw new Error(`Professional not found: ${proError?.message ?? 'no data'}`)
    }

    if (!professional.email || professional.email === 'pending@123.com') {
      throw new Error('Professional has no valid email address')
    }

    const email = professional.email
    const name = professional.name || 'Agent'
    const tierLabel = TIER_LABELS[tier]
    const amountCents = PRICING[tier][billing_cycle]
    const amountDollars = amountCents / 100

    console.log(`Creating invoice for ${name} (${email}): ${tierLabel} ${billing_cycle} — $${amountDollars}`)

    // 2. Find or create Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 })
    let customerId: string
    if (customers.data.length > 0) {
      customerId = customers.data[0].id
      console.log('Found existing Stripe customer:', customerId)
    } else {
      const customer = await stripe.customers.create({ email, name })
      customerId = customer.id
      console.log('Created new Stripe customer:', customerId)
    }

    // 3. Create invoice with one line item
    const periodLabel = billing_cycle === 'annual' ? '/yr' : '/mo'
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 7,
      metadata: {
        professionalId: professional_id,
        badgeTier: tier,
        billingCycle: billing_cycle,
        source: 'phone_sale',
      },
    })

    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: amountCents,
      currency: 'usd',
      description: `Top10Lists ${tierLabel} Badge Tier — ${billing_cycle === 'annual' ? 'Annual' : 'Monthly'} ($${amountDollars}${periodLabel})`,
    })

    // 4. Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id)
    console.log('Invoice finalized:', finalizedInvoice.id)

    // 5. Send the invoice (Stripe emails the agent)
    const sentInvoice = await stripe.invoices.sendInvoice(invoice.id)
    console.log('Invoice sent:', sentInvoice.id)

    const invoiceUrl = sentInvoice.hosted_invoice_url || ''

    // 6. Try to update stripe_invoice_id on professional (skip if column doesn't exist)
    try {
      await supabase
        .from('professionals')
        .update({ stripe_invoice_id: sentInvoice.id })
        .eq('id', professional_id)
    } catch {
      console.log('stripe_invoice_id column may not exist, skipping update')
    }

    // 7. Create CRM task
    await supabase.from('crm_tasks').insert({
      professional_id,
      task_type: 'invoice_sent',
      title: `Invoice sent: ${name} — ${tierLabel} ${billing_cycle}`,
      description: `Stripe invoice ${sentInvoice.id} for $${amountDollars} sent to ${email}`,
      status: 'completed',
      priority: 'normal',
    })

    // 8. Log to contact activity
    await supabase.from('crm_contact_activity').insert({
      professional_id,
      activity_type: 'invoice_sent',
      description: `Phone sale invoice sent: ${tierLabel} ${billing_cycle} — $${amountDollars} to ${email}`,
    }).catch(() => {
      // Table may not exist, that's okay
      console.log('crm_contact_activity insert skipped (table may not exist)')
    })

    console.log(`Invoice complete: ${sentInvoice.id} -> ${email}`)

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: sentInvoice.id,
        invoice_url: invoiceUrl,
        email,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error creating invoice:', error)
    return new Response(
      JSON.stringify({ error: error.message, details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
