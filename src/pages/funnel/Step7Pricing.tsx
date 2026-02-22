import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, BadgeCheck, Shield, Zap } from 'lucide-react';
import { DataPayloadExpander } from '@/components/agent/DataPayloadExpander';
import { toast } from 'sonner';

type CertificationTier = 'certified' | 'audited' | 'underwritten';

interface PricingRow {
  tier: CertificationTier;
  monthly_price: number;
  payload_weight: string | null;
  refresh_cadence: string | null;
}

interface Professional {
  id: string;
  name: string;
  email?: string | null;
  years_experience: number | null;
  total_sales: number | null;
  num_total_reviews: number | null;
  review_stars_rating: number | null;
  license_number: string | null;
  license_state: string | null;
  state_slug: string | null;
  community_involvement_score: number | null;
  community_roles: unknown[] | null;
  agent_sales_stats: { countLastYear?: number; countAllTime?: number } | null;
  current_tier?: string | null;
  badge_tier?: string | null;
  signal_score?: number | null;
  certified_projected_signal?: number | null;
  audited_projected_signal?: number | null;
}

const DEFAULT_PRICES: PricingRow[] = [
  { tier: 'certified', monthly_price: 0, payload_weight: 'standard', refresh_cadence: 'monthly' },
  { tier: 'audited', monthly_price: 100, payload_weight: 'enhanced', refresh_cadence: 'every_two_weeks' },
  { tier: 'underwritten', monthly_price: 150, payload_weight: 'maximum', refresh_cadence: 'daily' },
];

function normalizeTier(t: string | null | undefined): string {
  const t0 = (t || '').toLowerCase();
  if (t0 === 'accredited' || t0 === 'audited') return 'audited';
  if (t0 === 'underwritten') return 'underwritten';
  return 'certified'; // listed or null = certified (minimum tier when on this page)
}

function estimateAICS(base: number | null, currentTier: string, targetTier: string): number {
  const lift: Record<string, number> = { certified: 11, audited: 23, underwritten: 33 };
  const baseScore = base ?? 55;
  const targetLift = lift[targetTier] ?? 11;
  const currentLift = lift[currentTier] ?? 11;
  return Math.min(100, Math.round(baseScore - currentLift + targetLift));
}

