import { useState } from 'react';
import { CheckCircle2, ChevronDown, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_CLOSE_RATE = 0.10;
const AIFS_CAP = 95;

type TierName = 'certified' | 'audited' | 'underwritten';

const TIERS: TierName[] = ['certified', 'audited', 'underwritten'];

const TIER_CONFIG: Record<TierName, {
  name: string;
  monthlyPrice: number;
  leads: number;
  compound: number;
  uplift: number;
  refresh: string;
  badgeSrc: string;
}> = {
  certified: {
    name: 'Certified',
    monthlyPrice: 0,
    leads: 16,
    compound: 1,
    uplift: 18,
    refresh: 'Every 90 days',
    badgeSrc: '/badges/certified.png',
  },
  audited: {
    name: 'Audited',
    monthlyPrice: 300,
    leads: 32,
    compound: 1.15,
    uplift: 28,
    refresh: 'Every 30 days',
    badgeSrc: '/badges/audited.png',
  },
  underwritten: {
    name: 'Underwritten',
    monthlyPrice: 500,
    leads: 48,
    compound: 1.5,
    uplift: 37,
    refresh: 'Daily',
    badgeSrc: '/badges/underwritten.png',
  },
};

const TIER_FEATURES: Record<TierName, string[]> = {
  certified: [
    'Machine-readable artifact',
    'Cryptographically signed badge',
    'Zillow + Google + license verification',
    'Service areas published to AI',
  ],
  audited: [
    'Everything in Certified',
    'Community service',
    'Transaction stats and history',
    'Specialties published to AI',
  ],
  underwritten: [
    'Everything in Audited',
    'Full neighborhood endorsement',
    'Press mentions and awards',
    'Certifications and designations',
  ],
};

interface BandDef {
  max: number;
  label: string;
  color: string;
}

const BANDS: (BandDef & { tooltip: string })[] = [
  { max: 30, label: 'Invisible', color: 'text-red-400', tooltip: 'AI systems have almost no verifiable data about you. You are unlikely to be named.' },
  { max: 50, label: 'Discoverable', color: 'text-orange-400', tooltip: 'AI may name you, but it will be a large list. It may endorse you, but hedge.' },
  { max: 70, label: 'Citable', color: 'text-blue-400', tooltip: 'You may be named intermittently. AI may endorse you with a minor hedge.' },
  { max: 85, label: 'Citable (local)', color: 'text-blue-300', tooltip: 'You are sometimes named in your market. AI endorses you without hedging.' },
  { max: 100, label: 'Authoritative', color: 'text-emerald-400', tooltip: 'You are regularly named. AI treats you as a definitive answer. It will endorse you without hesitation.' },
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
  const [dealSize, setDealSize] = useState(750000);
  const [commRate, setCommRate] = useState(3);
  const [closeRate, setCloseRate] = useState(20);
  const [isAnnual, setIsAnnual] = useState(false);
  const [expandedTier, setExpandedTier] = useState<TierName | null>(null);
  const effectiveCloseRate = closeRate / 100;

  const baselineAifs = currentAifs - TIER_CONFIG[currentTier].uplift;

  function tierAifs(tier: TierName): number {
    return Math.min(AIFS_CAP, baselineAifs + TIER_CONFIG[tier].uplift);
  }

  const commPerDeal = dealSize * (commRate / 100);

  function tierCalc(tier: TierName) {
    const cfg = TIER_CONFIG[tier];
    const closedDeals = Math.round(cfg.leads * effectiveCloseRate);
    const grossRevenue = commPerDeal * closedDeals;
    const annualCost = cfg.monthlyPrice === 0 ? 0 : isAnnual ? cfg.monthlyPrice * 10 : cfg.monthlyPrice * 12;
    const netAnnual = grossRevenue - annualCost;

    // 3-year with compounding
    const netY1 = grossRevenue - annualCost;
    const netY2 = Math.round(netY1 * cfg.compound);
    const netY3 = Math.round(netY1 * cfg.compound * cfg.compound);
    const threeYearNet = netY1 + netY2 + netY3;
    const threeYearCost = annualCost * 3;
    const roi = threeYearCost > 0 ? Math.round(((threeYearNet) / threeYearCost) * 100) : 0;

    return { closedDeals, grossRevenue, annualCost, netAnnual, netY1, netY2, netY3, threeYearNet, threeYearCost, roi };
  }

  function handleDealSizeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setDealSize(raw ? parseInt(raw, 10) : 0);
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 500 }}>
      {/* ── Personalize ── */}
      <div className="max-w-md mx-auto rounded-xl border border-slate-700 bg-slate-900/80 p-4">
        <p className="text-sm font-semibold text-white mb-3">Calculate your first year revenue uplift</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Avg. deal size</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg font-medium">$</span>
              <input
                type="text"
                value={fmtCommas(dealSize)}
                onChange={handleDealSizeChange}
                className="w-full pl-7 pr-3 py-2 rounded-md border border-slate-600 bg-slate-800 text-lg font-medium text-white outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Commission %</label>
            <input
              type="number"
              value={commRate}
              onChange={(e) => setCommRate(parseFloat(e.target.value) || 0)}
              min={0} max={100} step={0.5}
              className="w-full px-3 py-2 rounded-md border border-slate-600 bg-slate-800 text-lg font-medium text-white outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Close rate %</label>
            <input
              type="number"
              value={closeRate}
              onChange={(e) => setCloseRate(parseFloat(e.target.value) || 0)}
              min={1} max={100} step={1}
              className="w-full px-3 py-2 rounded-md border border-slate-600 bg-slate-800 text-lg font-medium text-white outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* ── Three cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {TIERS.map((tier) => {
          const cfg = TIER_CONFIG[tier];
          const calc = tierCalc(tier);
          const isCurrent = currentTier === tier;
          const aifs = tierAifs(tier);
          const band = getBand(aifs);
          const isPaid = cfg.monthlyPrice > 0;
          const priceDisplay = isPaid
            ? isAnnual ? `${fmtDollar(cfg.monthlyPrice * 10)}/yr` : `$${cfg.monthlyPrice}/mo`
            : 'Free';
          const isExpanded = expandedTier === tier;

          return (
            <div
              key={tier}
              className={`rounded-xl flex flex-col ${
                tier === 'audited' && !isCurrent
                  ? 'border-2 border-blue-500 bg-slate-900/80'
                  : 'border border-slate-700 bg-slate-900/80'
              }`}
            >
              {/* Badge label */}
              <div className="text-center pt-4 px-4">
                {isCurrent ? (
                  <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400">
                    Your current tier
                  </span>
                ) : tier === 'audited' ? (
                  <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-blue-500/10 text-blue-400">
                    Most popular
                  </span>
                ) : tier === 'underwritten' ? (
                  <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-amber-500/10 text-amber-400">
                    Maximum impact
                  </span>
                ) : (
                  <div className="h-6" />
                )}
              </div>

              {/* Orb + tier name + hero number */}
              <div className="flex flex-col items-center mt-3 px-4">
                <img
                  src={cfg.badgeSrc}
                  alt=""
                  style={{ height: 72, width: 'auto', animation: 'orbPulse 2s ease-in-out infinite' }}
                />
                <p className="text-xl text-white mt-2" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>{cfg.name}</p>
              </div>

              {/* Hero number: net annual revenue */}
              <div className="px-4 mt-3">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 py-3 text-center">
                  <p className="text-2xl font-black text-emerald-400">
                    {fmtDollar(calc.netAnnual)}
                  </p>
                  <p className="text-xs font-bold text-white">1st Year Rev Uplift</p>
                  <p className="text-[10px] font-medium text-slate-400">(Ttl Rev Uplift - Top10 investment)</p>
                  <p className="text-[10px] font-medium text-slate-500">Estimated</p>
                </div>
              </div>

              {/* AIFS score + band */}
              <div className="px-4 mt-3 text-center">
                <div className="inline-flex items-baseline gap-1.5">
                  <span className={`text-3xl font-black ${band.color}`}>{aifs}</span>
                  <span className="text-sm text-slate-500">/95</span>
                </div>
                <p className={`text-xs font-semibold ${band.color}`}>{band.label}</p>
                <p className="text-[12px] font-medium text-slate-300 mt-1.5 leading-relaxed">{band.tooltip}</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">AI Footprint Score</p>
              </div>

              {/* Data refresh */}
              <div className="px-4 mt-3 text-center">
                <p className="text-xs font-medium text-slate-400">
                  Data refresh: <span className="text-white font-semibold">{cfg.refresh}</span>
                </p>
              </div>

              {/* Features */}
              <div className="px-4 mt-3">
                <ul className="space-y-1.5">
                  {TIER_FEATURES[tier].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Expandable math */}
              <div className="px-4 mt-3">
                <button
                  type="button"
                  onClick={() => setExpandedTier(isExpanded ? null : tier)}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  {isExpanded ? 'Hide' : 'See'} how we calculated this
                </button>
                {isExpanded && (
                  <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800/50 p-3 space-y-2 text-xs font-medium animate-in slide-in-from-top-1 duration-150">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Est. annual AI leads</span>
                      <span className="text-white">{cfg.leads}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Close rate</span>
                      <span className="text-white">{closeRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Closed deals</span>
                      <span className="text-white">{calc.closedDeals}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gross commission</span>
                      <span className="text-white">{fmtDollar(calc.grossRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Annual cost</span>
                      <span className="text-white">{calc.annualCost > 0 ? fmtDollar(calc.annualCost) : 'Free'}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-slate-700 pt-2">
                      <span className="text-white">Net annual</span>
                      <span className="text-emerald-400">{fmtDollar(calc.netAnnual)}</span>
                    </div>
                    {isPaid && (
                      <>
                        <div className="border-t border-slate-700 pt-2 mt-1">
                          <p className="text-slate-500 uppercase tracking-wide text-[10px] mb-1">3-Year Projection</p>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Year 1</span>
                            <span className="text-white">{fmtDollar(calc.netY1)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Year 2</span>
                            <span className="text-white">{fmtDollar(calc.netY2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Year 3</span>
                            <span className="text-white">{fmtDollar(calc.netY3)}</span>
                          </div>
                          <div className="flex justify-between font-medium border-t border-slate-700 pt-1 mt-1">
                            <span className="text-white">3-year ROI</span>
                            <span className="text-emerald-400">{fmtCommas(calc.roi)}%</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Billing toggle + Price + CTA — pinned to bottom */}
              <div className="mt-auto px-4 pb-4 pt-4">
                {isPaid && (
                  <div className="flex flex-col items-center gap-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-400">Monthly</span>
                      <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
                      <span className="text-xs font-medium text-slate-400">Annual</span>
                    </div>
                    {isAnnual && (
                      <span className="text-[10px] font-medium text-primary">2 months free</span>
                    )}
                  </div>
                )}
                <p className="text-center text-2xl font-bold text-white mb-3">{priceDisplay}</p>
                {isCurrent ? (
                  <div className="flex items-center justify-center min-h-[44px] rounded-lg bg-slate-800 text-sm text-slate-400">
                    Active
                  </div>
                ) : (
                  <button
                    disabled={!!savingTier}
                    onClick={() => onSelectTier(tier)}
                    className={`w-full min-h-[48px] rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 ${
                      tier === 'certified'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : tier === 'audited'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {savingTier === tier ? 'Processing...' : tier === 'certified' ? 'Stay with Free' : `Choose ${cfg.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyframes for orb pulse */}
      <style>{`@keyframes orbPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }`}</style>

      {/* Disclaimer */}
      <p className="max-w-lg mx-auto text-center text-xs font-medium text-slate-600">
        Revenue projections are estimates based on industry averages. No one can guarantee AI citations.
        Our Underwritten tier provides the largest single-action increase in AI citability.
      </p>
    </div>
  );
}
