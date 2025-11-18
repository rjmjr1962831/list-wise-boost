import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@18.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-08-27.basil',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZipCodeItem {
  zipCode: string;
  city: string;
  price: number;
}

interface CheckoutRequest {
  applicationId: string;
  zipCodes: ZipCodeItem[];
  agentName: string;
  agentEmail: string;
  successUrl: string;
  cancelUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      applicationId, 
      zipCodes, 
      agentName, 
      agentEmail,
      successUrl,
      cancelUrl 
    }: CheckoutRequest = await req.json();

    console.log('Creating checkout session for:', { applicationId, agentName, zipCodeCount: zipCodes.length });

    // Build line items from zip codes
    const lineItems = zipCodes.map((item) => ({
      price_data: {
        currency: 'usd',
        unit_amount: item.price * 100, // Convert to cents
        product_data: {
          name: `ZIP Code ${item.zipCode} Access`,
          description: `Monthly access for ${item.city}, ${item.zipCode}`,
        },
      },
      quantity: 1,
    }));

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer_email: agentEmail,
      client_reference_id: applicationId,
      metadata: {
        applicationId,
        agentName,
        zipCodeCount: zipCodes.length.toString(),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString() 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
