import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Layers, DollarSign, BarChart3, Info } from "lucide-react";

interface TierProjection {
  projected_score: number;
  projected_band: string;
  lift: number;
}

interface CitationROICalculatorProps {
  tierProjections: Record<string, TierProjection>;
  currentScore: number;
  avgDealSize?: number;
  commissionRate?: number;
  onInputChange?: (avgDealSize: number, commissionRate: number) => void;
}

// AIFS-to-leads model: estimated annual AI leads by AIFS band
function leadsFromAIFS(aifs: number): number {
  if (aifs <= 30) return 0;
  if (aifs <= 50) return 3 + ((aifs - 31) / 19) * 2; // 3-5 linear
  if (aifs <= 70) return 6 + ((aifs - 51) / 19) * 3; // 6-9 linear
  if (aifs <= 85) return 10 + ((aifs - 71) / 14) * 4; // 10-14 linear
  return 15 + ((aifs - 86) / 14) * 5; // 15-20 linear
}

const TIER_LIFTS: Record<string, number> = {
  certified: 18,
  audited: 28,
  underwritten: 37,
};

const TIER_COSTS: Record<string, number> = {
  certified: 0,
  audited: 3600, // $300/mo
  underwritten: 6000, // $500/mo
};

const TIER_LABELS: Record<string, string> = {
  certified: "Certified (Free)",
  audited: "Audited ($300/mo)",
  underwritten: "Underwritten ($500/mo)",
};

const COMPOUND_MULTIPLIERS: Record<string, number> = {
  certified: 1.0,
  audited: 1.15,
  underwritten: 1.5,
};

const TIER_ORDER = ["certified", "audited", "underwritten"];

const BANDS = [
  { min: 0, max: 30, label: "Invisible to AI", color: "bg-gray-400", textColor: "text-gray-500" },
  { min: 31, max: 50, label: "Discoverable", color: "bg-amber-400", textColor: "text-amber-600" },
  { min: 51, max: 70, label: "Citable in general queries", color: "bg-blue-500", textColor: "text-blue-600" },
  { min: 71, max: 85, label: "Citable in local queries", color: "bg-green-500", textColor: "text-green-600" },
  { min: 86, max: 100, label: "Authoritative citation", color: "bg-purple-600", textColor: "text-purple-600" },
];

function formatCurrency(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function formatCurrencyInput(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function parseCurrencyInput(s: string): number {
  return Math.max(0, Number(s.replace(/[^0-9]/g, "")) || 0);
}

function bandForScore(score: number) {
  return BANDS.find((b) => score >= b.min && score <= b.max) || BANDS[0];
}

export { BANDS, TIER_LIFTS, TIER_ORDER, TIER_COSTS, COMPOUND_MULTIPLIERS, leadsFromAIFS };

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <Info
        className="h-3 w-3 text-muted-foreground/60 cursor-help"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      />
      {open && (
        <>
          <span
            className="fixed inset-0 z-40 md:hidden"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 max-w-[90vw] rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md z-50">
            {text}
          </span>
        </>
      )}
    </span>
  );
}

export function AIFSBandMeter({ baseline, tiers }: { baseline: number; tiers: Record<string, number> }) {
  const markerStyle = (score: number): React.CSSProperties => ({
    left: `${Math.min(100, Math.max(0, score))}%`,
    transform: "translateX(-50%)",
  });

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">AI Footprint Score (AIFS) -- Where You Stand</p>
      {/* Band bar */}
      <div className="relative">
        <div className="h-6 rounded-full overflow-hidden flex">
          {BANDS.map((band) => {
            const width = band.max - band.min + 1;
            return (
              <div
                key={band.label}
                className={`${band.color} relative`}
                style={{ flex: width }}
                title={band.label}
              />
            );
          })}
        </div>
        {/* Band labels below bar */}
        <div className="flex mt-1">
          {BANDS.map((band) => {
            const width = band.max - band.min + 1;
            return (
              <div key={band.label} className="text-center" style={{ flex: width }}>
                <p className={`text-[8px] font-bold leading-tight ${band.textColor}`}>{band.label}</p>
              </div>
            );
          })}
        </div>
        {/* Current marker (solid) */}
        <div
          className="absolute top-0 w-4 h-6 flex items-center justify-center"
          style={markerStyle(baseline)}
        >
          <div className="w-3 h-8 rounded-sm bg-foreground border-2 border-white shadow-md" />
        </div>
        <div
          className="absolute top-7 text-[9px] font-black text-foreground whitespace-nowrap"
          style={{ ...markerStyle(baseline) }}
        >
          You: {baseline}
        </div>
        {/* Audited ghost marker */}
        <div
          className="absolute top-0 w-4 h-6 flex items-center justify-center"
          style={markerStyle(tiers.audited)}
        >
          <div className="w-3 h-8 rounded-sm border-2 border-blue-600 bg-transparent shadow" />
        </div>
        <div
          className="absolute -top-3.5 text-[8px] font-bold text-blue-600 whitespace-nowrap"
          style={{ ...markerStyle(tiers.audited) }}
        >
          Audited
        </div>
        {/* Underwritten ghost marker */}
        <div
          className="absolute top-0 w-4 h-6 flex items-center justify-center"
          style={markerStyle(tiers.underwritten)}
        >
          <div className="w-3 h-8 rounded-sm border-2 border-purple-600 bg-transparent shadow" />
        </div>
        <div
          className="absolute -top-3.5 text-[8px] font-bold text-purple-600 whitespace-nowrap"
          style={{ ...markerStyle(tiers.underwritten) }}
        >
          Underwritten
        </div>
      </div>
    </div>
  );
}

