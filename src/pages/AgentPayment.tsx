import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CreditCard, MapPin, DollarSign } from 'lucide-react';
import { getZipCodeDetails } from '@/data/zipCodeLookup';

interface ZipCodeItem {
  zipCode: string;
  city: string;
  price: number;
}

export default function AgentPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [zipCodeItems, setZipCodeItems] = useState<ZipCodeItem[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    loadApplication();
  }, []);

  const loadApplication = async () => {
    try {
      // Get the most recent pending application for demo purposes
      // In production, you'd pass the application ID via URL params or session
      const { data, error } = await (supabase as any)
        .from('agent_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      if (!data) {
        toast.error('Application not found');
        navigate('/agent-onboarding');
        return;
      }

      setApplication(data);

      // Calculate pricing for selected zip codes
      const items: ZipCodeItem[] = [];
      let total = 0;
      let isFirstZip = true;

      // Process each city's zip codes
      const zipCodesData = data.zip_codes as any;
      for (const [cityId, zipCodes] of Object.entries(zipCodesData || {})) {
        const zipCodesArray = zipCodes as string[];
        for (const zipCode of zipCodesArray) {
          // Find the zip code in our data using the lookup function
          const zipDetails = getZipCodeDetails(zipCode);
          if (zipDetails) {
            const tierPrice = getPriceFromTier(parseInt(zipDetails.agent_value));
            // First zip is free, subsequent zips are priced by tier
            const price = isFirstZip ? 0 : tierPrice;
            if (isFirstZip) isFirstZip = false;
            
            items.push({
              zipCode,
              city: zipDetails.city,
              price,
            });
            total += price;
          }
        }
      }

      setZipCodeItems(items);
      setTotalCost(total);
    } catch (error) {
      console.error('Error loading application:', error);
      toast.error('Failed to load application');
      navigate('/agent-onboarding');
    } finally {
      setLoading(false);
    }
  };

  // Convert tier to price
  const getPriceFromTier = (tier: number): number => {
    const tierPrices: Record<number, number> = {
      1: 15,   // Tier 1 = $15/mo
      2: 30,   // Tier 2 = $30/mo
      3: 40,   // Tier 3 = $40/mo
      4: 75,   // Tier 4 = $75/mo
      5: 100,  // Tier 5 = $100/mo
    };
    return tierPrices[tier] || 15;
  };

  const handleCheckout = async () => {
    if (!application) return;

    setProcessing(true);
    try {
      const baseUrl = window.location.origin;
      
      const { data, error } = await supabase.functions.invoke('create-agent-checkout', {
        body: {
          applicationId: application.id,
          zipCodes: zipCodeItems,
          agentName: application.full_name,
          agentEmail: application.email,
          successUrl: `${baseUrl}/agent-onboarding/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${baseUrl}/agent-onboarding/payment`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Complete Payment - Agent Onboarding | Top10Lists</title>
        <meta name="description" content="Complete your agent listing payment" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
        <Header />
        
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Complete Your Payment</h1>
            <p className="text-muted-foreground">
              Review your selected zip codes and complete payment to activate your listing
            </p>
          </div>

          <div className="grid gap-6 mb-6">
            {/* Application Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Application Summary</CardTitle>
                <CardDescription>Your agent listing details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agent Name:</span>
                    <span className="font-medium">{application?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{application?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Zip Codes:</span>
                    <span className="font-medium">{zipCodeItems.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Zip Codes Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Selected Zip Codes
                </CardTitle>
                <CardDescription>Monthly pricing per zip code</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {zipCodeItems.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                      <div>
                        <div className="font-medium">ZIP {item.zipCode}</div>
                        <div className="text-sm text-muted-foreground">{item.city}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${item.price}/mo</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Total Cost */}
            <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-sunset-orange/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Total Monthly Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Billed monthly</p>
                    <p className="text-xs text-muted-foreground mt-1">Cancel anytime</p>
                  </div>
                  <div className="text-4xl font-bold text-primary">
                    ${totalCost}<span className="text-lg">/mo</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/agent-onboarding')}
              disabled={processing}
            >
              Go Back
            </Button>
            <Button
              size="lg"
              onClick={handleCheckout}
              disabled={processing || zipCodeItems.length === 0}
              className="min-w-48"
            >
              {processing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Proceed to Payment
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            You'll be redirected to Stripe's secure checkout page
          </p>
        </div>

        <Footer />
      </div>
    </>
  );
}
