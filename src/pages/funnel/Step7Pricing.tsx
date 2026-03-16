import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Zap, CheckCircle2, AlertTriangle, ExternalLink, Info, DollarSign } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DataPayloadExpander } from '@/components/agent/DataPayloadExpander';
import { AIFSGauge, type AIFSData } from '@/components/agent/AIFSGauge';
import { CitationROICalculator } from '@/components/agent/CitationROICalculator';
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
  score_unlisted: number | null;
  score_listed: number | null;
  score_certified: number | null;
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

/* AIFS columns from aifs_scores table */
const AIFS_SELECT = 'aifs_total, aifs_band, serp_knowledge_graph, serp_knowledge_graph_score, serp_sitelink_salience, serp_sitelink_salience_score, serp_related_citations, serp_related_citations_score, serp_third_party_count, serp_third_party_score, serp_organic_visibility_score, internal_data_freshness_days, internal_data_freshness_score, internal_selection_rationale, internal_selection_rationale_score, internal_crypto_verified, internal_crypto_verified_score, internal_data_score, gap_analysis, tier_lift_projection';

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
  if (score <= 35) return 'Invisible';
  if (score <= 65) return 'Fragmented';
  if (score <= 85) return 'Recognized';
  return 'High Fidelity';
}

function bandColor(score: number): string {
  if (score <= 35) return 'text-red-500';
  if (score <= 65) return 'text-orange-500';
  if (score <= 85) return 'text-blue-500';
  return 'text-green-500';
}

