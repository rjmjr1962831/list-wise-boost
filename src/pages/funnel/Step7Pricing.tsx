import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Zap, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { DataPayloadExpander } from '@/components/agent/DataPayloadExpander';
import { toast } from 'sonner';

type CertificationTier = 'audited' | 'underwritten';

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

interface AuditData {
  pillar_identity: number | null;
  pillar_authority: number | null;
  pillar_social: number | null;
  pillar_technical: number | null;
  pillar_citability: number | null;
  score_current: number | null;
  score_audited: number | null;
  score_underwritten: number | null;
  gap_stale_reviews: boolean | null;
  gap_no_linkedin: boolean | null;
  gap_no_schema: boolean | null;
  gap_no_realtor: boolean | null;
  gap_no_homelight: boolean | null;
  gap_no_press: boolean | null;
  gap_no_personal_site: boolean | null;
  exa_source_count: number | null;
}

const DEFAULT_PRICES: PricingRow[] = [
  { tier: 'audited', monthly_price: 300, payload_weight: 'enhanced', refresh_cadence: 'every_two_weeks' },
  { tier: 'underwritten', monthly_price: 500, payload_weight: 'maximum', refresh_cadence: 'daily' },
];

function normalizeTier(t: string | null | undefined): string {
  const t0 = (t || '').toLowerCase();
  if (t0 === 'accredited' || t0 === 'audited') return 'audited';
  if (t0 === 'underwritten') return 'underwritten';
  return 'listed';
}

function bandLabel(score: number): string {
  if (score <= 30) return 'Invisible to AI';
  if (score <= 50) return 'Discoverable, not citable';
  if (score <= 70) return 'Citable in general queries';
  if (score <= 85) return 'Citable in specific local queries';
  return 'Authoritative citation candidate';
}

function bandColor(score: number): string {
  if (score <= 30) return 'text-red-500';
  if (score <= 50) return 'text-orange-500';
  if (score <= 70) return 'text-yellow-600';
  if (score <= 85) return 'text-blue-500';
  return 'text-green-500';
}

// Annual = 2 months free (10 months price for 12 months)
function annualPrice(monthly: number): number {
  return monthly * 10;
}

const PILLAR_META: { key: keyof AuditData; label: string; max: number; description: string }[] = [
  { key: 'pillar_identity', label: 'Identity', max: 20, description: 'License, company, personal site, LinkedIn' },
  { key: 'pillar_authority', label: 'Authority', max: 28, description: 'Experience, sales volume, description depth' },
  { key: 'pillar_social', label: 'Social', max: 30, description: 'Review volume, quality, recency' },
  { key: 'pillar_technical', label: 'Tech', max: 13, description: 'Website, schema markup, platform presence' },
  { key: 'pillar_citability', label: 'Citability', max: 10, description: 'Third-party sources, press mentions' },
];

