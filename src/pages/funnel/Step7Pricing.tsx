import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Check, List, BadgeCheck, Shield, Zap } from 'lucide-react';
import { toast } from 'sonner';

type CertificationTier = 'listed' | 'certified' | 'audited' | 'underwritten';

interface PricingRow {
  tier: CertificationTier;
  monthly_price: number;
  payload_weight: string | null;
  refresh_cadence: string | null;
}

const DEFAULT_PRICES: PricingRow[] = [
  { tier: 'listed', monthly_price: 0, payload_weight: 'basic', refresh_cadence: 'public_data_only' },
  { tier: 'certified', monthly_price: 0, payload_weight: 'standard', refresh_cadence: 'annual' },
  { tier: 'audited', monthly_price: 50, payload_weight: 'enhanced', refresh_cadence: 'monthly' },
  { tier: 'underwritten', monthly_price: 150, payload_weight: 'maximum', refresh_cadence: 'real_time' },
];

const TIER_META: Record<CertificationTier, { name: string; icon: typeof List; features: string[]; popular?: boolean }> = {
  listed: {
    name: 'Listed',
    icon: List,
    features: [
      'Basic profile (name, city, rating)',
      'No badge issued',
      'Public data only',
    ],
  },
  certified: {
    name: 'Certified',
    icon: BadgeCheck,
    features: [
      'Standard Top10Lists badge',
      'Agent-verified profile',
      'Annual review',
    ],
    popular: true,
  },
  audited: {
    name: 'Audited',
    icon: Shield,
    features: [
      'Enhanced AI payload',
      'Monthly diligence updates',
      'Transaction volume stats',
    ],
  },
  underwritten: {
    name: 'Underwritten',
    icon: Zap,
    features: [
      'Maximum AI citation payload',
      'Real-time data refresh',
      'Full neighborhood endorsement',
    ],
  },
};

// Annual = 2 months free (10 months price for 12 months)
function annualPrice(monthly: number): number {
  return monthly * 10;
}

