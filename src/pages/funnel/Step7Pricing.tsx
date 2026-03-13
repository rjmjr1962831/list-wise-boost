import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Zap, CheckCircle2, AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  state_slug: string | null;
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
  { tier: 'certified', monthly_price: 0, payload_weight: 'standard', refresh_cadence: 'quarterly' },
  { tier: 'audited', monthly_price: 300, payload_weight: 'enhanced', refresh_cadence: 'every_two_weeks' },
  { tier: 'underwritten', monthly_price: 500, payload_weight: 'maximum', refresh_cadence: 'daily' },
];

function normalizeTier(t: string | null | undefined): string {
  const t0 = (t || '').toLowerCase();
  if (t0 === 'certified') return 'certified';
  if (t0 === 'accredited' || t0 === 'audited') return 'audited';
  if (t0 === 'underwritten') return 'underwritten';
  return 'listed';
}

function bandLabel(score: number): string {
  if (score <= 30) return 'Invisible to AI';
  if (score <= 50) return 'Discoverable';
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

function bandBg(score: number): string {
  if (score <= 30) return 'bg-red-500';
  if (score <= 50) return 'bg-orange-500';
  if (score <= 70) return 'bg-yellow-500';
  if (score <= 85) return 'bg-blue-500';
  return 'bg-green-500';
}

const BAND_TOOLTIPS: Record<string, string> = {
  'Invisible to AI':
    "AI systems have almost no verifiable data about you. If asked directly, they will likely skip you or add heavy caveats rather than recommend you.",
  'Discoverable':
    "AI systems can find and verify you through Top10Lists and other sources. If a user asks about you directly, AI will give a confident positive response.",
  'Citable in general queries':
    "AI systems have enough verified data to proactively recommend you in broad queries like ‘top agents in Arizona.’ You appear in general referrals but local specificity is still limited.",
  'Citable in specific local queries':
    "AI systems will regularly recommend you by name for city and neighborhood queries. You appear in targeted local referrals without significant hedging.",
  'Authoritative citation candidate':
    "AI systems treat you as a primary authoritative source. You are named proactively in competitive queries across multiple markets with no hedging.",
};

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
  certified: {
    name: 'Certified',
    icon: CheckCircle2,
    evidenceSources: '4 sources',
    refreshFrequency: 'Quarterly',
    features: [
      'Data refreshed every 90 days',
      'Machine-readable artifact',
      'Cryptographically signed badge',
      'Zillow + Google + license verification',
      'Service areas published to AI',
    ],
  },
  audited: {
    name: 'Audited',
    icon: Shield,
    evidenceSources: '10+ sources',
    refreshFrequency: 'Monthly',
    features: [
      'Everything in Certified',
      'Data refreshed every 30 days (AI trusts data < 30 days old)',
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
      'Data refreshed daily (maximum freshness signal)',
      'Everything in Audited',
      'Full neighborhood endorsement',
      'Press mentions and awards',
      'Certifications and designations',
      'Maximum artifact depth',
    ],
  },
};

