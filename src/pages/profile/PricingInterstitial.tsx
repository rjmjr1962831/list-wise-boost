import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PRICING_TIERS } from '@/types/pricing';

interface PricingTierSummary {
  tier_name: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  city_count: number;
  price_monthly: number;
  price_annual: number;
  sample_cities: string[];
}

export default function PricingInterstitial() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<PricingTierSummary[]>([]);
  const [isAnnual, setIsAnnual] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

        // Fetch Arizona city pricing
        const { data: cityData, error: cityError } = await supabase
          .from('arizona_city_pricing')
          .select('*')
          .eq('is_active', true)
          .order('value_tier', { ascending: false });

        if (cityError) throw cityError;

        // Group by tier and create summary
        const tierMap = new Map<string, PricingTierSummary>();
        
        (cityData || []).forEach(city => {
          const existing = tierMap.get(city.tier_name);
          if (existing) {
            existing.city_count++;
            if (existing.sample_cities.length < 3) {
              existing.sample_cities.push(city.city_name);
            }
          } else {
            tierMap.set(city.tier_name, {
              tier_name: city.tier_name as any,
              city_count: 1,
              price_monthly: city.price_monthly,
              price_annual: city.price_annual,
              sample_cities: [city.city_name]
            });
          }
        });

        const sortedTiers = Array.from(tierMap.values()).sort((a, b) => {
          const order = { Platinum: 4, Gold: 3, Silver: 2, Bronze: 1 };
          return order[b.tier_name] - order[a.tier_name];
        });

        setTiers(sortedTiers);

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
    navigate(`/profile/${token}/select-cities`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            Expand Your Reach Across Arizona
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Your free city listing is confirmed. Add more cities to maximize your visibility.
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
              <span className="ml-2 text-green-600 text-sm font-medium">
                (Save 2 months FREE)
              </span>
            </Label>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {tiers.map((tier) => {
            const tierConfig = PRICING_TIERS.find(t => t.name === tier.tier_name);
            if (!tierConfig) return null;

            const price = isAnnual ? tier.price_annual / 12 : tier.price_monthly;
            const totalPrice = isAnnual ? tier.price_annual : tier.price_monthly;

            return (
              <Card
                key={tier.tier_name}
                className={`p-6 ${tierConfig.bgColor} ${tierConfig.borderColor} border-2 hover:shadow-lg transition-shadow`}
              >
                <div className="text-center mb-6">
                  <Badge className={`${tierConfig.badgeColor} mb-3`}>
                    {tier.tier_name}
                  </Badge>
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    ${Math.round(price)}
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </h3>
                  {isAnnual && (
                    <p className="text-xs text-muted-foreground">
                      ${totalPrice}/year
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    {tierConfig.description}
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className={`h-4 w-4 ${tierConfig.color}`} />
                    <span className="font-medium">
                      {tier.city_count} {tier.city_count === 1 ? 'City' : 'Cities'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Including: {tier.sample_cities.join(', ')}
                    {tier.city_count > 3 && ` +${tier.city_count - 3} more`}
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleProceedToSelection}
                  variant={tier.tier_name === 'Gold' ? 'default' : 'outline'}
                >
                  View Cities
                </Button>
              </Card>
            );
          })}
        </div>

        {/* Value Prop */}
        <Card className="p-8 mb-8 border-2 border-primary/20">
          <h2 className="text-2xl font-bold text-center text-foreground mb-6">
            Why Add More Cities?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">🎯</div>
              <h3 className="font-semibold text-foreground mb-2">Targeted Exposure</h3>
              <p className="text-sm text-muted-foreground">
                Get found by buyers and sellers in specific Arizona markets
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🤖</div>
              <h3 className="font-semibold text-foreground mb-2">AI Discovery</h3>
              <p className="text-sm text-muted-foreground">
                Appear when ChatGPT, Claude, Perplexity, and other AI models search for agents
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">📈</div>
              <h3 className="font-semibold text-foreground mb-2">Market Leadership</h3>
              <p className="text-sm text-muted-foreground">
                Position yourself as a regional expert across multiple cities
              </p>
            </div>
          </div>
        </Card>

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