export default function Step7Pricing() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<{ id: string; name: string } | null>(null);
  const [selectedTier, setSelectedTier] = useState<CertificationTier>('certified');
  const [listedAction, setListedAction] = useState<'stay_listed' | 'delete_listing'>('stay_listed');
  const [isAnnual, setIsAnnual] = useState(true);
  const [prices, setPrices] = useState<PricingRow[]>(DEFAULT_PRICES);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      const [profRes, priceRes] = await Promise.all([
        supabase.from('professionals').select('id, name').eq('verification_token', token).maybeSingle(),
        supabase.from('certification_pricing_config').select('tier, monthly_price, payload_weight, refresh_cadence').eq('is_active', true),
      ]);

      let prof = profRes.data;
      if (!prof && /^[0-9a-f-]{36}$/i.test(token)) {
        const { data: byId } = await supabase.from('professionals').select('id, name').eq('id', token).maybeSingle();
        prof = byId ?? undefined;
      }
      if (profRes.error || !prof) {
        navigate('/404');
        return;
      }
      setProfessional(prof);

      if (priceRes.data && priceRes.data.length > 0) {
        setPrices(priceRes.data as PricingRow[]);
      }
    } catch {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (tier: CertificationTier) => {
    const row = prices.find((p) => p.tier === tier);
    const monthly = row?.monthly_price ?? 0;
    if (monthly === 0) return { monthly: 0, annual: 0, display: 'Free' };
    const annual = annualPrice(monthly);
    return {
      monthly,
      annual,
      display: isAnnual ? `$${annual}/year` : `$${monthly}/mo`,
    };
  };

  const handleSubmit = async () => {
    if (!token) return;

    setSaving(true);
    try {
      const isFree = selectedTier === 'listed' || selectedTier === 'certified';

      if (isFree) {
        const { data: tierData, error: tierError } = await supabase.functions.invoke('funnel-select-tier', {
          body: {
            token,
            tier: selectedTier,
            ...(selectedTier === 'listed' && { listedAction }),
          },
        });

        if (tierError) throw tierError;
        if (tierData?.error) throw new Error(tierData.error);

        if (selectedTier === 'listed' && listedAction === 'delete_listing') {
          toast.success('Your listing removal request has been recorded.');
          navigate(`/funnel/${token}/success`);
          return;
        }
        if (selectedTier === 'listed') {
          toast.success('Saved.');
          navigate(`/funnel/${token}/success`);
          return;
        }
        if (selectedTier === 'certified' && professional) {
          const { data: certData, error: certError } = await supabase.functions.invoke('generate-certification', {
            body: {
              professional_id: professional.id,
              tier: 'certified',
              markets_covered: [],
              neighborhoods_covered: [],
              trigger: 'funnel_completion',
            },
          });
          if (certError) throw certError;
          if (certData?.error) throw new Error(certData.error);
          toast.success('Certified! Badge issued.');
          navigate(`/funnel/${token}/success`, { state: { certification: certData, tier: 'certified' } });
          return;
        }
        toast.success('Certified! Badge issued.');
        navigate(`/funnel/${token}/success`);
        return;
      }

      // Paid tiers: stub for Stripe checkout (to be refined)
      toast.info('Checkout flow coming soon. Stripe integration will be refined.');
      navigate(`/funnel/${token}/success`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Choose Your Certification Tier | Top10Lists.us</title>
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 6 of 7</span>
                <span className="text-sm font-medium">Choose Your Tier</span>
              </div>
              <CardTitle className="text-2xl">Select your certification level</CardTitle>
              <p className="text-muted-foreground">
                Listed and Certified are free. Annual plans save 2 months.
              </p>

              <div className="flex items-center justify-center gap-4 mt-4">
                <Label htmlFor="billing-toggle" className="text-sm">Monthly</Label>
                <Switch id="billing-toggle" checked={isAnnual} onCheckedChange={setIsAnnual} />
                <Label htmlFor="billing-toggle" className="text-sm">Annual (2 months free)</Label>
              </div>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedTier} onValueChange={(v) => setSelectedTier(v as CertificationTier)}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {(['listed', 'certified', 'audited', 'underwritten'] as const).map((tier) => {
                    const meta = TIER_META[tier];
                    const Icon = meta.icon;
                    const { display } = getPrice(tier);
                    return (
                      <div
                        key={tier}
                        className={`relative border-2 rounded-lg p-5 cursor-pointer transition-all ${
                          selectedTier === tier ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedTier(tier)}
                      >
                        {meta.popular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <span className="bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-0.5 rounded-full">
                              Most Popular
                            </span>
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">{meta.name}</h3>
                          </div>
                          <RadioGroupItem value={tier} id={tier} />
                        </div>
                        <p className="text-2xl font-bold mb-3">{display}</p>
                        {tier === 'listed' && (
                          <p className="text-xs text-muted-foreground mb-2">No badge issued.</p>
                        )}
                        <ul className="space-y-2">
                          {meta.features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                        {tier === 'listed' && selectedTier === 'listed' && (
                          <div className="mt-4 flex gap-2">
                            <Button
                              type="button"
                              variant={listedAction === 'stay_listed' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setListedAction('stay_listed');
                              }}
                            >
                              Stay Listed
                            </Button>
                            <Button
                              type="button"
                              variant={listedAction === 'delete_listing' ? 'destructive' : 'outline'}
                              size="sm"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setListedAction('delete_listing');
                              }}
                            >
                              Delete Listing
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>

              <div className="mt-8 flex justify-center">
                <Button onClick={handleSubmit} size="lg" className="gap-2" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {selectedTier === 'listed' && listedAction === 'delete_listing'
                    ? 'Remove Listing'
                    : selectedTier === 'listed'
                    ? 'Stay Listed'
                    : selectedTier === 'certified'
                    ? 'Claim Free Badge'
                    : 'Proceed to Checkout'}
                </Button>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Questions? <a href="tel:6027589600" className="underline">(602) 758-9600</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
