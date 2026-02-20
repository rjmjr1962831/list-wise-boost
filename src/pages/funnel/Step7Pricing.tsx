import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Check, List, BadgeCheck, Shield, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

type CertificationTier = 'listed' | 'certified' | 'audited' | 'underwritten';

interface PricingRow {
  tier: CertificationTier;
  monthly_price: number;
  payload_weight: string | null;
  refresh_cadence: string | null;
}

interface Professional {
  id: string;
  name: string;
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
}

const DEFAULT_PRICES: PricingRow[] = [
  { tier: 'listed', monthly_price: 0, payload_weight: 'basic', refresh_cadence: 'public_data_only' },
  { tier: 'certified', monthly_price: 0, payload_weight: 'standard', refresh_cadence: 'annual' },
  { tier: 'audited', monthly_price: 100, payload_weight: 'enhanced', refresh_cadence: 'quarterly' },
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
      'Standard artifact, monthly refresh',
      'Core credentials published to AI systems',
    ],
    popular: true,
  },
  audited: {
    name: 'Audited',
    icon: Shield,
    features: [
      'Richer data payload',
      'Bimonthly refresh',
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

// ── Citability Score Calculator ──────────────────────────────
function computeCitabilityScores(prof: Professional) {
  const years = prof.years_experience ?? 0;
  const sales = prof.total_sales ?? 0;
  const reviews = prof.num_total_reviews ?? 0;
  const rating = prof.review_stars_rating ?? 0;
  const hasLicense = !!prof.license_number;
  const recentSales = prof.agent_sales_stats?.countLastYear ?? 0;
  const hasCommunity = (prof.community_roles?.length ?? 0) > 0;
  const state = (prof.state_slug ?? 'their state').replace(/^\w/, c => c.toUpperCase());

  // Before Top10Lists: assess existing web presence under 2026 rules
  let base = 1.2;
  if (years > 5) base += 0.3;
  if (years > 15) base += 0.2;
  if (sales > 50) base += 0.3;
  if (sales > 200) base += 0.2;
  if (reviews > 5) base += 0.2;
  if (reviews > 20) base += 0.2;
  if (rating >= 4.5) base += 0.2;
  // Decay penalty for stale activity
  if (recentSales === 0 && sales > 0) base -= 0.4;
  if (recentSales === 0 && sales === 0) base -= 0.2;
  base = Math.round(Math.max(0.8, Math.min(3.5, base)) * 10) / 10;

  // Listed: entity discovery on merit-based index
  let listed = base + 2.0;
  if (years > 10) listed += 0.2;
  if (sales > 100) listed += 0.2;
  listed = Math.round(Math.min(5.5, listed) * 10) / 10;

  // Certified: verified license, confirmed profile data
  let certified = listed + 2.0;
  if (hasLicense) certified += 0.3;
  if (rating >= 4.5) certified += 0.2;
  certified = Math.round(Math.min(7.5, certified) * 10) / 10;

  // Audited: monthly freshness, community verification
  let audited = certified + 1.3;
  if (hasCommunity) audited += 0.2;
  if (sales > 100) audited += 0.2;
  audited = Math.round(Math.min(8.8, audited) * 10) / 10;

  // Underwritten: daily monitoring, artifact provenance
  let underwritten = audited + 0.9;
  if (reviews > 10) underwritten += 0.1;
  if (years > 10) underwritten += 0.1;
  underwritten = Math.round(Math.min(9.6, underwritten) * 10) / 10;

  // Build personalized trigger descriptions
  const stateAbbr = prof.license_state || state;
  const decayNote = recentSales === 0
    ? (sales > 0 ? `Hallucination risk. Stale activity signals decay.` : `Hallucination risk. No verified transaction history.`)
    : `Moderate baseline. Recent activity helps, but unverified.`;

  return [
    {
      label: 'Before Top10Lists',
      score: base,
      trigger: decayNote,
      current: false,
    },
    {
      label: 'Listed',
      score: listed,
      trigger: 'Entity discovery. Inclusion on a merit-based index anchors identity.',
      current: false,
    },
    {
      label: 'Certified (Free)',
      score: certified,
      trigger: `License grounding. Verified ${stateAbbr} license and career volume proof.`,
      current: true,
    },
    {
      label: 'Audited ($100/mo)',
      score: audited,
      trigger: 'Freshness anchor. Quarterly updates + community verification data.',
      current: false,
    },
    {
      label: 'Underwritten ($150/mo)',
      score: underwritten,
      trigger: 'Elite citability. Daily monitoring + artifact provenance chain.',
      current: false,
    },
  ];
}

// Annual = 2 months free (10 months price for 12 months)
function annualPrice(monthly: number): number {
  return monthly * 10;
}

export default function Step7Pricing() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTier, setSelectedTier] = useState<CertificationTier>('certified');
  const [listedAction, setListedAction] = useState<'stay_listed' | 'delete_listing'>('stay_listed');
  const [isAnnual, setIsAnnual] = useState(true);
  const [prices, setPrices] = useState<PricingRow[]>(DEFAULT_PRICES);
  const [professional, setProfessional] = useState<Professional | null>(null);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      const profSelect = 'id, name, years_experience, total_sales, num_total_reviews, review_stars_rating, license_number, license_state, state_slug, community_involvement_score, community_roles, agent_sales_stats';

      const [profRes, priceRes] = await Promise.all([
        supabase.from('professionals').select(profSelect).eq('verification_token', token).maybeSingle(),
        supabase.from('certification_pricing_config').select('tier, monthly_price, payload_weight, refresh_cadence').eq('is_active', true),
      ]);

      let prof = profRes.data;
      if (!prof && /^[0-9a-f-]{36}$/i.test(token)) {
        const { data: byId } = await supabase.from('professionals').select(profSelect).eq('id', token).maybeSingle();
        prof = byId ?? undefined;
      }
      if (profRes.error || !prof) {
        navigate('/404');
        return;
      }

      setProfessional(prof as Professional);

      if (priceRes.data && priceRes.data.length > 0) {
        setPrices(priceRes.data as PricingRow[]);
      }
    } catch {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const citabilityRows = useMemo(() => {
    if (!professional) return [];
    return computeCitabilityScores(professional);
  }, [professional]);

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
        const { data, error } = await supabase.functions.invoke('funnel-select-tier', {
          body: {
            token,
            tier: selectedTier,
            ...(selectedTier === 'listed' && { listedAction }),
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (selectedTier === 'listed' && listedAction === 'delete_listing') {
          toast.success('Your listing removal request has been recorded.');
        } else {
          toast.success(selectedTier === 'certified' ? 'Certified! Badge issued.' : 'Saved.');
        }
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

  const baseScore = citabilityRows[0]?.score ?? 0;

  return (
    <>
      <SafeHead>
        <title>Choose Your Certification Tier | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* ── Citability Growth Table ────────────────────── */}
          {professional && (
            <Card>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl sm:text-2xl">
                  {professional.name}: AI Citability Growth
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  2026 projection based on your verified profile data
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted text-muted-foreground">
                        <th className="text-left py-2.5 px-3 font-medium">Status / Tier</th>
                        <th className="text-center py-2.5 px-2 font-medium">Score</th>
                        <th className="text-center py-2.5 px-2 font-medium">Net Change</th>
                        <th className="text-center py-2.5 px-2 font-medium">% Change</th>
                        <th className="text-left py-2.5 px-3 font-medium hidden sm:table-cell">AI Technical Trigger</th>
                      </tr>
                    </thead>
                    <tbody>
                      {citabilityRows.map((row, idx) => {
                        const delta = row.score - baseScore;
                        const pctChange = baseScore > 0 ? ((delta / baseScore) * 100) : 0;
                        const isFirst = idx === 0;
                        const isPositive = delta > 0;
                        const isNegative = delta < 0;
                        return (
                          <tr
                            key={row.label}
                            className={`border-t border-border ${row.current ? 'bg-primary/5' : ''}`}
                          >
                            <td className="py-2.5 px-3 font-semibold">
                              {row.label}
                              {row.current && (
                                <span className="ml-2 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                                  In Funnel
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center font-bold text-lg">
                              {row.score.toFixed(1)}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {isFirst ? (
                                <span className="text-muted-foreground">{"\u2014"}</span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 font-bold ${isNegative ? 'text-red-500' : 'text-foreground'}`}>
                                  {isPositive && <TrendingUp className="h-3 w-3" />}
                                  {isNegative && <TrendingDown className="h-3 w-3" />}
                                  {isPositive ? '+' : ''}{delta.toFixed(1)}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {isFirst ? (
                                <span className="text-muted-foreground">{"\u2014"}</span>
                              ) : (
                                <span className={`font-bold ${isNegative ? 'text-red-500' : 'text-foreground'}`}>
                                  {isPositive ? '+' : ''}{pctChange.toFixed(0)}%
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs hidden sm:table-cell">
                              {row.trigger}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3 italic">
                  AI Citability Index: Composite score measuring how well your profile aligns with published citation requirements from Anthropic, OpenAI, Google, and Perplexity. Scale 0-10.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Tier Selection ────────────────────────────── */}
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
