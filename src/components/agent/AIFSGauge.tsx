import { useState } from "react";
import { Info, CheckCircle2, XCircle, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AIFSData {
  aifs_total: number;
  aifs_band: "invisible" | "fragmented" | "recognized" | "high_fidelity";
  serp_knowledge_graph: boolean;
  serp_knowledge_graph_score: number;
  serp_sitelink_salience: boolean;
  serp_sitelink_salience_score: number;
  serp_related_citations: boolean;
  serp_related_citations_score: number;
  serp_third_party_count: number;
  serp_third_party_score: number;
  serp_organic_visibility_score: number;
  internal_data_freshness_days: number | null;
  internal_data_freshness_score: number;
  internal_selection_rationale: boolean;
  internal_selection_rationale_score: number;
  internal_crypto_verified: boolean;
  internal_crypto_verified_score: number;
  internal_data_score: number;
  gap_analysis: string[];
  tier_lift_projection: Record<string, { projected_score: number; projected_band: string; lift: number }>;
}

interface AIFSGaugeProps {
  data: AIFSData | null;
  currentTier?: string;
  compact?: boolean;
}

const BAND_CONFIG = {
  invisible: { label: "Invisible", color: "text-red-500", bg: "bg-red-500", border: "border-red-300", description: "AI rarely cites you in referral queries. If asked about your background, AI will struggle to give a confident answer." },
  fragmented: { label: "Certified", color: "text-orange-500", bg: "bg-orange-500", border: "border-orange-300", description: "AI knows you exist but lacks verified certainty to recommend you. If asked about your background, AI will give a positive reference, but it will hedge." },
  recognized: { label: "Audited", color: "text-blue-500", bg: "bg-blue-500", border: "border-blue-300", description: "AI cites you in relevant local queries with moderate confidence. If asked about your background, AI will respond positively with specific details." },
  high_fidelity: { label: "Underwritten", color: "text-green-500", bg: "bg-green-500", border: "border-green-300", description: "AI cites you as a primary reference with specific rationales. If asked about your background, AI will give a strong, unhesitating endorsement backed by verified data." },
};

function bandFromScore(score: number): "invisible" | "fragmented" | "recognized" | "high_fidelity" {
  if (score <= 35) return "invisible";
  if (score <= 65) return "fragmented";
  if (score <= 85) return "recognized";
  return "high_fidelity";
}

function scoreColor(score: number): string {
  if (score <= 35) return "text-red-500";
  if (score <= 65) return "text-orange-500";
  if (score <= 85) return "text-blue-500";
  return "text-green-500";
}

function SignalRow({ label, active, score, maxScore, tooltip }: { label: string; active: boolean; score: number; maxScore: number; tooltip?: string }) {
  const content = (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {active ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        )}
        <span className="text-xs text-foreground">{label}</span>
        {tooltip && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className={`text-xs font-mono tabular-nums ${active ? "text-foreground" : "text-muted-foreground"}`}>
        {score}/{maxScore}
      </span>
    </div>
  );
  return content;
}

export function AIFSGauge({ data, currentTier, compact = false }: AIFSGaugeProps) {
  if (!data) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">AI Footprint Score</p>
        <p className="text-2xl font-bold text-muted-foreground">Pending</p>
        <p className="text-xs text-muted-foreground mt-1">Score will be calculated shortly</p>
      </div>
    );
  }

  const band = BAND_CONFIG[data.aifs_band];
  const markerPct = Math.min(100, Math.round((data.aifs_total / 100) * 100));

  if (compact) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">AI Footprint Score</p>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-black ${scoreColor(data.aifs_total)}`}>{data.aifs_total}</span>
          <span className="text-sm text-muted-foreground">/ 100</span>
        </div>
        <p className={`text-xs font-semibold mt-0.5 ${band.color}`}>{band.label}</p>
        {/* Mini spectrum bar */}
        <div className="relative mt-2">
          <div className="h-1.5 rounded-full overflow-hidden flex">
            <div className="flex-[35] bg-red-300" />
            <div className="flex-[30] bg-orange-300" />
            <div className="flex-[20] bg-blue-300" />
            <div className="flex-[15] bg-green-400" />
          </div>
          <div
            className={`absolute -top-0.5 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${band.bg}`}
            style={{ left: `${markerPct}%` }}
          />
        </div>
      </div>
    );
  }

  // Map bands to tiers for projected scores
  const BAND_TIER_MAP: Record<string, string> = {
    invisible: "listed",
    fragmented: "certified",
    recognized: "audited",
    high_fidelity: "underwritten",
  };

  const BANDS = [
    { id: "fragmented" as const, range: "0-65", activeBg: "bg-orange-50 dark:bg-orange-950/40" },
    { id: "recognized" as const, range: "66-85", activeBg: "bg-blue-50 dark:bg-blue-950/40" },
    { id: "high_fidelity" as const, range: "86-100", activeBg: "bg-green-50 dark:bg-green-950/40" },
  ];

  const [selectedBand, setSelectedBand] = useState<typeof data.aifs_band | null>(null);

  const activeBandId = selectedBand ?? data.aifs_band;
  const activeBand = BAND_CONFIG[activeBandId];

  // Get the displayed score: current score for actual band, projected for others
  const getDisplayScore = (bandId: string): number => {
    if (bandId === data.aifs_band) return data.aifs_total;
    const tier = BAND_TIER_MAP[bandId];
    const proj = data.tier_lift_projection?.[tier];
    if (proj) return proj.projected_score;
    return data.aifs_total;
  };

  const displayScore = getDisplayScore(activeBandId);
  const isProjection = selectedBand !== null && selectedBand !== data.aifs_band;

  return (
    <div className="space-y-4">
      {/* Congratulations banner */}
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-green-700">Congratulations!</h2>
        <p className="text-sm text-muted-foreground mt-1">You're now Certified by us. You have taken a big step to getting AI comfortable endorsing you.</p>
      </div>

      {/* Score hero */}
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">
          {isProjection ? "Projected AI Footprint Score" : "AI Footprint Score"}
        </p>
        <div className="flex items-end justify-center gap-2">
          <span className={`text-7xl font-black tabular-nums ${scoreColor(displayScore)}`}>
            {displayScore}
          </span>
          <span className="text-2xl text-muted-foreground mb-2">/ 100</span>
        </div>
        <span className={`text-sm font-semibold ${activeBand.color}`}>{activeBand.label}</span>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{activeBand.description}</p>
        {isProjection && (
          <p className="text-xs text-green-600 font-semibold mt-2">
            +{displayScore - data.aifs_total} points from your current score
          </p>
        )}
      </div>

      {/* Interactive band selector */}
      <p className="text-[11px] text-muted-foreground text-center">Tap a level to see your projected score</p>
      <div className="w-full max-w-md mx-auto">
        {BANDS.map(({ id, range, activeBg }) => {
          const cfg = BAND_CONFIG[id];
          const isCurrentBand = data.aifs_band === id;
          const isSelected = activeBandId === id;
          const projScore = getDisplayScore(id);
          return (
            <div
              key={id}
              onClick={() => setSelectedBand(id === data.aifs_band ? null : id)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border mb-1.5 cursor-pointer transition-all ${
                isSelected ? `${activeBg} ${cfg.border} ring-2 ring-offset-1 ring-current` : "border-border bg-transparent hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground tabular-nums w-12 shrink-0">{range}</span>
                <span className={`text-xs font-medium ${isSelected ? cfg.color : "text-muted-foreground"}`}>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {!isCurrentBand && (
                  <span className={`text-xs font-bold tabular-nums ${scoreColor(projScore)}`}>{projScore}</span>
                )}
                {isCurrentBand && (
                  <span className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${cfg.color}`}>You are here</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
