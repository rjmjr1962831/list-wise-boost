import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Layers, DollarSign } from "lucide-react";

interface TierProjection {
  projected_score: number;
  projected_band: string;
  lift: number;
}

interface CitationROICalculatorProps {
  tierProjections: Record<string, TierProjection>;
  currentScore: number;
}

const CLOSE_RATE = 0.30;

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

const TIER_ORDER = ["certified", "audited", "underwritten"];

function formatCurrency(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function formatCurrencyInput(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function parseCurrencyInput(s: string): number {
  return Math.max(0, Number(s.replace(/[^0-9]/g, "")) || 0);
}

export function CitationROICalculator({ tierProjections, currentScore }: CitationROICalculatorProps) {
  const [annualVolume, setAnnualVolume] = useState(10000000);
  const [commissionRate, setCommissionRate] = useState(2.5);
  const [monthlyCitations, setMonthlyCitations] = useState(2);

  const results = useMemo(() => {
    const avgDealSize = 500000;
    const avgDealCommission = avgDealSize * (commissionRate / 100);
    const annualCitations = monthlyCitations * 12;
    const closedDeals = annualCitations * CLOSE_RATE;
    const citationRevenue = closedDeals * avgDealCommission;

    // Base score (certified) is the floor -- higher tiers amplify citations
    const baseScore = tierProjections["certified"]?.projected_score || currentScore || 1;

    return TIER_ORDER.map((tier) => {
      const proj = tierProjections[tier];
      if (!proj) return null;
      const score = proj.projected_score;
      const cost = TIER_COSTS[tier];

      // AIFS amplifier: higher score = more citations (AI names you more often)
      // Scale relative to certified baseline
      const aifsAmplifier = score / Math.max(baseScore, 1);

      // Compound trust multiplier (12-month)
      // Underwritten compounds faster due to daily refresh
      const compoundMultiplier = tier === "underwritten" ? 1.35 : tier === "audited" ? 1.15 : 1.0;

      // Amplified citation revenue: more AIFS = more citations = more revenue
      const amplifiedCitationRevenue = citationRevenue * aifsAmplifier;
      const amplifiedClosedDeals = closedDeals * aifsAmplifier;
      const amplifiedAnnualCitations = annualCitations * aifsAmplifier;

      const totalAnnualValue = amplifiedCitationRevenue * compoundMultiplier;
      const roi = cost > 0 ? ((totalAnnualValue - cost) / cost) * 100 : null;
      const netValue = totalAnnualValue - cost;

      return {
        tier,
        score,
        label: TIER_LABELS[tier],
        cost,
        aifsAmplifier,
        annualCitations: amplifiedAnnualCitations,
        closedDeals: amplifiedClosedDeals,
        citationRevenue: amplifiedCitationRevenue,
        compoundMultiplier,
        totalAnnualValue,
        netValue,
        roi,
      };
    }).filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>[number]>[];
  }, [annualVolume, commissionRate, monthlyCitations, tierProjections]);

  return (
    <div id="roi-calculator" className="rounded-2xl border bg-card p-6 space-y-6 shadow-sm">
      <div className="text-center">
        <h3 className="text-lg font-bold text-foreground">Citation Value Calculator</h3>
        <p className="text-xs font-bold text-muted-foreground mt-1">
          What is one AI citation worth to your business?
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="calc-volume" className="text-xs font-bold">Annual Sales Volume</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="calc-volume"
              type="text"
              inputMode="numeric"
              className="pl-8 h-9 text-sm"
              value={formatCurrencyInput(annualVolume)}
              onChange={(e) => setAnnualVolume(parseCurrencyInput(e.target.value))}
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
            onChange={(e) => setCommissionRate(Math.max(0, Math.min(10, Number(e.target.value))))}
          />
        </div>
        <div>
          <Label htmlFor="calc-citations" className="text-xs font-bold">Expected Monthly AI Citations</Label>
          <Input
            id="calc-citations"
            type="number"
            min={1}
            max={100}
            step={1}
            className="h-9 text-sm mt-1"
            value={monthlyCitations}
            onChange={(e) => setMonthlyCitations(Math.max(1, Number(e.target.value)))}
          />
          <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
            Times per month AI names you to a consumer
          </p>
        </div>
      </div>

      {/* Assumptions */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 justify-center text-[10px] font-bold text-muted-foreground border-t border-b py-2">
        <span>Close rate: {(CLOSE_RATE * 100).toFixed(0)}% (NAR referral benchmark)</span>
        <span>Avg deal: $500K</span>
      </div>

      {/* Results per tier */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((r) => {
          const isUnderwritten = r.tier === "underwritten";
          const isFree = r.cost === 0;
          return (
            <div
              key={r.tier}
              className={`rounded-xl border p-4 space-y-3 ${
                isUnderwritten ? "border-primary shadow-md" : "border-border"
              }`}
            >
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{r.label}</p>
                <p className="text-sm font-bold text-foreground">AIFS: {r.score}/100</p>
              </div>

              {/* Citation Revenue */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Citation Revenue
                </p>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Annual citations</span>
                  <span className="font-bold text-foreground">{r.annualCitations}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Closed deals (30%)</span>
                  <span className="font-bold text-foreground">{r.closedDeals.toFixed(1)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Commission revenue</span>
                  <span className="font-bold text-foreground">{formatCurrency(r.citationRevenue)}</span>
                </div>
              </div>

              {/* Compound Trust */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Layers className="h-3 w-3" /> 12-Month Trust Compound
                </p>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Compound multiplier</span>
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
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-muted-foreground">Compounded annual value</span>
                  <span className="font-bold text-foreground">{formatCurrency(r.totalAnnualValue)}</span>
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
            </div>
          );
        })}
      </div>

      {/* Formula */}
      <div className="text-center border-t pt-4">
        <p className="text-[10px] font-bold text-muted-foreground">
          Net Value = (Monthly Citations &times; 12 &times; 30% Close Rate &times; Avg Commission) &times; Trust Compound &minus; Tier Cost
        </p>
      </div>
    </div>
  );
}