export function CitationROICalculator({ tierProjections, currentScore, avgDealSize: externalDealSize, commissionRate: externalCommRate, onInputChange }: CitationROICalculatorProps) {
  const [avgDealSize, setAvgDealSize] = useState(externalDealSize ?? 500000);
  const [commissionRate, setCommissionRate] = useState(externalCommRate ?? 3);
  const closeRate = 30;
  const baselineAIFS = currentScore || 42;

  // Compute tier AIFS scores from baseline + lift, capped at 95
  const tierScores = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const tier of TIER_ORDER) {
      scores[tier] = Math.min(95, baselineAIFS + TIER_LIFTS[tier]);
    }
    return scores;
  }, [baselineAIFS]);

  const results = useMemo(() => {
    const avgDealCommission = avgDealSize * (commissionRate / 100);
    const closeRateDecimal = closeRate / 100;

    return TIER_ORDER.map((tier) => {
      const score = tierScores[tier];
      const cost = TIER_COSTS[tier];
      const TIER_LEAD_FLOORS: Record<string, number> = { certified: 0, audited: 15, underwritten: 24 };
      const annualLeads = Math.max(leadsFromAIFS(score), TIER_LEAD_FLOORS[tier] ?? 0);
      const closedDeals = annualLeads * closeRateDecimal;
      const citationRevenue = closedDeals * avgDealCommission;
      const compoundMultiplier = COMPOUND_MULTIPLIERS[tier];
      const year1Value = citationRevenue * compoundMultiplier;
      const netValue = year1Value - cost;
      const roi = cost > 0 ? ((year1Value - cost) / cost) * 100 : null;

      // 3-year projection: compound multiplier applies each year
      const year2Value = year1Value * compoundMultiplier;
      const year3Value = year2Value * compoundMultiplier;
      const netYear2 = year2Value - cost;
      const netYear3 = year3Value - cost;

      return {
        tier,
        score,
        label: TIER_LABELS[tier],
        cost,
        annualLeads,
        closedDeals,
        citationRevenue,
        compoundMultiplier,
        year1Value,
        netValue,
        netYear2,
        netYear3,
        roi,
      };
    });
  }, [avgDealSize, commissionRate, closeRate, tierScores]);

  // Certified net value for "value gap" calculation
  const certifiedNet = results[0]?.netValue ?? 0;

  // Zillow comparison: use Underwritten lead count
  const underwrittenLeads = results[2]?.annualLeads ?? 0;
  const zillowCost = Math.round(underwrittenLeads) * 225;

  return (
    <div id="roi-calculator" className="rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="calc-volume" className="text-xs font-bold">Average Deal Size</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="calc-volume"
              type="text"
              inputMode="numeric"
              className="pl-8 h-9 text-sm"
              value={formatCurrencyInput(avgDealSize)}
              onChange={(e) => { const v = parseCurrencyInput(e.target.value); setAvgDealSize(v); onInputChange?.(v, commissionRate); }}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="calc-commission" className="text-xs font-bold">Commission Rate (%)</Label>
          <Input
            id="calc-commission"
            type="number"
            min={0}
            max={10}
            step={0.1}
            className="h-9 text-sm mt-1"
            value={commissionRate}
            onChange={(e) => { const v = Math.max(0, Math.min(10, Number(e.target.value))); setCommissionRate(v); onInputChange?.(avgDealSize, v); }}
          />
        </div>
      </div>

      {/* Results per tier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((r) => {
          const isUnderwritten = r.tier === "underwritten";
          const isFree = r.cost === 0;
          const isCertified = r.tier === "certified";
          const valueGap = isCertified ? null : r.netValue - certifiedNet;
          const band = bandForScore(r.score);
          return (
            <div
              key={r.tier}
              className={`rounded-xl border p-4 space-y-3 flex flex-col ${
                isUnderwritten ? "border-primary shadow-md" : "border-border"
              }`}
            >
              {/* ROI % at top */}
              {r.roi != null && r.roi > 0 ? (
                <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-center">
                  <p className="text-lg font-black text-primary">
                    {Math.round(r.roi).toLocaleString()}% ROI
                  </p>
                  <p className="text-[10px] text-primary/70">Estimated annual return</p>
                </div>
              ) : (
                <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-center">
                  <p className="text-lg font-black text-slate-400">Baseline</p>
                  <p className="text-[10px] text-slate-500">Free tier</p>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{r.label}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-foreground">AIFS: {r.score}/100</span>
                  <span className={`text-[10px] font-bold ${band.textColor}`}>{band.label}</span>
                </div>
              </div>

              {/* Citation Revenue */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Citation Revenue
                </p>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Est. annual AI leads</span>
                  <span className="font-bold text-foreground">{Math.round(r.annualLeads)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground flex items-center gap-1">
                    Closed deals ({closeRate}%)
                    <InfoTip text='Source: NAR. AI recommendations convert like warm introductions (30%), completely eliminating the massive operational tax and 24/7 "speed-to-lead" grind required to chase and convert cold aggregator leads.' />
                  </span>
                  <span className="font-bold text-foreground">{Math.ceil(r.closedDeals)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Commission revenue</span>
                  <span className="font-bold text-foreground">{formatCurrency(r.citationRevenue)}</span>
                </div>
                <p className="text-[9px] text-muted-foreground italic">Estimated from AIFS citation frequency model</p>
              </div>

              {/* Compound Trust */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Layers className="h-3 w-3" /> 12-Month Trust Compound
                </p>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground flex items-center gap-1">
                    Compound multiplier
                    <InfoTip text="This multiplier accounts for two factors: 1) Your deepening machine-trust moat as your verified profile ages, and 2) The projected macro-shift of consumer search volume away from declining traditional aggregators to AI platforms." />
                  </span>
                  <span className="font-bold text-foreground">{r.compoundMultiplier}x</span>
                </div>
                <p className="text-[10px] font-bold text-muted-foreground">
                  {r.tier === "underwritten"
                    ? "Daily refresh builds deepest Machine-Trust Moat"
                    : r.tier === "audited"
                      ? "Monthly refresh builds steady trust weight"
                      : "Quarterly refresh maintains baseline presence"}
                </p>
              </div>

              {/* Bottom line */}
              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Annual tier cost</span>
                  <span className="font-bold text-foreground">{isFree ? "Free" : formatCurrency(r.cost)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-foreground">Net value</span>
                  <span className={`font-black text-lg ${r.netValue > 0 ? "text-green-600" : "text-red-500"}`}>
                    {formatCurrency(r.netValue)}
                  </span>
                </div>
                {r.roi !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-foreground">ROI</span>
                    <span className={`font-black text-sm ${r.roi > 0 ? "text-green-600" : "text-red-500"}`}>
                      {r.roi > 0 ? "+" : ""}{Math.round(r.roi)}%
                    </span>
                  </div>
                )}
              </div>

              {/* 3-Year Projection */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> 3-Year Projection
                </p>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Year 1</span>
                  <span className={`font-bold ${r.netValue > 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(r.netValue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Year 2</span>
                  <span className={`font-bold ${r.netYear2 > 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(r.netYear2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Year 3</span>
                  <span className={`font-bold ${r.netYear3 > 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(r.netYear3)}</span>
                </div>
              </div>

              {/* CTA Button -- scrolls to tier cards above */}
              <div className="mt-auto">
                {isCertified ? (
                  <div className="w-full py-2 rounded-lg text-xs font-bold bg-muted text-muted-foreground text-center cursor-default">
                    You are here
                  </div>
                ) : (
                  <button
                    className={`w-full py-2 rounded-lg text-xs font-bold text-white ${
                      isUnderwritten ? "bg-primary hover:bg-primary/90" : "bg-blue-600 hover:bg-blue-700"
                    } transition-colors`}
                    onClick={() => document.getElementById('tier-cards')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Upgrade to {r.tier === "audited" ? "Audited" : "Underwritten"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Zillow Comparison */}
      {underwrittenLeads > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 px-4 py-3 text-center space-y-1">
          <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
            Zillow equivalent: To generate {Math.round(underwrittenLeads)} leads at Zillow&rsquo;s ~$225/lead avg, you would spend {formatCurrency(zillowCost)} annually with a &lt;1% close rate--while fighting &ldquo;speed-to-lead&rdquo; penalties just to stay visible. AI routing delivers high-intent introductions, not a second full-time job.
          </p>
          <p className="text-[10px] text-orange-700 dark:text-orange-400">Source: NAR, Zillow Premier Agent data</p>
        </div>
      )}
    </div>
  );
}
