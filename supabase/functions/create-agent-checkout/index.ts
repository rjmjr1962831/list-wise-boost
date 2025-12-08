import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@18.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-08-27.basil',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SelectedCity {
  cityId: string;
  cityName: string;
  price: number;
}

interface CheckoutRequest {
  professionalId: string;
  email: string;
  selectedCities: SelectedCity[];
  monthlyTotal: number;
  successUrl: string;
  cancelUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      professionalId, 
      email,
      selectedCities,
      monthlyTotal,
      successUrl,
      cancelUrl 
    }: CheckoutRequest = await req.json();

    console.log('Creating checkout session for:', { 
      professionalId, 
      email, 
      cityCount: selectedCities.length,
      monthlyTotal 
    });

    // Build line items from selected cities
    const lineItems = selectedCities.map((city) => ({
      price_data: {
        currency: 'usd',
        recurring: { interval: 'month' as const },
        unit_amount: Math.round(city.price * 100), // Convert to cents
        product_data: {
          name: `${city.cityName} Premium Placement`,
          description: `Guaranteed Top 10 placement in ${city.cityName}`,
        },
      },
      quantity: 1,
    }));

    // Check if customer exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Build success URL with professional ID for completion
    const successUrlWithParams = `${successUrl}?session_id={CHECKOUT_SESSION_ID}&professional_id=${professionalId}`;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer: customerId,
      customer_email: customerId ? undefined : email,
      client_reference_id: professionalId,
      metadata: {
        professionalId,
        cityCount: selectedCities.length.toString(),
        cityIds: selectedCities.map(c => c.cityId).join(','),
        monthlyTotal: monthlyTotal.toString(),
      },
      success_url: successUrlWithParams,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      subscription_data: {
        metadata: {
          professionalId,
          cityIds: selectedCities.map(c => c.cityId).join(','),
        },
      },
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