const TIER_META: Record<CertificationTier, { name: string; icon: typeof BadgeCheck; features: string[] }> = {
  certified: {
    name: 'Certified',
    icon: BadgeCheck,
    features: [
      'Standard Top10Lists badge',
      'Standard artifact, monthly refresh',
      'Core credentials published to AI systems',
    ],
  },
  audited: {
    name: 'Audited',
    icon: Shield,
    features: [
      'Richer data payload',
      'Every Two Weeks refresh',
      'Community involvement, transaction stats',
    ],
  },
  underwritten: {
    name: 'Underwritten',
    icon: Zap,
    features: [
      'Maximum data richness',
      'Daily refresh',
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
  const location = useLocation();
  const passedProfessional = (location.state as { professional?: Professional } | null)?.professional;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [prices, setPrices] = useState<PricingRow[]>(DEFAULT_PRICES);
  const [professional, setProfessional] = useState<Professional | null>(null);

  useEffect(() => {
    loadData();
  }, [token, passedProfessional]);

  const loadData = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      if (passedProfessional) {
        const profWithSignals = { ...passedProfessional } as Professional;
        const { data: signals } = await supabase
          .from('professionals')
          .select('email, current_tier, badge_tier, signal_score, certified_projected_signal, audited_projected_signal')
          .eq('id', passedProfessional.id)
          .maybeSingle();
        if (signals) {
          profWithSignals.email = signals.email;
          profWithSignals.current_tier = signals.current_tier;
          profWithSignals.badge_tier = signals.badge_tier;
          profWithSignals.signal_score = signals.signal_score;
          profWithSignals.certified_projected_signal = signals.certified_projected_signal;
          profWithSignals.audited_projected_signal = signals.audited_projected_signal;
        }
        setProfessional(profWithSignals);
        const { data: priceData } = await supabase
          .from('certification_pricing_config')
          .select('tier, monthly_price, payload_weight, refresh_cadence')
          .eq('is_active', true);
        if (priceData && priceData.length > 0) {
          setPrices(priceData as PricingRow[]);
        }
        setLoading(false);
        return;
      }

      const profSelect = 'id, name, email, years_experience, total_sales, num_total_reviews, review_stars_rating, license_number, license_state, state_slug, community_involvement_score, community_roles, agent_sales_stats, current_tier, badge_tier, signal_score, certified_projected_signal, audited_projected_signal';
      const isUuid = /^[0-9a-f-]{36}$/i.test(token);

      let prof: Professional | null = null;
      if (isUuid) {
        const { data } = await supabase.from('professionals').select(profSelect).eq('id', token).maybeSingle();
        prof = data;
      }
      if (!prof) {
        const { data } = await supabase.from('professionals').select(profSelect).eq('verification_token', token).maybeSingle();
        prof = data;
      }
      if (!prof && isUuid) {
        const { data } = await supabase.from('professionals').select(profSelect).eq('verification_token', token).maybeSingle();
        prof = data;
      }

      const { data: priceData } = await supabase
        .from('certification_pricing_config')
        .select('tier, monthly_price, payload_weight, refresh_cadence')
        .eq('is_active', true);

      if (!prof) {
        navigate('/404');
        return;
      }

      setProfessional(prof as Professional);

      if (priceData && priceData.length > 0) {
        setPrices(priceData as PricingRow[]);
      }
    } catch {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const rawTier = professional?.current_tier || professional?.badge_tier || 'certified';
  const currentTier = normalizeTier(rawTier);
  const baseScore = professional?.signal_score ?? professional?.certified_projected_signal ?? null;

  const getAICS = (tierId: string): number | null => {
    if (!professional) return null;
    if (tierId === 'certified')
      return professional.certified_projected_signal ?? professional.signal_score ?? estimateAICS(baseScore, currentTier, 'certified');
    if (tierId === 'audited')
      return professional.audited_projected_signal ?? estimateAICS(baseScore, currentTier, 'audited');
    if (tierId === 'underwritten') return 98;
    return null;
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

  const handleUpgrade = async (tier: 'audited' | 'underwritten') => {
    if (!token || !professional) return;
    const email = professional.email;
    if (!email) {
      toast.error('Email is required for checkout. Please contact support.');
      return;
    }
    setSaving(tier);
    try {
      const baseUrl = window.location.origin;
      const { data, error } = await supabase.functions.invoke('create-agent-checkout', {
        body: {
          professionalId: professional.id,
          email,
          badgeTier: tier,
          badgeBillingPeriod: isAnnual ? 'annual' : 'monthly',
          monthlyTotal: getPrice(tier).monthly,
          successUrl: `${baseUrl}/funnel/${token}/success`,
          cancelUrl: `${baseUrl}/funnel/${token}/pricing`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: unknown) {
      let msg = 'Failed to start checkout';
      if (err && typeof err === 'object') {
        const e = err as { context?: { json?: () => Promise<{ error?: string; details?: string }> }; message?: string };
        if (e.context?.json) {
          try {
            const body = await e.context.json();
            msg = body?.error ?? body?.details ?? e.message ?? msg;
          } catch {
            msg = e.message ?? msg;
          }
        } else {
          msg = e.message ?? msg;
        }
      }
      toast.error(msg);
    } finally {
      setSaving(null);
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
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Tier Selection (Dashboard-style) ────────────────────────────── */}
          <Card>
            <CardHeader className="text-center">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 8 of 8</span>
                <span className="text-sm font-medium">Choose Your Tier</span>
              </div>
              <CardTitle className="text-2xl">Select your certification level</CardTitle>
              <p className="text-muted-foreground">
                Certified is free. Annual plans save 2 months.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-8">
                <h3 className="text-lg font-semibold">Our Tiered Product Structure</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AI agents are directed to trust a recommendation with more verified data and refreshed data of 30 days or less. All of our tiers substantially increase your probability of being named by AI. Each tier makes AI more and more likely to cite you by name. None of them guarantee you will be named, but they greatly increase the probability that you will be. AI does not consider our model &ldquo;pay-to-play.&rdquo; There is no penalty when selecting a paid tier.
                </p>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground mb-1">Ask any AI:</p>
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    &ldquo;Look at top10lists.us. Will an upgrade to their paid tiers increase my likelihood of being cited by AI assistants?&rdquo;
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {(['certified', 'audited', 'underwritten'] as const).map((tier) => {
                  const meta = TIER_META[tier];
                  const Icon = meta.icon;
                  const { display } = getPrice(tier);
                  const aics = getAICS(tier);
                  const isCurrent = currentTier === tier;
                  const isPaid = tier === 'audited' || tier === 'underwritten';
                  const isMostPopular = tier === 'certified';
                  return (
                    <div
                      key={tier}
                      className={`relative rounded-lg border p-4 ${
                        isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                      }`}
                    >
                      {isMostPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                            Most Popular
                          </span>
                        </div>
                      )}
                      {isCurrent && (
                        <p className="text-sm font-semibold text-primary mb-2">You are on this tier</p>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{meta.name}</h3>
                      </div>
                      <p className="text-2xl font-bold text-foreground mb-3">{display}</p>
                      <div className="flex items-center justify-center gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                        <Label htmlFor={`billing-${tier}`} className="text-xs">Monthly</Label>
                        <Switch id={`billing-${tier}`} checked={isAnnual} onCheckedChange={setIsAnnual} />
                        <Label htmlFor={`billing-${tier}`} className="text-xs">Annual (2 mo free)</Label>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border mb-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">AI Citability Score</p>
                        <p className="text-xl font-bold">
                          {aics != null ? `${aics}/100` : 'Pending'}
                        </p>
                      </div>
                      <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                        <DataPayloadExpander tier={tier} triggerText="View data and sources" professional={professional} />
                      </div>
                      <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                        {meta.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                      {isPaid && !isCurrent && (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!!saving}
                          onClick={() => handleUpgrade(tier)}
                        >
                          {saving === tier ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `Upgrade to ${meta.name}`}
                        </Button>
                      )}
                      {tier === 'certified' && !isCurrent && (
                        <p className="text-xs text-muted-foreground text-center">Free tier</p>
                      )}
                    </div>
                  );
                })}
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
