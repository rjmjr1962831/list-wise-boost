import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User } from '@supabase/supabase-js';

// Pricing components
import { PackageSelector } from '@/components/pricing/PackageSelector';
import { PremiumAddons } from '@/components/pricing/PremiumAddons';
import { CitySelector } from '@/components/pricing/CitySelector';
import { PricingCalculator } from '@/components/pricing/PricingCalculator';
import { MobileCalculator } from '@/components/pricing/MobileCalculator';
import { WhyThreeMonths } from '@/components/pricing/WhyThreeMonths';
import { HowItWorks } from '@/components/pricing/HowItWorks';
import { FreeVsPremium } from '@/components/pricing/FreeVsPremium';
import { usePricingCalculator } from '@/hooks/usePricingCalculator';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { useFunnelTracking, FUNNEL_EVENTS } from '@/hooks/useFunnelTracking';
import { RegistrationGateModal } from '@/components/pricing/RegistrationGateModal';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export default function PremiumPricingPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  const { trackEvent: trackFunnelEvent } = useFunnelTracking(token);
  
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  
  const calculator = usePricingCalculator();

  // Check auth state
  useEffect(() => {
    window.scrollTo(0, 0);
    
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function fetchProfessional() {
      if (!token) return;
      
      try {
        // Try verification token first
        let { data, error } = await supabase
          .from('professionals')
          .select('id, name, email, phone')
          .ilike('verification_token', `%${token}%`)
          .single();

        if (error || !data) {
          // Fallback to ID
          const result = await supabase
            .from('professionals')
            .select('id, name, email, phone')
            .eq('id', token)
            .single();
          
          data = result.data;
          error = result.error;
        }

        if (error || !data) {
          toast.error('Could not find your profile');
          navigate('/');
          return;
        }

        setProfessional(data);
        
        // Track pricing page viewed
        trackFunnelEvent(FUNNEL_EVENTS.PRICING_VIEWED, { 
          professional_id: data.id 
        });
        
        // Update checkout_started_at timestamp
        supabase
          .from('professionals')
          .update({ checkout_started_at: new Date().toISOString() })
          .eq('id', data.id)
          .then(() => {});
          
      } catch (err) {
        console.error('Error fetching professional:', err);
        toast.error('Something went wrong');
      } finally {
        setLoading(false);
      }
    }

    fetchProfessional();
  }, [token, navigate, trackFunnelEvent]);

  // Handle checkout
  const handleCheckout = async () => {
    if (!professional || calculator.lineItems.length === 0) return;

    // Check if user is authenticated - if not, show registration modal
    if (!user) {
      setShowRegistrationModal(true);
      return;
    }

    setCheckoutLoading(true);
    
    // Track checkout event (GA4)
    trackEvent('checkout_started', {
      professional_id: professional.id,
      professional_name: professional.name,
      city: calculator.cityCount.toString(),
    });
    
    // Track checkout event (Funnel)
    trackFunnelEvent(FUNNEL_EVENTS.CHECKOUT_STARTED, {
      monthly_total: calculator.monthlyTotal,
      city_count: calculator.cityCount,
      package_name: calculator.selectedPackage?.name || 'build-your-own',
      total_savings: calculator.totalSavings,
    });
    try {
      // Build checkout payload with package info if selected
      const checkoutPayload: any = {
        professionalId: professional.id,
        email: professional.email,
        monthlyTotal: calculator.monthlyTotal,
        successUrl: `${window.location.origin}/agent-payment-success`,
        cancelUrl: window.location.href,
      };

      // If package selected, send package info for single line item
      if (calculator.selectedPackage) {
        checkoutPayload.package = {
          id: calculator.selectedPackage.id,
          name: calculator.selectedPackage.name,
          price: calculator.selectedPackage.earlyAdopterPrice,
          cityCount: calculator.selectedPackage.includedCityIds.length,
        };
      }

      // Add premium add-on cities (only those NOT already in selected package)
      const packageCityIds = calculator.selectedPackage?.includedCityIds || [];
      const premiumAddons = calculator.state.selectedPremiumCityIds
        .filter(cityId => !packageCityIds.includes(cityId)) // Exclude cities already in package
        .map(cityId => calculator.selectedCities.find(c => c.id === cityId))
        .filter(Boolean)
        .map(c => ({
          cityId: c!.id,
          cityName: c!.cityName,
          price: c!.earlyAdopterPrice,
        }));
      
      if (premiumAddons.length > 0) {
        checkoutPayload.premiumCities = premiumAddons;
      }

      // Add à la carte cities (build-your-own mode)
      if (calculator.state.mode === 'build-your-own') {
        checkoutPayload.selectedCities = calculator.state.selectedAlaCarte
          .map(cityId => calculator.selectedCities.find(c => c.id === cityId))
          .filter(Boolean)
          .map(c => ({
            cityId: c!.id,
            cityName: c!.cityName,
            price: c!.earlyAdopterPrice,
          }));
      }

      // All city IDs for metadata
      checkoutPayload.allCityIds = calculator.selectedCities.map(c => c.id);

      const { data, error } = await supabase.functions.invoke('create-agent-checkout', {
        body: checkoutPayload,
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('Could not start checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Premium Placement Pricing | Top10Lists.us</title>
        <meta name="description" content="Get guaranteed Top 10 placement in Arizona's most searched real estate markets. AI-optimized profiles that get recommended." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background pb-24 lg:pb-8">
        {/* Header */}
        <div className="border-b bg-gradient-to-br from-primary/5 to-accent/5">
          <div className="container max-w-6xl py-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/profile/${token}/fields`)}
              className="mb-4"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Profile
            </Button>

            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Early Adopter Pricing
              </Badge>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Secure Your Premium Placement
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Get guaranteed Top 10 placement in the cities of your choice when buyers ask AI assistants for agent recommendations.
              <span className="font-medium text-foreground"> Limited spots available.</span>
            </p>

            {professional && (
              <p className="text-sm text-muted-foreground mt-4">
                Selecting cities for: <span className="font-medium text-foreground">{professional.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="container max-w-6xl py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Selection */}
            <div className="lg:col-span-2 space-y-8">
              {/* How It Works */}
              <HowItWorks />

              <Separator />

              {/* Free vs Premium */}
              <FreeVsPremium onSelectFree={() => navigate(`/profile/${token}/select-free-city`)} />

              <Separator />

              {/* Package Selector */}
              <PackageSelector
                mode={calculator.state.mode}
                selectedPackageId={calculator.state.selectedPackageIds?.[0] || null}
                selectedPackageIds={calculator.state.selectedPackageIds || []}
                onModeChange={calculator.setMode}
                onPackageSelect={calculator.selectPackage}
                onTogglePackage={calculator.togglePackage}
                packageCoveredCityIds={calculator.packageCoveredCityIds}
              />

              <Separator />

              {/* Premium Add-ons */}
              <PremiumAddons
                selectedCityIds={calculator.state.selectedPremiumCityIds}
                onToggle={calculator.togglePremiumCity}
                packageCoveredCityIds={calculator.packageCoveredCityIds}
              />

              <Separator />

              {/* City Selector (only in build-your-own mode) */}
              <CitySelector
                selectedCityIds={calculator.state.selectedAlaCarte}
                onToggle={calculator.toggleAlaCarteCity}
                disabled={calculator.state.mode !== 'build-your-own'}
                packageCoveredCityIds={calculator.packageCoveredCityIds}
              />


              {/* Why 3 Months */}
              <WhyThreeMonths />
            </div>

            {/* Right Column - Calculator (Desktop) */}
            <div className="hidden lg:block">
              <PricingCalculator
                calculator={calculator}
                onCheckout={handleCheckout}
                isLoading={checkoutLoading}
              />
            </div>
          </div>
        </div>

        {/* Mobile Calculator */}
        <MobileCalculator
          calculator={calculator}
          onCheckout={handleCheckout}
          isLoading={checkoutLoading}
        />

        {/* Registration Gate Modal */}
        {professional && token && (
          <RegistrationGateModal
            isOpen={showRegistrationModal}
            onClose={() => setShowRegistrationModal(false)}
            onProceedToCheckout={(email) => {
              setShowRegistrationModal(false);
              // Update professional email locally and proceed
              setProfessional({ ...professional, email });
              // Continue with checkout
              setTimeout(() => handleCheckout(), 100);
            }}
            professionalEmail={professional.email}
            professionalPhone={professional.phone}
            professionalName={professional.name}
            professionalId={professional.id}
            token={token}
          />
        )}
      </div>
    </>
  );
}
