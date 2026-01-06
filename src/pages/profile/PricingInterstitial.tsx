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

        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Expand Your Visibility Across More Cities
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Optional visibility tools for professionals already included editorially on Top10Lists.us
          </p>
        </div>

        {/* Hero Supporting Copy */}
        <Card className="mb-10 border-primary/20 bg-primary/5">
          <CardContent className="p-6 text-center">
            <p className="text-foreground">
              Extend where and how your profile appears when buyers use AI tools to search for top agents.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Editorial inclusion and ranking eligibility are merit-based and free. Paid options expand visibility and distribution only.
            </p>
          </CardContent>
        </Card>

        {/* Educational Anchor: How This Works */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">How This Works</h2>
          <Card className="border-border">
            <CardContent className="p-6">
              <p className="text-muted-foreground mb-4">
                Think of it like search engine visibility:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <Search className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Editorial Inclusion</p>
                    <p className="text-sm text-muted-foreground">Like organic search results — earned through merit</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30">
                  <ArrowRight className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Expanded Visibility</p>
                    <p className="text-sm text-muted-foreground">Like advertising — extends reach and distribution</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border/50">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Payment does not change editorial criteria or ranking methodology.
                  </p>
                </div>
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
                    <span>Editorial profile in your primary city</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>Verified license display</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>AI search indexing</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>Basic contact information</span>
                  </li>
                </ul>
                <div className="mt-6 pt-4 border-t">
                  <p className="text-2xl font-bold text-foreground">$0</p>
                  <p className="text-xs text-muted-foreground">Forever free</p>
                </div>
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
                      <p className="text-xs text-muted-foreground">Optional add-on</p>
                    </div>
                  </div>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>Everything in Free Listing</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium">Coverage in additional cities</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium">Enhanced profile distribution</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="font-medium">Multi-market presence</span>
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
              <h2 className="text-xl font-semibold text-foreground">City Coverage Options</h2>
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

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => {
              const tierConfig = PRICING_TIERS.find(t => t.name === tier.tier_name);
              if (!tierConfig) return null;

              const price = isAnnual ? tier.price_annual / 12 : tier.price_monthly;

              return (
                <Card
                  key={tier.tier_name}
                  className={`p-5 ${tierConfig.bgColor} ${tierConfig.borderColor} border hover:shadow-md transition-shadow cursor-pointer`}
                  onClick={handleProceedToSelection}
                >
                  <div className="mb-4">
                    <Badge className={`${tierConfig.badgeColor} mb-2`}>
                      {tier.tier_name}
                    </Badge>
                    <h3 className="text-xl font-bold text-foreground">
                      ${Math.round(price)}
                      <span className="text-sm text-muted-foreground font-normal">/mo</span>
                    </h3>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className={`h-4 w-4 ${tierConfig.color}`} />
                      <span className="font-medium">
                        Covers {tier.city_count} {tier.city_count === 1 ? 'city' : 'cities'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Including: {tier.sample_cities.join(', ')}
                      {tier.city_count > 3 && ` +${tier.city_count - 3} more`}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Limited editorial capacity per city
                  </p>
                </Card>
              );
            })}
          </div>

          <div className="mt-4 text-center">
            <Button onClick={handleProceedToSelection} size="lg">
              Select Visibility Options
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 3-Month Explanation */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">Why 3 Months?</h2>
          <Card className="border-border">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-6">
                AI models require time to discover, verify, and incorporate your profile information. The 3-month period allows for complete integration into AI systems.
              </p>
              
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-5 w-5 text-primary" />
                    <span className="font-medium">Month 1: Indexing</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI systems discover and index your expanded profile information.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-accent/5 border border-accent/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-5 w-5 text-accent" />
                    <span className="font-medium">Month 2: Verification</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Systems verify and cross-reference your credentials and information.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span className="font-medium">Month 3: Citation</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your profile becomes eligible for citation in AI-generated responses.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Billing:</strong> You're charged monthly—not upfront. After your 3-month commitment, you can cancel anytime or continue month-to-month.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trust Statement */}
        <Card className="mb-10 border-border bg-muted/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Shield className="h-6 w-6 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Editorial Integrity</h3>
                <p className="text-sm text-muted-foreground">
                  Expanded Visibility affects distribution and prominence only. It does not affect editorial inclusion criteria or ranking methodology. All professionals on Top10Lists.us meet our merit-based standards.
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
