import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Shield, Zap, BadgeCheck, CheckCircle, XCircle, TrendingUp, ChevronRight, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface OverviewSectionProps {
  professional: any;
}

const BOT_DISPLAY: Record<string, string> = {
  "ChatGPT-User": "ChatGPT", "OAI-SearchBot": "ChatGPT Search",
  "Googlebot": "Google", "Google-Extended": "Google AI",
  "Applebot": "Apple", "Applebot-Extended": "Apple AI",
  "Meta-ExternalAgent": "Meta AI", "bingbot": "Microsoft Bing", "Bingbot": "Microsoft Bing",
  "ByteSpider": "TikTok/ByteDance", "ClaudeBot": "Claude (Anthropic)",
  "PerplexityBot": "Perplexity", "Gemini-AI": "Google Gemini", "GPTBot": "OpenAI",
};
const SEO_BOTS = new Set(["AhrefsBot", "semrushbot", "SEMrushBot", "DotBot", "AdsBot-Google", "MJ12bot"]);

function normalizeTier(t: string | null): string {
  const t0 = (t || "").toLowerCase();
  if (t0 === "accredited" || t0 === "audited") return "audited";
  if (t0 === "underwritten") return "underwritten";
  return "certified";
}

const TIER_LABELS: Record<string, string> = {
  certified: "Certified (Free)",
  audited: "Audited ($300/mo)",
  underwritten: "Underwritten ($500/mo)",
};

interface CrawlStats {
  total_crawls_30d: number;
  profile_crawls_30d: number;
  list_crawls_30d: number;
  bot_names_30d: string[];
  last_crawled_at: string | null;
}

interface AuditScores {
  score_listed: number | null;
  score_certified: number | null;
  score_audited: number | null;
  score_underwritten: number | null;
}

