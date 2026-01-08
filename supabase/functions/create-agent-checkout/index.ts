import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@18.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-08-27.basil',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Legacy city-based pricing (deprecated)
interface SelectedCity {
  cityId: string;
  cityName: string;
  price: number;
}

// NEW: Neighborhood-based pricing
interface SelectedNeighborhood {
  neighborhoodId: string;
  neighborhoodName: string;
  cityArea: string;
  tier: 'Main' | 'Prime' | 'Luxury';
  price: number;
}

interface PackageInfo {
  id: string;
  name: string;
  price: number;
  cityCount: number;
}

interface CheckoutRequest {
  professionalId: string;
  email: string;
  // Legacy fields (deprecated but still supported)
  package?: PackageInfo;
  premiumCities?: SelectedCity[];
  selectedCities?: SelectedCity[];
  allCityIds?: string[];
  // NEW: Neighborhood-based fields
  selectedNeighborhoods?: SelectedNeighborhood[];
  allNeighborhoodIds?: string[];
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
      package: packageInfo,
      premiumCities,
      selectedCities,
      allCityIds,
      selectedNeighborhoods,
      allNeighborhoodIds,
      monthlyTotal,
      successUrl,
      cancelUrl 
    }: CheckoutRequest = await req.json();

    console.log('Creating checkout session for:', { 
      professionalId, 
      email, 
      hasPackage: !!packageInfo,
      packageName: packageInfo?.name,
      premiumCityCount: premiumCities?.length || 0,
      selectedCityCount: selectedCities?.length || 0,
      selectedNeighborhoodCount: selectedNeighborhoods?.length || 0,
      monthlyTotal 
    });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // NEW: Add neighborhood subscriptions as line items
    if (selectedNeighborhoods && selectedNeighborhoods.length > 0) {
      selectedNeighborhoods.forEach((neighborhood) => {
        lineItems.push({
          price_data: {
            currency: 'usd',
            recurring: { interval: 'month' as const },
            unit_amount: Math.round(neighborhood.price * 100),
            product_data: {
              name: `${neighborhood.neighborhoodName} (${neighborhood.tier})`,
              description: `${neighborhood.tier} neighborhood in ${neighborhood.cityArea} - Guaranteed Top 10 placement`,
              metadata: {
                neighborhood_id: neighborhood.neighborhoodId,
                tier: neighborhood.tier,
              },
            },
          },
          quantity: 1,
        });
      });
    }

    // LEGACY: Add package as single line item if selected (deprecated)
    if (packageInfo) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          recurring: { interval: 'month' as const },
          unit_amount: Math.round(packageInfo.price * 100),
          product_data: {
            name: `${packageInfo.name} Package`,
            description: `Guaranteed Top 10 placement in ${packageInfo.cityCount} cities`,
          },
        },
        quantity: 1,
      });
    }

    // LEGACY: Add premium add-on cities as separate line items (deprecated)
    if (premiumCities && premiumCities.length > 0) {
      premiumCities.forEach((city) => {
        lineItems.push({
          price_data: {
            currency: 'usd',
            recurring: { interval: 'month' as const },
            unit_amount: Math.round(city.price * 100),
            product_data: {
              name: `${city.cityName} Premium Placement`,
              description: `Guaranteed Top 10 placement in ${city.cityName}`,
            },
          },
          quantity: 1,
        });
      });
    }

    // LEGACY: Add à la carte cities (build-your-own mode) (deprecated)
    if (selectedCities && selectedCities.length > 0) {
      selectedCities.forEach((city) => {
        lineItems.push({
          price_data: {
            currency: 'usd',
            recurring: { interval: 'month' as const },
            unit_amount: Math.round(city.price * 100),
            product_data: {
              name: `${city.cityName} Premium Placement`,
              description: `Guaranteed Top 10 placement in ${city.cityName}`,
            },
          },
          quantity: 1,
        });
      });
    }

    if (lineItems.length === 0) {
      throw new Error('No items selected for checkout');
    }

    // Check if customer exists
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Build success URL with professional ID for completion
    const successUrlWithParams = `${successUrl}?session_id={CHECKOUT_SESSION_ID}&professional_id=${professionalId}`;

    // Calculate totals for metadata
    const totalNeighborhoods = allNeighborhoodIds?.length || selectedNeighborhoods?.length || 0;
    const totalCities = allCityIds?.length || 
      (packageInfo?.cityCount || 0) + 
      (premiumCities?.length || 0) + 
      (selectedCities?.length || 0);

    // Build metadata
    const metadata: Record<string, string> = {
      professionalId,
      monthlyTotal: monthlyTotal.toString(),
    };

    // Add neighborhood metadata if present
    if (allNeighborhoodIds && allNeighborhoodIds.length > 0) {
      metadata.neighborhoodIds = allNeighborhoodIds.join(',');
      metadata.neighborhoodCount = totalNeighborhoods.toString();
    }

    // Add legacy city metadata if present
    if (packageInfo) {
      metadata.packageId = packageInfo.id;
      metadata.packageName = packageInfo.name;
    }
    if (allCityIds && allCityIds.length > 0) {
      metadata.cityIds = allCityIds.join(',');
      metadata.cityCount = totalCities.toString();
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      customer: customerId,
      customer_email: customerId ? undefined : email,
      client_reference_id: professionalId,
      metadata,
      success_url: successUrlWithParams,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      subscription_data: {
        metadata: {
          professionalId,
          neighborhoodIds: allNeighborhoodIds?.join(',') || '',
          packageId: packageInfo?.id || '',
          cityIds: allCityIds?.join(',') || '',
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