function bandBg(score: number): string {
  if (score <= 35) return 'bg-red-500';
  if (score <= 65) return 'bg-orange-500';
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
  const [aifsData, setAifsData] = useState<AIFSData | null>(null);
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
        .select('pillar_identity, pillar_authority, pillar_social, pillar_technical, pillar_citability, score_unlisted, score_listed, score_certified, score_current, score_audited, score_underwritten, gap_stale_reviews, gap_no_linkedin, gap_no_schema, gap_no_realtor, gap_no_homelight, gap_no_press, gap_no_personal_site, exa_source_count')
        .eq('agent_id', prof.id)
        .maybeSingle();
      if (auditData) setAudit(auditData as AuditData);

      // Load AIFS data
      const { data: aifsRow } = await supabase
        .from('aifs_scores' as any)
        .select(AIFS_SELECT)
        .eq('agent_id', prof.id)
        .maybeSingle();
      if (aifsRow) setAifsData(aifsRow as unknown as AIFSData);

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

  // On the funnel pricing page, the agent is always Certified (free) -- this IS the upsell page
  const currentTier = 'certified' as const;
  const currentScore = audit?.score_certified ?? professional?.certified_projected_signal ?? professional?.signal_score ?? audit?.score_current ?? null;

  const getAIFS = (tierId: string): number | null => {
    if (!professional) return null;
    // Use AIFS tier lift projections if available
    if (aifsData?.tier_lift_projection?.[tierId]) {
      return aifsData.tier_lift_projection[tierId].projected_score;
    }
    // Fallback to legacy AIFS data
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

  // Build AIFS gauge data from DB scores
  const aifsGaugeData: AIFSData | null = aifsData ?? (currentScore != null ? (() => {
    const band = (s: number) => s <= 35 ? 'invisible' as const : s <= 65 ? 'fragmented' as const : s <= 85 ? 'recognized' as const : 'high_fidelity' as const;
    const sListed = audit?.score_listed ?? Math.max(10, currentScore - 10);
    const sCertified = audit?.score_certified ?? currentScore;
    const sAudited = audit?.score_audited ?? Math.min(100, currentScore + 20);
    const sUnderwritten = audit?.score_underwritten ?? Math.min(100, currentScore + 40);
    return {
      aifs_total: currentScore,
      aifs_band: band(currentScore),
      serp_knowledge_graph: false, serp_knowledge_graph_score: 0,
      serp_sitelink_salience: false, serp_sitelink_salience_score: 0,
      serp_related_citations: false, serp_related_citations_score: 0,
      serp_third_party_count: 0, serp_third_party_score: 0,
      serp_organic_visibility_score: 0,
      internal_data_freshness_days: null, internal_data_freshness_score: 0,
      internal_selection_rationale: false, internal_selection_rationale_score: 0,
      internal_crypto_verified: false, internal_crypto_verified_score: 0,
      internal_data_score: 0,
      gap_analysis: [],
      tier_lift_projection: {
        listed: { projected_score: sListed, projected_band: band(sListed), lift: sListed - currentScore },
        certified: { projected_score: sCertified, projected_band: band(sCertified), lift: 0 },
        audited: { projected_score: sAudited, projected_band: band(sAudited), lift: sAudited - currentScore },
        underwritten: { projected_score: sUnderwritten, projected_band: band(sUnderwritten), lift: sUnderwritten - currentScore },
      },
    } as AIFSData;
  })() : null);

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
            const certScore = getAIFS('certified');
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
              AIFS SCORE
          ══════════════════════════════════════════════════════ */}
          <div className="rounded-2xl border bg-card p-8 space-y-5 shadow-sm">
            <AIFSGauge data={aifsGaugeData} currentTier={currentTier} />
          </div>

          {/* ══════════════════════════════════════════════════════
              TIER CARDS
          ══════════════════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* Challenge question */}
            <div className="rounded-xl border bg-muted/30 p-5 text-center space-y-3">
              <p className="text-sm font-bold text-foreground">Ask any AI this question:</p>
              <div className="relative">
                <p className="text-sm font-bold text-foreground italic leading-relaxed max-w-lg mx-auto">
                  &ldquo;I am a real estate agent. Look at Top10lists.us through the lens of AI Footprint and Machine Trust. Specifically, evaluate whether their site affects my chances of being recommended or endorsed by you? Is the Underwritten Tier a good move for my Machine-Readable Reputation? Estimate the ROI.&rdquo;
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText('I am a real estate agent. Look at Top10lists.us through the lens of AI Footprint and Machine Trust. Specifically, evaluate whether their site affects my chances of being recommended or endorsed by you? Is the Underwritten Tier a good move for my Machine-Readable Reputation? Estimate the ROI.');
                    toast.success('Copied to clipboard');
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  Copy to clipboard
                </button>
              </div>
            </div>

            {/* Show me ROI button */}
            <div className="text-center">
              <Button
                size="lg"
                className="font-black text-base px-8 py-6 shadow-lg"
                onClick={() => document.getElementById('roi-calculator')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <DollarSign className="h-5 w-5 mr-2" />
                Show Me the ROI
              </Button>
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
                const aifs = getAIFS(tier);
                const isCurrent = currentTier === tier;
                const isMostPopular = tier === 'audited';
                const aifsScore = aifsData?.aifs_total ?? currentScore;
                const lift = aifs != null && aifsScore != null ? aifs - aifsScore : null;

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

                    {/* AIFS block -- current tier shows actual score, others show projection + lift */}
                    {isCurrent ? (
                      <div className="rounded-lg p-3 mb-4 border bg-primary/5 border-primary/30">
                        <p className="text-[10px] text-primary uppercase tracking-wide font-semibold mb-0.5">Your current AIFS</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-3xl font-black ${aifs != null ? bandColor(aifs) : 'text-muted-foreground'}`}>
                            {aifs ?? '—'}
                          </span>
                          <span className="text-sm text-muted-foreground">/ 100</span>
                        </div>
                        {aifs != null && (
                          <div className="mt-0.5"><BandLabel score={aifs} /></div>
                        )}
                        {aifs != null && (
                          <div className="relative mt-2">
                            <div className="h-1.5 rounded-full overflow-hidden flex">
                              <div className="flex-[35] bg-red-300" />
                              <div className="flex-[30] bg-orange-300" />
                              <div className="flex-[20] bg-blue-300" />
                              <div className="flex-[15] bg-green-400" />
                            </div>
                            <div
                              className={`absolute -top-0.5 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${bandBg(aifs)}`}
                              style={{ left: `${Math.min(100, Math.round((aifs / 100) * 100))}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`rounded-lg p-3 mb-4 border ${isMostPopular ? 'bg-primary/5 border-primary/20' : 'bg-muted/40'}`}>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Projected AIFS</p>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-3xl font-black ${aifs != null ? bandColor(aifs) : 'text-muted-foreground'}`}>
                                {aifs ?? '—'}
                              </span>
                              <span className="text-sm text-muted-foreground">/ 100</span>
                            </div>
                            {aifs != null && (
                              <div className="mt-0.5"><BandLabel score={aifs} /></div>
                            )}
                          </div>
                          {lift != null && lift > 0 && (
                            <div className="text-right">
                              <span className="text-2xl font-black text-green-600">+{lift}</span>
                              <p className="text-[10px] text-muted-foreground">from current</p>
                            </div>
                          )}
                        </div>
                        {aifs != null && (
                          <div className="relative mt-2">
                            <div className="h-1.5 rounded-full overflow-hidden flex">
                              <div className="flex-[35] bg-red-300" />
                              <div className="flex-[30] bg-orange-300" />
                              <div className="flex-[20] bg-blue-300" />
                              <div className="flex-[15] bg-green-400" />
                            </div>
                            <div
                              className={`absolute -top-0.5 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${bandBg(aifs)}`}
                              style={{ left: `${Math.min(100, Math.round((aifs / 100) * 100))}%` }}
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

            <p className="text-sm text-muted-foreground max-w-lg mx-auto text-center mt-2">
              <span className="font-medium text-foreground">Note:</span>&nbsp;No one can guarantee that you will always be named. There are many factors that go into an AI&rsquo;s referral reasoning. Our Underwritten tier provides the largest single-action increase in AI citability. For agents who already have a strong web presence, it&rsquo;s the most impactful next step.
            </p>
          </div>

          {/* ROI Calculator */}
          {aifsGaugeData?.tier_lift_projection && (
            <CitationROICalculator
              tierProjections={aifsGaugeData.tier_lift_projection}
              currentScore={currentScore ?? 0}
            />
          )}

          <p className="text-center text-sm text-muted-foreground pb-4">
            Questions? <a href="tel:6027589600" className="underline">(602) 758-9600</a>
          </p>

        </div>
      </div>
    </>
  );
}