export function OverviewSection({ professional }: OverviewSectionProps) {
  const navigate = useNavigate();
  const rawTier = professional.current_tier || professional.badge_tier || "certified";
  const currentTier = normalizeTier(rawTier);

  const [crawlStats, setCrawlStats] = useState<CrawlStats | null>(null);
  const [scores, setScores] = useState<AuditScores | null>(null);

  useEffect(() => {
    if (!professional?.id) return;
    const pid = professional.id.replace(/'/g, "''");

    // Fetch crawl stats and AIFS scores in parallel
    supabase
      .rpc("run_sql" as any, {
        query: `SELECT total_crawls_30d, profile_crawls_30d, list_crawls_30d, bot_names_30d, last_crawled_at FROM agent_bot_crawl_stats WHERE agent_id = '${pid}'`,
      })
      .then(({ data }: any) => {
        const rows = data as CrawlStats[] | null;
        if (rows && rows.length > 0) setCrawlStats(rows[0]);
      });

    supabase
      .rpc("run_sql" as any, {
        query: `SELECT score_listed, score_certified, score_audited, score_underwritten FROM geo_audit_results WHERE agent_id = '${pid}'`,
      })
      .then(({ data }: any) => {
        const rows = data as AuditScores[] | null;
        if (rows && rows.length > 0) setScores(rows[0]);
      });
  }, [professional?.id]);

  const currentScore = scores
    ? (currentTier === "underwritten" ? scores.score_underwritten
      : currentTier === "audited" ? scores.score_audited
      : scores.score_certified) ?? 25
    : professional.signal_score ?? 25;

  const maxScore = scores?.score_underwritten ?? 95;

  const aiBots = (crawlStats?.bot_names_30d || []).filter((b) => !SEO_BOTS.has(b));
  const displayBots = [...new Set(aiBots.map((b) => BOT_DISPLAY[b] || b))].sort();

  const handleUpgrade = () => {
    const token = professional.verification_token || professional.id;
    navigate(`/funnel/${token}/pricing`);
  };

  const pctCurrent = Math.min(100, currentScore);
  const pctMax = Math.min(100, maxScore);

  return (
    <div className="space-y-6">

      {/* ── ROW 1: Command Center Metrics ── */}
      <div className="grid gap-4 sm:grid-cols-3">

        {/* Card 1: AI Engine Crawls (Hero) */}
        <div className="rounded-xl border bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white sm:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-emerald-400" />
            <p className="text-xs uppercase tracking-wide text-slate-400">AI Surfaces / Month</p>
          </div>
          <p className="text-4xl font-black tabular-nums">
            {professional.ai_surfaces_monthly_est
              ? professional.ai_surfaces_monthly_est.toLocaleString()
              : crawlStats ? crawlStats.total_crawls_30d.toLocaleString() : "--"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Times your profile appeared to AI systems (est. 30 days)
          </p>

          {/* Bot pills */}
          {displayBots.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {displayBots.map((bot) => (
                <span key={bot} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {bot}
                </span>
              ))}
            </div>
          )}

        </div>

        {/* Card 2: AIFS Score */}
        <div className="rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-3">
            <BadgeCheck className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Your AIFS Score</p>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black">{currentScore}</span>
            <span className="text-lg text-muted-foreground font-medium">/ 100</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Current tier: {TIER_LABELS[currentTier]}
          </p>

          {/* Mini score bar */}
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pctCurrent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0</span>
            <span>95</span>
          </div>
        </div>

        {/* Card 3: Web of Truth */}
        <div className="rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Web of Truth&trade; Artifact</p>
          </div>
          {professional.profile_link ? (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-lg font-bold text-green-600">Enabled</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Your trust artifact is live and citable by AI systems.</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-400" />
                <span className="text-lg font-bold text-red-500">Disabled</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Enable your artifact so AI systems can cite your verified credentials.
              </p>
              <button className="mt-2 text-xs font-semibold text-primary flex items-center gap-1 hover:underline">
                Enable Artifact <ChevronRight className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── ROW 2: Upgrade Gap ── */}
      {currentTier !== "underwritten" && (
        <div className="rounded-xl border bg-gradient-to-r from-primary/5 to-primary/10 p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Maximize Your AI Visibility
          </h3>

          {/* Score comparison */}
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            {/* Current */}
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your Current Score</p>
              <p className="text-3xl font-black">{currentScore}<span className="text-sm text-muted-foreground font-medium"> / 100</span></p>
              <div className="mt-2 h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctCurrent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{TIER_LABELS[currentTier]}</p>
            </div>

            {/* Potential */}
            <div className="rounded-lg border border-primary/30 bg-background p-4">
              <p className="text-xs text-primary uppercase tracking-wide mb-1">Underwritten Potential</p>
              <p className="text-3xl font-black text-primary">{maxScore}<span className="text-sm text-muted-foreground font-medium"> / 100</span></p>
              <div className="mt-2 h-3 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${pctMax}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Underwritten ($500/mo) -- daily refresh</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            An Underwritten score of 85+ enables daily data refreshes, maximum artifact depth, and the highest-fidelity payload served to AI model context windows.
          </p>

          <Button onClick={handleUpgrade} className="w-full sm:w-auto">
            View Upgrade Options <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* ── ROW 3: Quick AI Activity Context ── */}
      {crawlStats && crawlStats.total_crawls_30d > 0 && (
        <div className="rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">What these crawls mean for you</p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            <strong className="text-foreground">Note:</strong> This is not the number of times an AI has explicitly recommended you to a consumer -- no platform can track that. Before an AI takes the risk of endorsing you, it must see your verified information frequently, across multiple trusted platforms, to build algorithmic confidence.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            What this number actually means is that AI models have studied, verified, and ingested your business data{" "}
            <strong className="text-foreground">{(professional.ai_surfaces_monthly_est || crawlStats.total_crawls_30d).toLocaleString()} times</strong> in the last 30 days. Every crawl deepens your machine-trust moat -- the verified evidence AI systems use to distinguish you from unverified competitors.
          </p>
        </div>
      )}
    </div>
  );
}