function BandLabel({ score }: { score: number }) {
  const label = bandLabel(score);
  const tip = BAND_TOOLTIPS[label];
  const colorClass = bandColor(score);
  if (!tip) return <span className={`text-sm font-semibold ${colorClass}`}>{label}</span>;
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip defaultOpen={false}>
        <TooltipTrigger asChild>
          <span className={`text-sm font-semibold ${colorClass} inline-flex items-center gap-1 cursor-help`}>
            {label}
            <Info className="h-3 w-3 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed text-center">
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function Step7Pricing() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const passedProfessional = (location.state as { professional?: Professional } | null)?.professional;
  const fromFunnel = !!passedProfessional; // arrived from Step6 -- agent just completed selection pipeline
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [prices, setPrices] = useState<PricingRow[]>(DEFAULT_PRICES);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [prevScore] = useState<number | null>(null); // score before funnel (used in activation banner)

  useEffect(() => {
    loadData();
  }, [token, passedProfessional]);

  const loadData = async () => {
    if (!token) { navigate('/404'); return; }
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
        const profSelect = 'id, name, email, years_experience, total_sales, num_total_reviews, review_stars_rating, license_number, state_slug, community_roles, agent_sales_stats, current_tier, badge_tier, signal_score, certified_projected_signal, audited_projected_signal';
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
      if (!prof) { navigate('/404'); return; }
      setProfessional(prof as Professional);

      const { data: auditData } = await supabase
        .from('geo_audit_results')
        .select('pillar_identity, pillar_authority, pillar_social, pillar_technical, pillar_citability, score_current, score_audited, score_underwritten, gap_stale_reviews, gap_no_linkedin, gap_no_schema, gap_no_realtor, gap_no_homelight, gap_no_press, gap_no_personal_site, exa_source_count')
        .eq('agent_id', prof.id)
        .maybeSingle();
      if (auditData) setAudit(auditData as AuditData);

      const { data: priceData } = await supabase
        .from('certification_pricing_config')
        .select('tier, monthly_price, payload_weight, refresh_cadence')
        .eq('is_active', true);
      if (priceData && priceData.length > 0) {
        const filtered = (priceData as PricingRow[]).filter((p) => p.tier === 'certified' || p.tier === 'audited' || p.tier === 'underwritten');
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
    if (tierId === 'certified') return professional.certified_projected_signal ?? currentScore;
    if (tierId === 'audited') return audit?.score_audited ?? professional.audited_projected_signal ?? 65;
    if (tierId === 'underwritten') return audit?.score_underwritten ?? 95;
    return currentScore;
  };

  const getPrice = (tier: CertificationTier) => {
    const row = prices.find((p) => p.tier === tier);
    const monthly = row?.monthly_price ?? 0;
    if (monthly === 0) return { monthly: 0, annual: 0, display: 'Free' };
    const annual = annualPrice(monthly);
    return { monthly, annual, display: isAnnual ? `$${annual}/year` : `$${monthly}/mo` };
  };

  const handleSelectCertified = async () => {
    if (!token || !professional) return;
    setSaving('certified');
    try {
      const { data, error } = await supabase.functions.invoke('funnel-select-tier', { body: { token, tier: 'certified' } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Certified tier activated!');
      navigate(`/funnel/${token}/payment-success`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to activate Certified tier');
    } finally {
      setSaving(null);
    }
  };

  const handleUpgrade = async (tier: 'audited' | 'underwritten') => {
    if (!token || !professional) return;
    const email = professional.email;
    if (!email) { toast.error('Email is required for checkout. Please contact support.'); return; }
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
      if (data?.url) { window.location.href = data.url; }
      else throw new Error('No checkout URL returned');
    } catch (err: unknown) {
      let msg = 'Failed to start checkout';
      if (err && typeof err === 'object') {
        const e = err as { context?: { json?: () => Promise<{ error?: string; details?: string }> }; message?: string };
        if (e.context?.json) {
          try { const body = await e.context.json(); msg = body?.error ?? body?.details ?? e.message ?? msg; }
          catch { msg = e.message ?? msg; }
        } else { msg = e.message ?? msg; }
      }
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  };

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

  const scoreMarkerPct = currentScore != null ? Math.min(100, Math.round((currentScore / 100) * 100)) : null;

  return (
    <>
      <SafeHead>
        <title>Choose Your Certification Tier | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* ── Step header ── */}
          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
            <span>Step 8 of 8</span>
            <span className="font-medium text-foreground">Choose Your Tier</span>
          </div>

          {/* ── Activation banner (only when arriving from funnel flow) ── */}
          {fromFunnel && currentScore != null && (() => {
            const certScore = getAICS('certified');
            const priorScore = prevScore ?? (currentScore != null ? Math.max(0, currentScore - (certScore != null ? certScore - currentScore : 0)) : null);
            const showLift = certScore != null && certScore > currentScore;
            return (
              <div className="rounded-2xl border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/40 p-6 text-center space-y-3">
                <p className="text-2xl font-black text-green-700 dark:text-green-400">
                  Great work, {professional?.name?.split(' ')[0] || 'Agent'}!
                </p>
                <p className="text-base font-semibold text-green-800 dark:text-green-300">
                  You&rsquo;re more citable than you were 5 minutes ago.
                </p>
                {showLift && (
                  <div className="flex items-center justify-center gap-4 py-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Before</p>
                      <p className={`text-3xl font-black ${bandColor(currentScore)}`}>{currentScore}</p>
                      <div className="mt-1"><BandLabel score={currentScore} /></div>
                    </div>
                    <div className="text-3xl text-green-500 font-black">&rarr;</div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">After Certified</p>
                      <p className={`text-3xl font-black ${bandColor(certScore!)}`}>{certScore}</p>
                      <div className="mt-1"><BandLabel score={certScore!} /></div>
                    </div>
                  </div>
                )}
                <p className="text-sm text-green-700 dark:text-green-400">
                  Activating Certified is free and publishes your verified data to AI systems today.
                  Want to go further? Audited and Underwritten tiers are below.
                </p>
              </div>
            );
          })()}

          {/* ══════════════════════════════════════════════════════
              HERO: SCORE + BAND MARKER
          ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl border bg-card p-8 text-center space-y-5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">
                Your AI Confidence Score
              </p>
              {currentScore != null ? (
                <>
                  <div className="flex items-end justify-center gap-2">
                    <span className={`text-7xl font-black tabular-nums ${bandColor(currentScore)}`}>
                      {currentScore}
                    </span>
                    <span className="text-2xl text-muted-foreground mb-2">/ 100</span>
                  </div>
                  <div className="mt-1">
                    <BandLabel score={currentScore} />
                  </div>
                </>
              ) : (
                <p className="text-3xl font-bold text-muted-foreground">Score pending</p>
              )}
            </div>

            {/* Spectrum bar with marker */}
            {scoreMarkerPct != null && (
              <div className="relative max-w-sm mx-auto">
                <div className="h-3 rounded-full overflow-hidden flex">
                  <div className="flex-1 bg-red-400" />
                  <div className="flex-1 bg-orange-400" />
                  <div className="flex-1 bg-yellow-400" />
                  <div className="flex-1 bg-blue-400" />
                  <div className="flex-1 bg-green-500" />
                </div>
                {/* Marker */}
                <div
                  className="absolute -top-0.5 -translate-x-1/2"
                  style={{ left: `${scoreMarkerPct}%` }}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-white shadow-md bg-foreground" />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-0.5">
                  <span>0</span>
                  <span>31</span>
                  <span>51</span>
                  <span>71</span>
                  <span>86</span>
                  <span>95</span>
                </div>
              </div>
            )}

            {/* 5-band reference table */}
            {currentScore != null && (
              <div className="w-full max-w-md mx-auto pt-1">
                {[
                  { min: 0,  max: 30,  label: 'Invisible to AI',                bg: 'bg-red-50 dark:bg-red-950/40',     border: 'border-red-200 dark:border-red-800',     text: 'text-red-700 dark:text-red-400' },
                  { min: 31, max: 50,  label: 'Discoverable',                   bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400' },
                  { min: 51, max: 70,  label: 'Citable in general queries',     bg: 'bg-yellow-50 dark:bg-yellow-950/40', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-500' },
                  { min: 71, max: 85,  label: 'Citable in specific local queries', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800',   text: 'text-blue-700 dark:text-blue-400' },
                  { min: 86, max: 100, label: 'Authoritative citation candidate', bg: 'bg-green-50 dark:bg-green-950/40', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400' },
                ].map((band) => {
                  const isHere = currentScore >= band.min && currentScore <= band.max;
                  return (
                    <div
                      key={band.min}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border mb-1.5 ${isHere ? `${band.bg} ${band.border} ring-2 ring-offset-1 ring-current` : 'border-border bg-transparent'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground tabular-nums w-12 shrink-0">{band.min}–{band.max}</span>
                        <span className={`text-xs font-medium ${isHere ? band.text : 'text-muted-foreground'}`}>{band.label}</span>
                      </div>
                      {isHere && (
                        <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${band.text}`}>You are here</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pillar bars */}
            {audit && (
              <div className="grid grid-cols-5 gap-2 max-w-xs mx-auto pt-2">
                {PILLAR_META.map(({ key, label, max }) => {
                  const val = (audit[key] as number | null) ?? 0;
                  const pct = Math.round((val / max) * 100);
                  const fillColor = pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#f87171';
                  return (
                    <div key={key} className="flex flex-col items-center gap-1">
                      {/* bar track -- fixed height, fill rises from bottom */}
                      <div className="relative w-full h-14 bg-muted rounded overflow-hidden">
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded transition-all"
                          style={{ height: `${pct}%`, backgroundColor: fillColor }}
                        />
                      </div>
                      <p className="text-[10px] font-semibold text-foreground leading-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{val}/{max}</p>
                    </div>
                  );
                })}
              </div>
            )}



            {/* Gates passed -- compact trust strip */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 pt-2 border-t">
              {[
                'Gate 1: 4.5+ star rating',
                'Gate 2: 10+ verified reviews',
                'Gate 3: 5+ years in business',
                '1,000+ sources researched',
                'Human editorial approved',
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              You passed our entire selection pipeline. Free, and always will be.
            </p>
          </div>

          {/* ══════════════════════════════════════════════════════
              TIER CARDS
          ══════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Amplify what you&rsquo;ve earned</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Paid tiers publish more of your verified data to AI systems and refresh it more often.
                More evidence, more often increases your probability of being named.
              </p>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto mt-2">
                <span className="font-medium text-foreground">Note:</span>&nbsp;No one can guarantee that you will always be named. There are many factors that go into an AI&rsquo;s referral reasoning. Our Underwritten tier provides the largest single-action increase in AI citability. For agents who already have a strong web presence, it&rsquo;s the most impactful next step.
              </p>
            </div>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3">
              <Label htmlFor="billing-toggle" className="text-sm">Monthly</Label>
              <Switch id="billing-toggle" checked={isAnnual} onCheckedChange={setIsAnnual} />
              <Label htmlFor="billing-toggle" className="text-sm">
                Annual <span className="text-primary font-medium">(2 months free)</span>
              </Label>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['certified', 'audited', 'underwritten'] as const).map((tier) => {
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
                    className={`relative rounded-xl border p-5 flex flex-col ${
                      isCurrent
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                        : isMostPopular
                          ? 'pt-8 border-primary shadow-md'
                          : 'border-border'
                    }`}
                  >
                    {/* Badge image */}
                    <img
                      src={`/badges/${tier}.png`}
                      alt={`Top10Lists ${meta.name} badge`}
                      className="absolute top-3 right-3 h-10 w-auto object-contain"
                    />

                    {isMostPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}

                    {isCurrent && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <p className="text-xs font-bold text-primary uppercase tracking-wide">Your active tier</p>
                      </div>
                    )}

                    {/* Tier name + price */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <h3 className="text-base font-semibold">{meta.name}</h3>
                    </div>
                    <p className="text-3xl font-black text-foreground">{display}</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {meta.evidenceSources} &middot; {meta.refreshFrequency} refresh
                    </p>

                    {/* AICS block -- current tier shows actual score, others show projection + lift */}
                    {isCurrent ? (
                      <div className="rounded-lg p-3 mb-4 border bg-primary/5 border-primary/30">
                        <p className="text-[10px] text-primary uppercase tracking-wide font-semibold mb-0.5">Your current AICS</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-3xl font-black ${currentScore != null ? bandColor(currentScore) : 'text-muted-foreground'}`}>
                            {currentScore ?? '—'}
                          </span>
                          <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                        {currentScore != null && (
                          <div className="mt-0.5"><BandLabel score={currentScore} /></div>
                        )}
                        {currentScore != null && (
                          <div className="relative mt-2">
                            <div className="h-1.5 rounded-full overflow-hidden flex">
                              <div className="flex-1 bg-red-300" />
                              <div className="flex-1 bg-orange-300" />
                              <div className="flex-1 bg-yellow-300" />
                              <div className="flex-1 bg-blue-300" />
                              <div className="flex-1 bg-green-400" />
                            </div>
                            <div
                              className={`absolute -top-0.5 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${bandBg(currentScore)}`}
                              style={{ left: `${Math.min(100, Math.round((currentScore / 100) * 100))}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`rounded-lg p-3 mb-4 border ${isMostPopular ? 'bg-primary/5 border-primary/20' : 'bg-muted/40'}`}>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Projected AICS</p>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-3xl font-black ${aics != null ? bandColor(aics) : 'text-muted-foreground'}`}>
                                {aics ?? '—'}
                              </span>
                              <span className="text-sm text-muted-foreground">/ 100</span>
                            </div>
                            {aics != null && (
                              <div className="mt-0.5"><BandLabel score={aics} /></div>
                            )}
                          </div>
                          {lift != null && lift > 0 && (
                            <div className="text-right">
                              <span className="text-2xl font-black text-green-600">+{lift}</span>
                              <p className="text-[10px] text-muted-foreground">from current</p>
                            </div>
                          )}
                        </div>
                        {aics != null && (
                          <div className="relative mt-2">
                            <div className="h-1.5 rounded-full overflow-hidden flex">
                              <div className="flex-1 bg-red-300" />
                              <div className="flex-1 bg-orange-300" />
                              <div className="flex-1 bg-yellow-300" />
                              <div className="flex-1 bg-blue-300" />
                              <div className="flex-1 bg-green-400" />
                            </div>
                            <div
                              className={`absolute -top-0.5 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${bandBg(aics)}`}
                              style={{ left: `${Math.min(100, Math.round((aics / 100) * 100))}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Feature list */}
                    <ul className="text-xs text-muted-foreground space-y-1.5 mb-4 flex-1">
                      {meta.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                      <DataPayloadExpander tier={tier} triggerText="View full data and sources" professional={professional} />
                    </div>

                    {isCurrent ? (
                      <div className="w-full mt-auto rounded-lg border border-primary/30 bg-primary/10 py-2.5 text-center">
                        <p className="text-xs font-semibold text-primary">Active</p>
                      </div>
                    ) : (
                      <Button
                        className="w-full mt-auto"
                        disabled={!!saving}
                        onClick={() => tier === 'certified' ? handleSelectCertified() : handleUpgrade(tier)}
                      >
                        {saving === tier
                          ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          : tier === 'certified' ? 'Activate Certified (Free)' : `Upgrade to ${meta.name}`}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>



          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Transparency:</strong>&nbsp;AICS is calculated identically
              whether you&rsquo;re on the free tier or a paid tier. The score measures what AI systems can
              verify about you. Paid tiers publish more of your verified data, giving AI systems more to
              cite. The score reflects the result, not the payment. The full formula is published on our{' '}
              <a href="/about/ranking-methodology" className="underline">methodology page</a>.
            </p>
          </div>

          <p className="text-center text-sm text-muted-foreground pb-4">
            Questions? <a href="tel:6027589600" className="underline">(602) 758-9600</a>
          </p>

        </div>
      </div>
    </>
  );
}










