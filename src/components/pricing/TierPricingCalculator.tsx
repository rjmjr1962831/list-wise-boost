import { useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Constants ──────────────────────────────────────────────────────────────

const CLOSE_RATE = 0.3;
const AIFS_CAP = 95;

type TierName = 'certified' | 'audited' | 'underwritten';

const TIERS: TierName[] = ['certified', 'audited', 'underwritten'];

const TIER_CONFIG: Record<TierName, {
  name: string;
  monthlyPrice: number;
  leads: number;
  compound: number;
  compoundLabel: string;
  uplift: number;
  compoundDesc: string;
}> = {
  certified: {
    name: 'Certified',
    monthlyPrice: 0,
    leads: 16,
    compound: 1,
    compoundLabel: '1x',
    uplift: 18,
    compoundDesc: 'Quarterly refresh maintains baseline presence',
  },
  audited: {
    name: 'Audited',
    monthlyPrice: 300,
    leads: 32,
    compound: 1.15,
    compoundLabel: '1.15x',
    uplift: 28,
    compoundDesc: 'Monthly refresh builds steady trust weight',
  },
  underwritten: {
    name: 'Underwritten',
    monthlyPrice: 500,
    leads: 48,
    compound: 1.5,
    compoundLabel: '1.5x',
    uplift: 37,
    compoundDesc: 'Daily refresh builds deepest machine-trust moat',
  },
};

const TIER_FEATURES: Record<TierName, string[]> = {
  certified: [
    'Machine-readable artifact',
    'Cryptographically signed badge',
    'Zillow + Google + license verification',
    'Service areas published to AI',
    'Data refreshed every 90 days',
  ],
  audited: [
    'Everything in Certified',
    'Data refreshed every 30 days',
    'Community (IRS 990 verified)',
    'Transaction stats and history',
    'Specialties published to AI',
  ],
  underwritten: [
    'Everything in Audited',
    'Data refreshed daily',
    'Full neighborhood endorsement',
    'Press mentions and awards',
    'Certifications and designations',
  ],
};

interface BandDef {
  max: number;
  label: string;
  tooltip: string;
}

const BANDS: BandDef[] = [
  { max: 30, label: 'Invisible', tooltip: 'AI systems cannot reliably find or verify your profile.' },
  { max: 50, label: 'Discoverable', tooltip: 'AI systems can find your profile, but the evidence depth is not yet strong enough for confident citation.' },
  { max: 70, label: 'Citable (general)', tooltip: 'Your profile is structured well enough for AI systems to cite you in broad, general queries. You appear in results but may not be prioritized over agents with deeper verification.' },
  { max: 85, label: 'Citable (local)', tooltip: 'AI systems prioritize your profile for location-specific queries. Deeper evidence means you are more likely to be named when someone asks for an agent in a specific city or neighborhood.' },
  { max: 100, label: 'Authoritative', tooltip: 'The highest citability level. AI systems treat your profile as fully authoritative. You carry the strongest possible trust signal and are most likely to be named first in any relevant query.' },
];

function getBand(score: number): BandDef {
  for (const b of BANDS) {
    if (score <= b.max) return b;
  }
  return BANDS[BANDS.length - 1];
}

function fmtDollar(n: number): string {
  return '$' + Math.round(Math.abs(n)).toLocaleString();
}

function fmtCommas(n: number): string {
  return Math.round(n).toLocaleString();
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface TierPricingCalculatorProps {
  currentTier: TierName;
  currentAifs: number;
  onSelectTier: (tier: TierName) => void;
  savingTier: string | null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function TierPricingCalculator({
  currentTier,
  currentAifs,
  onSelectTier,
  savingTier,
}: TierPricingCalculatorProps) {
  const [dealSize, setDealSize] = useState(500000);
  const [commRate, setCommRate] = useState(3);
  const [isAnnual, setIsAnnual] = useState(false);

  // Strip current tier uplift to get baseline, then apply each tier's uplift
  const baselineAifs = currentAifs - TIER_CONFIG[currentTier].uplift;

  function tierAifs(tier: TierName): number {
    return Math.min(AIFS_CAP, baselineAifs + TIER_CONFIG[tier].uplift);
  }

  const commPerDeal = dealSize * (commRate / 100);

  function tierCalc(tier: TierName) {
    const cfg = TIER_CONFIG[tier];
    const closedDeals = Math.round(cfg.leads * CLOSE_RATE);
    const grossRevenue = commPerDeal * closedDeals;
    const annualCost = cfg.monthlyPrice === 0 ? 0 : isAnnual ? cfg.monthlyPrice * 10 : cfg.monthlyPrice * 12;
    const threeYearCost = annualCost * 3;

    // ROI uses gross revenue with compounding
    const grossY1 = grossRevenue;
    const grossY2 = Math.round(grossY1 * cfg.compound);
    const grossY3 = Math.round(grossY1 * cfg.compound * cfg.compound);
    const roi = threeYearCost > 0 ? Math.round(((grossY1 + grossY2 + grossY3 - threeYearCost) / threeYearCost) * 100) : 0;

    // Revenue impact vs Certified
    const certClosedDeals = Math.round(TIER_CONFIG.certified.leads * CLOSE_RATE);
    const certRevenue = commPerDeal * certClosedDeals;
    const revenueBump = grossRevenue - certRevenue;

    // 3-year projection (net)
    const netY1 = grossRevenue - annualCost;
    const netY2 = Math.round(netY1 * cfg.compound);
    const netY3 = Math.round(netY1 * cfg.compound * cfg.compound);

    return { closedDeals, grossRevenue, annualCost, threeYearCost, roi, revenueBump, netY1, netY2, netY3 };
  }

  // Deal size input with comma formatting
  function handleDealSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setDealSize(raw ? parseInt(raw, 10) : 0);
  }

  return (
    <div className="space-y-6">
      {/* ── 1. Personalize Your Estimate ── */}
      <div className="max-w-[640px] mx-auto bg-secondary rounded-lg p-5">
        <p className="text-sm font-medium text-foreground">Personalize your estimate</p>
        <p className="text-[13px] text-muted-foreground mb-4">Change these numbers to see your projected revenue below.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Average deal size</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[22px] font-medium">$</span>
              <input
                type="text"
                value={fmtCommas(dealSize)}
                onChange={handleDealSizeChange}
                className="w-full pl-8 pr-3 py-2 rounded-md border-2 border-secondary bg-background text-[22px] font-medium text-foreground outline-none transition-all hover:border-primary-600 focus:border-primary-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Commission rate (%)</label>
            <input
              type="number"
              value={commRate}
              onChange={(e) => setCommRate(parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              step={0.5}
              className="w-full px-3 py-2 rounded-md border-2 border-secondary bg-background text-[22px] font-medium text-foreground outline-none transition-all hover:border-primary-600 focus:border-primary-600 focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]"
            />
          </div>
        </div>
      </div>

      {/* ── 2. Three-column card grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {TIERS.map((tier) => {
          const cfg = TIER_CONFIG[tier];
          const calc = tierCalc(tier);
          const isCurrent = currentTier === tier;
          const aifs = tierAifs(tier);
          const band = getBand(aifs);
          const isPaid = cfg.monthlyPrice > 0;
          const priceDisplay = isPaid
            ? isAnnual ? `$${fmtCommas(cfg.monthlyPrice * 10)}/yr` : `$${cfg.monthlyPrice}/mo`
            : 'Free';

          return (
            <div
              key={tier}
              className={`rounded-lg flex flex-col bg-card ${
                tier === 'audited' && !isCurrent
                  ? 'border-2 border-blue-500'
                  : 'border border-border'
              }`}
            >
              {/* a. Badge */}
              <div className="text-center pt-4 px-4">
                {isCurrent ? (
                  <span className="inline-block text-[13px] font-medium px-3.5 py-[3px] rounded-md bg-emerald-500/10 text-emerald-500">
                    Your current tier
                  </span>
                ) : tier === 'audited' ? (
                  <span className="inline-block text-[13px] font-medium px-3.5 py-[3px] rounded-md bg-blue-500/10 text-blue-500">
                    Most popular
                  </span>
                ) : tier === 'underwritten' ? (
                  <span className="inline-block text-[13px] font-medium px-3.5 py-[3px] rounded-md bg-amber-500/10 text-amber-500">
                    Most effective
                  </span>
                ) : (
                  <div className="h-7" />
                )}
              </div>

              {/* b. Tier name */}
              <p className="text-center text-xl font-medium text-foreground mt-2 px-4">{cfg.name}</p>

              {/* c. ROI header */}
              <div className="px-4 mt-2">
                {isPaid && calc.roi > 0 ? (
                  <div className="rounded-md bg-emerald-500/10 py-2 text-center">
                    <p className="text-xl font-medium text-emerald-500">+{fmtCommas(calc.roi)}% ROI</p>
                    <p className="text-[11px] text-muted-foreground">3-year estimated return</p>
                  </div>
                ) : (
                  <div className="py-2 text-center">
                    <p className="text-sm text-muted-foreground">Baseline</p>
                  </div>
                )}
              </div>

              {/* d. Revenue impact (paid tiers only) */}
              {isPaid && (
                <div className="px-4 mt-3 text-center">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Revenue impact vs. Certified</p>
                  <p className="text-lg font-medium text-emerald-500">+{fmtDollar(calc.revenueBump)}/yr</p>
                </div>
              )}

              {/* e. AIFS score */}
              <div className="px-4 mt-3 text-center">
                <p className="text-[15px] font-medium text-foreground">AIFS: {aifs}/100</p>
              </div>

              {/* f. Citability band */}
              <div className="px-4 mt-1 text-center">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-500 cursor-help">
                        {band.label}
                        <Info className="h-3 w-3 opacity-60" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs leading-relaxed">
                      {band.tooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* g. Features */}
              <div className="px-4 mt-3">
                <div className="border-t border-border pt-3">
                  <ul className="space-y-1">
                    {TIER_FEATURES[tier].map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* h. Citation revenue */}
              <div className="px-4 mt-3">
                <div className="border-t border-border pt-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-[0.5px] mb-2">Citation Revenue</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. annual AI leads</span>
                      <span className="text-foreground">{cfg.leads}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Closed deals (30%)</span>
                      <span className="text-foreground">{calc.closedDeals}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-foreground">1st year revenue bump</span>
                      <span className="text-foreground">{fmtDollar(calc.grossRevenue)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* i. 12-month trust compound */}
              <div className="px-4 mt-3">
                <div className="border-t border-border pt-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-[0.5px] mb-2">12-Month Trust Compound</p>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Compound multiplier</span>
                    <span className="text-foreground">{cfg.compoundLabel}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70">{cfg.compoundDesc}</p>
                </div>
              </div>

              {/* j. Cost */}
              <div className="px-4 mt-3">
                <div className="border-t border-border pt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">3-year total cost</span>
                    <span className="text-foreground">{calc.threeYearCost > 0 ? fmtDollar(calc.threeYearCost) : 'Free'}</span>
                  </div>
                </div>
              </div>

              {/* k. 3-year projection */}
              <div className="px-4 mt-3">
                <div className="border-t border-border pt-3">
                  <p className="text-[11px] uppercase text-muted-foreground tracking-[0.5px] mb-2">3-Year Projection</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Year 1</span>
                      <span className="font-medium text-foreground">{fmtDollar(calc.netY1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Year 2</span>
                      <span className="font-medium text-foreground">{fmtDollar(calc.netY2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Year 3</span>
                      <span className="font-medium text-foreground">{fmtDollar(calc.netY3)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* l. Bottom section — pinned to bottom */}
              <div className="mt-auto px-4 pb-4 pt-4">
                {/* Price */}
                <p className="text-center text-lg font-medium text-foreground mb-3">{priceDisplay}</p>

                {/* CTA */}
                {isCurrent ? (
                  <div className="flex items-center justify-center min-h-[44px] rounded-md bg-secondary text-[13px] text-muted-foreground">
                    You are here
                  </div>
                ) : (
                  <button
                    disabled={!!savingTier}
                    onClick={() => onSelectTier(tier)}
                    className="flex flex-col items-center justify-center w-full min-h-[44px] rounded-md bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                  >
                    {savingTier === tier ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <span className="text-xs">Upgrade to</span>
                        <span>{cfg.name}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Global monthly/annual toggle */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Monthly</span>
          <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
          <span className="text-sm text-muted-foreground">Annual</span>
        </div>
        {isAnnual && (
          <span className="text-xs font-medium text-[#2563EB]">2 months free</span>
        )}
      </div>

      {/* Disclaimer */}
      <p className="max-w-[640px] mx-auto text-center text-xs text-muted-foreground">
        No one can guarantee that you will always be named. There are many factors that go into an AI&rsquo;s referral reasoning. Our Underwritten tier provides the largest single-action increase in AI citability.
      </p>
    </div>
  );
}
