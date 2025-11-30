import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface PricingPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  features: string[];
  cities_included: number;
  is_featured: boolean;
}

export default function PricingInterstitial() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isAnnual, setIsAnnual] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!token) {
        navigate('/404');
        return;
      }

      try {
        // Validate token
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('validate-profile-token', {
          body: { token }
        });

        if (tokenError || !tokenData?.success) {
          toast({
            title: 'Invalid Link',
            description: 'This verification link is invalid or has expired.',
            variant: 'destructive'
          });
          navigate('/404');
          return;
        }

        // Fetch pricing plans
        const { data: plansData, error: plansError } = await supabase
          .from('pricing_plans')
          .select('*')
          .eq('is_active', true)
          .order('display_order');

        if (plansError) throw plansError;

        // Convert features from Json to string[]
        const formattedPlans = (plansData || []).map(plan => ({
          ...plan,
          features: Array.isArray(plan.features) 
            ? (plan.features as string[])
            : []
        })) as PricingPlan[];

        setPlans(formattedPlans);

        // Track pricing view
        supabase.functions.invoke('track-profile-event', {
          body: { token, event_name: 'pricing_viewed' }
        });
      } catch (err) {
        console.error('Error loading pricing:', err);
        toast({
          title: 'Error',
          description: 'Failed to load pricing information.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, navigate, toast]);

  const handleScheduleCall = () => {
    // Track event
    supabase.functions.invoke('track-profile-event', {
      body: { token, event_name: 'schedule_clicked_from_pricing' }
    });
    navigate(`/profile/${token}/schedule`);
  };

  const handleProceedToSelection = () => {
    // Track event
    supabase.functions.invoke('track-profile-event', {
      body: { token, event_name: 'selection_clicked_from_pricing' }
    });
    navigate(`/profile/${token}/select`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const annualSavings = 20; // 20% savings on annual

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Step 3 of 3</span>
            <span className="text-sm text-muted-foreground">Optional Upgrade</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Expand Your Reach (Optional)
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Your free listing is confirmed. Want to maximize your visibility?
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <Label htmlFor="billing" className={!isAnnual ? 'font-semibold' : ''}>
              Monthly
            </Label>
            <Switch
              id="billing"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
            />
            <Label htmlFor="billing" className={isAnnual ? 'font-semibold' : ''}>
              Annual
              <span className="ml-2 text-primary text-sm">
                (Save {annualSavings}%)
              </span>
            </Label>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => {
            const price = isAnnual ? plan.price_annual : plan.price_monthly;
            const isFree = plan.slug === 'free';
            const monthlyEquivalent = isAnnual && price > 0 ? (price / 12).toFixed(2) : null;

            return (
              <Card
                key={plan.id}
                className={`p-6 relative ${
                  plan.is_featured
                    ? 'border-2 border-primary shadow-xl scale-105'
                    : 'border-border'
                }`}
              >
                {plan.is_featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      <Star className="h-3 w-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  
                  <div className="mb-4">
                    <div className="text-4xl font-bold text-foreground">
                      ${price}
                      {!isFree && <span className="text-lg text-muted-foreground">/mo</span>}
                    </div>
                    {monthlyEquivalent && (
                      <div className="text-sm text-muted-foreground">
                        Billed ${plan.price_annual}/year
                      </div>
                    )}
                  </div>

                  {isFree ? (
                    <Button className="w-full" variant="outline" disabled>
                      <Check className="h-4 w-4 mr-2" />
                      Already Included
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={handleProceedToSelection}>
                      Select Plan
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-foreground mb-2">
                    {plan.cities_included} {plan.cities_included === 1 ? 'City' : 'Cities'} Included
                  </div>
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        {/* CTAs */}
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Not Sure Which Plan Is Right?
          </h2>
          <p className="text-muted-foreground mb-6">
            Let's talk! We'll help you choose the best option for your business goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleScheduleCall}>
              Schedule a Quick Call
            </Button>
            <Button size="lg" variant="outline" onClick={handleProceedToSelection}>
              Proceed to Selection
            </Button>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <Button
            variant="ghost"
            onClick={() => navigate(`/profile/${token}/edit`)}
          >
            ← Back to Profile
          </Button>
        </div>
      </div>
    </div>
  );
}