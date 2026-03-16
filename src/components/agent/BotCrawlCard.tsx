import { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const BOT_DISPLAY: Record<string, string> = {
  "ChatGPT-User": "ChatGPT", "OAI-SearchBot": "ChatGPT Search",
  "Googlebot": "Google", "Google-Extended": "Google AI",
  "Applebot": "Apple", "applebot": "Apple", "Applebot-Extended": "Apple AI",
  "Meta-ExternalAgent": "Meta AI", "bingbot": "Microsoft Bing", "Bingbot": "Microsoft Bing",
  "ByteSpider": "TikTok/ByteDance", "ClaudeBot": "Claude (Anthropic)",
  "PerplexityBot": "Perplexity", "Gemini-AI": "Google Gemini",
};
const SEO_BOTS = new Set(["AhrefsBot", "semrushbot", "SEMrushBot", "DotBot", "AdsBot-Google", "MJ12bot"]);

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface BotCrawlCardProps {
  professionalId: string;
  city?: string;
}

interface CrawlStats {
  total_crawls_30d: number;
  profile_crawls_30d: number;
  list_crawls_30d: number;
  bot_names_30d: string[];
  last_crawled_at: string;
}

export function BotCrawlCard({ professionalId, city }: BotCrawlCardProps) {
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!professionalId) return;
    supabase
      .rpc("run_sql" as any, {
        query: `SELECT total_crawls_30d, profile_crawls_30d, list_crawls_30d, bot_names_30d, last_crawled_at FROM agent_bot_crawl_stats WHERE agent_id = '${professionalId.replace(/'/g, "''")}'`,
      })
      .then(({ data }: any) => {
        const rows = data as CrawlStats[] | null;
        if (rows && rows.length > 0) setStats(rows[0]);
        setLoading(false);
      });
  }, [professionalId]);

  if (loading || !stats || stats.total_crawls_30d === 0) return null;

  const aiBots = (stats.bot_names_30d || []).filter((b) => !SEO_BOTS.has(b));
  const displayBots = [...new Set(aiBots.map((b) => BOT_DISPLAY[b] || b))].sort();
  const pct = Math.min(100, Math.round((stats.total_crawls_30d / 500) * 100));

  return (
    <div className="rounded-lg border bg-muted/30 p-4 sm:col-span-2">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-primary" />
        <p className="text-xs text-muted-foreground uppercase tracking-wide">AI Activity on Your Profile</p>
      </div>

      {/* Progress bar */}
      <div className="flex items-end gap-3 mb-3">
        <div className="flex-1">
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="text-xl font-bold leading-none">{stats.total_crawls_30d}</span>
        <span className="text-xs text-muted-foreground leading-none mb-0.5">crawls (30d)</span>
      </div>

      {/* Bot pills */}
      {displayBots.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5">
            {displayBots.length} AI system{displayBots.length !== 1 ? "s" : ""} have crawled your profile:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {displayBots.map((bot) => (
              <span key={bot} className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                {bot}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-muted-foreground mb-3">
        <span>Profile views: <strong className="text-foreground">{stats.profile_crawls_30d}</strong></span>
        <span>List appearances: <strong className="text-foreground">{stats.list_crawls_30d}</strong></span>
        {stats.last_crawled_at && (
          <span>Last crawled: <strong className="text-foreground">{timeAgo(stats.last_crawled_at)}</strong></span>
        )}
      </div>

      {/* Context blurb */}
      <div className="rounded border border-primary/10 bg-primary/5 px-3 py-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          When consumers ask AI for agent recommendations
          {city ? ` in ${city}` : ""}, these systems reference your verified credentials on Top10Lists.us.
          Agents on Audited or Underwritten tiers give AI systems 3-5x more verified data to cite.
        </p>
      </div>
    </div>
  );
}
