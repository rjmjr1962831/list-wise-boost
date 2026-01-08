import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, ArrowRight, Search, Flame, MessageSquare, Shield, Info, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { NeighborhoodTier, NEIGHBORHOOD_TIER_PRICES, NEIGHBORHOOD_TIER_STYLES, getAnnualPrice } from '@/types/neighborhoodPricing';

interface NeighborhoodTierSummary {
  tier_name: NeighborhoodTier;
  neighborhood_count: number;
  price_monthly: number;
  price_annual: number;
  sample_neighborhoods: string[];
}

export default function PricingInterstitial() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<NeighborhoodTierSummary[]>([]);
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

        // Fetch neighborhood catalog for pricing display
        const { data: neighborhoodData, error: neighborhoodError } = await supabase
          .from('neighborhood_catalog')
          .select('*')
          .eq('is_active', true)
          .order('score', { ascending: false })
          .limit(100); // Sample for display

        if (neighborhoodError) throw neighborhoodError;

        // Group by tier and create summary using derived pricing
        const tierMap = new Map<NeighborhoodTier, NeighborhoodTierSummary>();
        
        (neighborhoodData || []).forEach(neighborhood => {
          const tier = neighborhood.tier as NeighborhoodTier;
          const existing = tierMap.get(tier);
          if (existing) {
            existing.neighborhood_count++;
            if (existing.sample_neighborhoods.length < 3) {
              existing.sample_neighborhoods.push(`${neighborhood.neighborhood} (${neighborhood.city_area})`);
            }
          } else {
            const monthlyPrice = NEIGHBORHOOD_TIER_PRICES[tier];
            tierMap.set(tier, {
              tier_name: tier,
              neighborhood_count: 1,
              price_monthly: monthlyPrice,
              price_annual: getAnnualPrice(monthlyPrice),
              sample_neighborhoods: [`${neighborhood.neighborhood} (${neighborhood.city_area})`]
            });
          }
        });

        // Sort tiers: Luxury > Prime > Main
        const sortedTiers = Array.from(tierMap.values()).sort((a, b) => {
          const order: Record<NeighborhoodTier, number> = { Luxury: 3, Prime: 2, Main: 1 };
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

  const handleProceedToSelection = () => {
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
      <div className="max-w-5xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Step 3 of 3</span>
            <span className="text-sm text-muted-foreground">Optional</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Hero Section - REPLACED ENTIRELY */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Expand Your Visibility Across More Cities
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Optional visibility tools for professionals already included editorially on Top10Lists.us
          </p>
        </div>

        {/* Hero Supporting Copy */}
        <Card className="mb-10 border-border bg-muted/30">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-foreground">
              You are already included editorially on Top10Lists.us at no cost.
            </p>
            <p className="text-muted-foreground">
              The options below allow you to extend where and how your profile is distributed across additional cities.
            </p>
            <p className="text-sm text-muted-foreground font-medium">
              Editorial inclusion and ranking methodology are independent of payment.
            </p>
          </CardContent>
        </Card>

        {/* Educational Anchor: How This Works - REQUIRED */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">How This Works</h2>
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <Search className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Editorial Inclusion</p>
                    <p className="text-sm text-muted-foreground">Similar to organic search results</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                  <ArrowRight className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Paid Options</p>
                    <p className="text-sm text-muted-foreground">Similar to advertising</p>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  Payment expands visibility and distribution but does not change editorial criteria or ranking.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Free vs Expanded Visibility */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">Free Listing vs Expanded Visibility</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Free Listing */}
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Check className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Free Listing</h3>
                    <p className="text-xs text-muted-foreground">Always included</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>Editorial profile in one primary city</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>Verified license display</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>AI indexing eligibility</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>Public profile page</span>
                  </li>
                </ul>
                <div className="mt-6 pt-4 border-t">
                  <p className="text-2xl font-bold text-foreground">$0</p>
                  <p className="text-xs text-muted-foreground">Always included</p>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-4"
                  onClick={() => navigate(`/profile/${token}/edit`)}
                >
                  Continue with Free Listing
                </Button>
              </CardContent>
            </Card>

            {/* Expanded Visibility */}
            <Card className="border-primary relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary to-accent" />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Expanded Visibility</h3>
                      <p className="text-xs text-muted-foreground">Optional</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Optional tools to extend your presence across additional cities and comparison views.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Coverage in additional cities</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Enhanced profile distribution</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Multi-city discovery contexts</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Video introduction support</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Ongoing indexing optimization</span>
                  </li>
                </ul>
                <div className="mt-6 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Starting at</p>
                  <p className="text-2xl font-bold text-foreground">$29<span className="text-sm font-normal text-muted-foreground">/mo per city</span></p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* City Coverage Packages */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Custom City Coverage</h2>
              <p className="text-sm text-muted-foreground">Select cities to expand your visibility</p>
            </div>
            {/* Billing Toggle */}
            <div className="flex items-center gap-3">
              <Label htmlFor="billing" className={!isAnnual ? 'font-semibold' : 'text-muted-foreground'}>
                Monthly
              </Label>
              <Switch
                id="billing"
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
              />
              <Label htmlFor="billing" className={isAnnual ? 'font-semibold' : 'text-muted-foreground'}>
                Annual
                <span className="ml-2 text-primary text-sm font-medium">
                  (Save 2 months)
                </span>
              </Label>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {tiers.map((tier) => {
              const tierStyle = NEIGHBORHOOD_TIER_STYLES[tier.tier_name];
              if (!tierStyle) return null;

              const price = isAnnual ? tier.price_annual / 10 : tier.price_monthly;

              return (
                <Card
                  key={tier.tier_name}
                  className={`p-5 ${tierStyle.bg} ${tierStyle.border} border hover:shadow-md transition-shadow cursor-pointer`}
                  onClick={handleProceedToSelection}
                >
                  <div className="mb-4">
                    <Badge className={`${tierStyle.badge} mb-2`}>
                      {tier.tier_name}
                    </Badge>
                    <h3 className="text-xl font-bold text-foreground">
                      ${Math.round(price)}
                      <span className="text-sm text-muted-foreground font-normal">/mo</span>
                    </h3>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className={`h-4 w-4 ${tierStyle.color}`} />
                      <span className="font-medium">
                        {tier.neighborhood_count} {tier.neighborhood_count === 1 ? 'neighborhood' : 'neighborhoods'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Including: {tier.sample_neighborhoods.slice(0, 2).join(', ')}
                      {tier.neighborhood_count > 2 && ` +${tier.neighborhood_count - 2} more`}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Limited capacity per neighborhood
                  </p>
                </Card>
              );
            })}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-sm text-muted-foreground">
              City availability is limited to maintain editorial quality.
            </p>
          </div>
        </div>

        {/* 3-Month Explanation */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">Why 3 Months?</h2>
          <Card className="border-border">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-6">
                AI models require time to discover, verify, and incorporate profile information. The 3-month period allows for complete integration into AI indexing systems.
              </p>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-5 w-5 text-primary" />
                    <span className="font-medium">Month 1: Indexing</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI systems discover and index your expanded profile information.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-5 w-5 text-accent" />
                    <span className="font-medium">Month 2: Verification</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Systems verify and cross-reference your credentials and information.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span className="font-medium">Month 3: Citation Eligibility</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your profile becomes eligible for citation in AI-generated responses.
                  </p>
                </div>
              </div>

              <div className="mt-6 p-3 rounded-lg bg-muted/20 border border-border/50">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <strong>Eligibility does not guarantee AI recommendations.</strong> AI systems determine which sources to cite based on their own criteria. You're charged monthly—not upfront. After your 3-month commitment, you can cancel anytime.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trust Lock - MANDATORY */}
        <Card className="mb-10 border-2 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Shield className="h-6 w-6 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Editorial Integrity Statement</h3>
                <p className="text-sm text-muted-foreground">
                  Expanded Visibility affects distribution scope and prominence. It does not affect editorial inclusion, ranking methodology, or review outcomes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" onClick={handleProceedToSelection}>
            Select Visibility Options
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            onClick={() => navigate(`/profile/${token}/edit`)}
          >
            Back to My Profile
          </Button>
        </div>
      </div>
    </div>
  );
}