const TIER_FEATURES: Record<CertificationTier, { name: string; icon: typeof Shield; evidenceSources: string; refreshFrequency: string; features: string[] }> = {
  audited: {
    name: 'Audited',
    icon: Shield,
    evidenceSources: '10+ sources',
    refreshFrequency: 'Monthly',
    features: [
      'Community involvement (IRS 990 verified)',
      'Transaction stats and history',
      'Specialties published to AI',
      'Richer artifact payload',
    ],
  },
  underwritten: {
    name: 'Underwritten',
    icon: Zap,
    evidenceSources: 'Up to 20 sources',
    refreshFrequency: 'Daily',
    features: [
      'Everything in Audited',
      'Full neighborhood endorsement',
      'Press mentions and awards',
      'Certifications and designations',
      'Maximum artifact depth',
    ],
  },
};

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
  const [audit, setAudit] = useState<AuditData | null>(null);

  useEffect(() => {
    loadData();
  }, [token, passedProfessional]);

  const loadData = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      let prof: Professional | null = null;

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
        prof = profWithSignals;
      } else {
        const profSelect = 'id, name, email, years_experience, total_sales, num_total_reviews, review_stars_rating, license_number, license_state, state_slug, community_involvement_score, community_roles, agent_sales_stats, current_tier, badge_tier, signal_score, certified_projected_signal, audited_projected_signal';
        const isUuid = /^[0-9a-f-]{36}$/i.test(token);

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
      }

      if (!prof) {
        navigate('/404');
        return;
      }

      setProfessional(prof as Professional);

      // Fetch pillar-level audit data
      const { data: auditData } = await supabase
        .from('geo_audit_results')
        .select('pillar_identity, pillar_authority, pillar_social, pillar_technical, pillar_citability, score_current, score_audited, score_underwritten, gap_stale_reviews, gap_no_linkedin, gap_no_schema, gap_no_realtor, gap_no_homelight, gap_no_press, gap_no_personal_site, exa_source_count')
        .eq('agent_id', prof.id)
        .maybeSingle();
      if (auditData) setAudit(auditData as AuditData);

      // Fetch pricing config
      const { data: priceData } = await supabase
        .from('certification_pricing_config')
        .select('tier, monthly_price, payload_weight, refresh_cadence')
        .eq('is_active', true);

      if (priceData && priceData.length > 0) {
        const filtered = (priceData as PricingRow[]).filter((p) => p.tier === 'audited' || p.tier === 'underwritten');
        setPrices(filtered.length > 0 ? filtered : DEFAULT_PRICES);
      } else {
        setPrices(DEFAULT_PRICES);
      }
    } catch {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const rawTier = professional?.current_tier || professional?.badge_tier || 'listed';
  const currentTier = normalizeTier(rawTier);
  const currentScore = audit?.score_current ?? professional?.signal_score ?? professional?.certified_projected_signal ?? null;

  const getAICS = (tierId: string): number | null => {
    if (!professional) return null;
    if (tierId === 'audited') return audit?.score_audited ?? professional.audited_projected_signal ?? 65;
    if (tierId === 'underwritten') return audit?.score_underwritten ?? 95;
    return currentScore;
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
          successUrl: `${baseUrl}/funnel/${token}/payment-success`,
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

  // Compute gaps as actionable items
  const gaps: string[] = [];
  if (audit) {
    if (audit.gap_stale_reviews) gaps.push('Review recency is low');
    if (audit.gap_no_personal_site) gaps.push('No personal website found');
    if (audit.gap_no_linkedin) gaps.push('No LinkedIn profile found');
    if (audit.gap_no_press) gaps.push('No press mentions found');
    if (audit.gap_no_schema) gaps.push('No schema markup on website');
  }

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
        <div className="max-w-6xl mx-auto space-y-6">

          {/* ── What You've Already Earned ──────────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 8 of 8</span>
                <span className="text-sm font-medium">Choose Your Tier</span>
              </div>
              <CardTitle className="text-2xl">What you&rsquo;ve already earned</CardTitle>
              <p className="text-sm text-muted-foreground">
                You passed our entire selection pipeline. This is free and always will be.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pipeline checkmarks */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Gate 1: 4.5+ star rating</p>
                      <p className="text-xs text-muted-foreground">Cross-platform verified</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Gate 2: 10+ verified reviews (24 months)</p>
                      <p className="text-xs text-muted-foreground">Recency-weighted</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Gate 3: 5+ years in business</p>
                      <p className="text-xs text-muted-foreground">License verified against state DRE</p>
                    </div>
                  </div>
                  <div className="border-l-2 border-green-500/30 ml-2.5 pl-5 space-y-3 mt-1">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <p className="text-sm text-muted-foreground">Deep research across 1,000+ sources</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <p className="text-sm text-muted-foreground">Community Involvement Score calculated</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <p className="text-sm text-muted-foreground">Human editorial review approved</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 pl-1">
                    No payment was required for any of this &mdash; and never will be for your listing.
                  </p>
                </div>

                {/* Current AICS + pillar breakdown */}
                <div>
                  {currentScore != null && (
                    <div className="rounded-lg border bg-muted/30 p-4 mb-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your Current AI Confidence Score</p>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-3xl font-bold ${bandColor(currentScore)}`}>{currentScore}</p>
                        <p className="text-sm text-muted-foreground">/ 95</p>
                      </div>
                      <p className={`text-sm font-medium mt-1 ${bandColor(currentScore)}`}>
                        {bandLabel(currentScore)}
                      </p>
                    </div>
                  )}

                  {audit && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pillar Breakdown</p>
                      {PILLAR_META.map(({ key, label, max, description }) => {
                        const val = (audit[key] as number | null) ?? 0;
                        const pct = Math.round((val / max) * 100);
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="font-medium">{label}</span>
                              <span className="text-muted-foreground">{val}/{max}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {gaps.length > 0 && (
                    <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30 p-3">
                      <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        What AI systems can&rsquo;t verify about you yet
                      </p>
                      <ul className="text-xs text-orange-600 dark:text-orange-400/80 space-y-1">
                        {gaps.map((g, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="mt-0.5">&bull;</span>
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Amplify Your Visibility ──────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Amplify what you&rsquo;ve earned</CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Paid tiers don&rsquo;t buy your spot &mdash; you already have it. They publish more of your verified data to AI systems and refresh it more frequently. More published evidence means more for AI to work with when it decides whether to cite you by name. We can&rsquo;t guarantee any AI will name you. Nobody can. What we can control is how much verified, citable data about you is available when AI makes that decision.
              </p>
            </CardHeader>
            <CardContent>
              {/* How it works */}
              <div className="rounded-lg border bg-muted/30 p-4 mb-6">
                <p className="text-sm font-medium mb-3">How AI decides who to cite</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  AI systems prefer sources with more evidence, fresher data, and independent verification. Each tier increases all three. The AICS measures what AI can verify about you &mdash; the inputs, not a guaranteed outcome. The published formula is on our{' '}
                  <a href="/about/ranking-methodology" className="underline">methodology page</a>.
                </p>
              </div>

              {/* AICS band reference */}
              <div className="rounded-lg border p-4 mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">AICS Score Bands</p>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                  {[
                    { range: '0-30', label: 'Invisible', color: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400', tier: '' },
                    { range: '31-50', label: 'Discoverable', color: 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400', tier: 'Listed' },
                    { range: '51-70', label: 'Citable (general)', color: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400', tier: 'Audited' },
                    { range: '71-85', label: 'Citable (local)', color: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400', tier: '' },
                    { range: '86-95', label: 'Authoritative', color: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400', tier: 'Underwritten' },
                  ].map((b) => (
                    <div key={b.range} className={`rounded-md p-2 text-center ${b.color}`}>
                      <p className="font-bold">{b.range}</p>
                      <p className="font-medium">{b.label}</p>
                      {b.tier && <p className="text-[10px] mt-0.5 opacity-70">{b.tier} tier</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <Label htmlFor="billing-toggle" className="text-sm">Monthly</Label>
                <Switch id="billing-toggle" checked={isAnnual} onCheckedChange={setIsAnnual} />
                <Label htmlFor="billing-toggle" className="text-sm">Annual <span className="text-primary font-medium">(2 months free)</span></Label>
              </div>

              {/* Tier cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['audited', 'underwritten'] as const).map((tier) => {
                  const meta = TIER_FEATURES[tier];
                  const Icon = meta.icon;
                  const { display } = getPrice(tier);
                  const aics = getAICS(tier);
                  const isCurrent = currentTier === tier;
                  const isMostPopular = tier === 'audited';
                  const lift = aics != null && currentScore != null ? aics - currentScore : null;
                  return (
                    <div
                      key={tier}
                      className={`relative rounded-lg border p-5 ${
                        isMostPopular ? 'pt-7' : ''
                      } ${isCurrent ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
                    >
                      <img
                        src={`/badges/${tier}.png`}
                        alt={`Top10Lists ${meta.name} badge`}
                        className="absolute top-3 right-3 h-12 w-auto object-contain"
                      />
                      {isMostPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                            Most Popular
                          </span>
                        </div>
                      )}
                      {isCurrent && (
                        <p className="text-sm font-semibold text-primary mb-2">Your current tier</p>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">{meta.name}</h3>
                      </div>
                      <p className="text-2xl font-bold text-foreground mb-1">{display}</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        {meta.evidenceSources} &middot; {meta.refreshFrequency} refresh
                      </p>

                      {/* AICS projection */}
                      <div className="p-3 rounded-lg bg-muted/50 border mb-4">
                        <div className="flex items-baseline justify-between">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected AICS</p>
                          {lift != null && lift > 0 && (
                            <span className="text-xs font-medium text-green-600">+{lift} from current</span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <p className={`text-2xl font-bold ${aics != null ? bandColor(aics) : ''}`}>
                            {aics != null ? aics : 'Pending'}
                          </p>
                          {aics != null && <p className="text-sm text-muted-foreground">/ 95</p>}
                        </div>
                        {aics != null && (
                          <p className={`text-xs font-medium mt-0.5 ${bandColor(aics)}`}>{bandLabel(aics)}</p>
                        )}
                      </div>

                      {/* What this tier publishes */}
                      <p className="text-xs font-medium text-foreground mb-2">What AI systems see at this tier:</p>
                      <ul className="text-sm text-muted-foreground space-y-1.5 mb-4">
                        {meta.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>

                      <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                        <DataPayloadExpander tier={tier} triggerText="View full data and sources" professional={professional} />
                      </div>

                      {!isCurrent && (
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!!saving}
                          onClick={() => handleUpgrade(tier)}
                        >
                          {saving === tier ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `Upgrade to ${meta.name}`}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Transparency + ask any AI + verify independently */}
              <div className="mt-8 space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground mb-2">Don&rsquo;t take our word for it</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Ask any AI assistant right now:
                      </p>
                      <p className="text-sm italic text-muted-foreground mt-1 pl-3 border-l-2 border-primary/30">
                        &ldquo;Who are the top real estate agents in [your city]?&rdquo; &mdash; then ask: &ldquo;Why did you recommend those agents and not others?&rdquo;
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Verify your AI visibility independently:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <a href="https://ai-visibility-index.semrush.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Semrush AI Visibility <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Transparency:</strong> AICS is calculated identically whether you&rsquo;re on the free tier or a paid tier. The score measures what AI systems can verify about you. Paid tiers publish more of your verified data &mdash; which gives AI systems more to cite. The score reflects the result, not the payment. The full formula is published on our <a href="/about/ranking-methodology" className="underline">methodology page</a>.
                  </p>
                </div>
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
