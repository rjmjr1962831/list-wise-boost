import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bot, TrendingUp, Eye, Activity } from "lucide-react";
import { format } from "date-fns";

interface BotStat {
  bot_name: string;
  total_visits: number;
}

interface AgentView {
  agent_slug: string;
  total_crawls: number;
  profile_hits: number;
  list_hits: number;
  bots: string[];         // distinct bot names
  last_seen: string;
}

interface ListCrawl {
  page_path: string;
  location_label: string;
  page_type: "city" | "neighborhood";
  bot_name: string;
  crawl_count: number;
  last_crawled: string;
}

interface SummaryStats {
  total_bot_visits: number;
  unique_bots: number;
  unique_agents_covered: number;
  list_page_crawls: number;
}

export default function BotAnalyticsDashboard() {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [botStats, setBotStats] = useState<BotStat[]>([]);
  const [agentViews, setAgentViews] = useState<AgentView[]>([]);
  const [listCrawls, setListCrawls] = useState<ListCrawl[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7d");

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);

    const daysAgo = dateRange === "24h" ? 1 : dateRange === "7d" ? 7 : 30;
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    // All aggregation server-side via run_sql -- no PostgREST row-cap risk

    // 1. Summary
    const { data: summaryRaw } = await supabase.rpc("run_sql", { query: `
      SELECT
        COUNT(*)::int                       AS total_visits,
        COUNT(DISTINCT bot_name)::int       AS unique_bots,
        COUNT(DISTINCT agent_id)::int       AS unique_agents_covered,
        COUNT(*)
          FILTER (WHERE page_path NOT LIKE '%/agents/%')::int AS list_page_crawls
      FROM bot_crawl_logs
      WHERE crawled_at >= '${startDate}'
    ` });
    const s = Array.isArray(summaryRaw) ? summaryRaw[0] : null;
    setSummary({
      total_bot_visits:      s?.total_visits         ?? 0,
      unique_bots:           s?.unique_bots          ?? 0,
      unique_agents_covered: s?.unique_agents_covered ?? 0,
      list_page_crawls:      s?.list_page_crawls     ?? 0,
    });

    // 2. Bot breakdown
    const { data: botBreakdown } = await supabase.rpc("run_sql", { query: `
      SELECT bot_name, COUNT(*)::int AS total_visits
      FROM bot_crawl_logs
      WHERE crawled_at >= '${startDate}'
      GROUP BY bot_name
      ORDER BY total_visits DESC
    ` });
    setBotStats(
      (Array.isArray(botBreakdown) ? botBreakdown : []).map((r: any) => ({
        bot_name: r.bot_name || "Unknown",
        total_visits: r.total_visits,
      }))
    );

    // 3. Agent coverage -- one row per agent, aggregated
    const { data: recentRaw } = await supabase.rpc("run_sql", { query: `
      SELECT
        p.canonical_slug                                              AS agent_slug,
        COUNT(*)::int                                                 AS total_crawls,
        COUNT(*) FILTER (WHERE b.page_path LIKE '%/agents/%')::int   AS profile_hits,
        COUNT(*) FILTER (WHERE b.page_path NOT LIKE '%/agents/%')::int AS list_hits,
        array_agg(DISTINCT b.bot_name)                               AS bots,
        MAX(b.crawled_at)                                            AS last_seen
      FROM bot_crawl_logs b
      JOIN professionals p ON p.id = b.agent_id
      WHERE b.crawled_at >= '${startDate}'
      GROUP BY p.canonical_slug
      ORDER BY total_crawls DESC
      LIMIT 300
    ` });
    setAgentViews(
      (Array.isArray(recentRaw) ? recentRaw : []).map((r: any) => ({
        agent_slug:   r.agent_slug || "unknown",
        total_crawls: r.total_crawls,
        profile_hits: r.profile_hits,
        list_hits:    r.list_hits,
        bots:         Array.isArray(r.bots) ? r.bots.filter(Boolean) : [],
        last_seen:    r.last_seen,
      }))
    );

    // 4. List page crawls -- one row per distinct (page_path, bot_name) event window
    const { data: listRaw } = await supabase.rpc("run_sql", { query: `
      SELECT
        page_path,
        bot_name,
        COUNT(*)::int                   AS crawl_count,
        MAX(crawled_at)                 AS last_crawled
      FROM bot_crawl_logs
      WHERE crawled_at >= '${startDate}'
        AND page_path NOT LIKE '%/agents/%'
      GROUP BY page_path, bot_name
      ORDER BY last_crawled DESC
      LIMIT 100
    ` });
    setListCrawls(
      (Array.isArray(listRaw) ? listRaw : []).map((r: any) => {
        const parts = r.page_path?.split("/").filter(Boolean) || [];
        const isNh = parts.length >= 4;
        const location_label = isNh
          ? `${parts[3].replace(/-/g, " ")}, ${parts[1].replace(/-/g, " ")}`
          : `${parts[1]?.replace(/-/g, " ") || r.page_path}, ${parts[0] || ""}`;
        return {
          page_path:      r.page_path,
          location_label,
          page_type:      isNh ? "neighborhood" : "city",
          bot_name:       r.bot_name || "Unknown",
          crawl_count:    r.crawl_count,
          last_crawled:   r.last_crawled,
        } as ListCrawl;
      })
    );

    setLoading(false);
  };

  // Hex colors for bot badges -- avoids Tailwind purge and custom color override issues
  const BOT_COLORS: Record<string, string> = {
    "Googlebot":          "#3B82F6", // blue
    "Google-Extended":    "#60A5FA", // blue-light
    "GoogleOther":        "#93C5FD", // blue-lighter
    "ClaudeBot":          "#8B5CF6", // purple
    "Anthropic-AI":       "#7C3AED", // violet
    "Claude-Web":         "#A78BFA", // violet-light
    "GPTBot":             "#10B981", // emerald
    "ChatGPT-User":       "#34D399", // emerald-light
    "OAI-SearchBot":      "#059669", // emerald-dark
    "Bingbot":            "#F97316", // orange
    "BingPreview":        "#FB923C", // orange-light
    "PerplexityBot":      "#EC4899", // pink
    "Twitterbot":         "#0EA5E9", // sky
    "LinkedInBot":        "#1D4ED8", // blue-dark
    "Meta-ExternalAgent": "#6366F1", // indigo (hex, bypasses override)
    "FacebookExternalHit":"#4F46E5", // indigo-dark
    "AhrefsBot":          "#EAB308", // yellow
    "SEMrushBot":         "#F59E0B", // amber
    "ByteSpider":         "#14B8A6", // teal
    "Applebot":           "#9CA3AF", // gray
    "Applebot-Extended":  "#D1D5DB", // gray-light
    "YandexBot":          "#EF4444", // red
    "BaiduSpider":        "#DC2626", // red-dark
    "DuckDuckBot":        "#F87171", // red-light
    "CCBot":              "#6B7280", // gray-medium
    "AI2Bot":             "#0D9488", // teal-dark
    "Gemini":             "#4285F4", // google-blue
    "Mistral":            "#FF6B35", // coral
  };

  const getBotBadgeStyle = (botName: string): React.CSSProperties => ({
    backgroundColor: BOT_COLORS[botName] || "#6B7280",
    color: "#fff",
    border: "none",
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin">
          <Bot className="h-8 w-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Bot Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            AI and search bot crawl activity across top10lists.us
          </p>
        </div>

        <div className="flex gap-2">
          {["24h", "7d", "30d"].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg ${
                dateRange === range
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {range === "24h" ? "24 Hours" : range === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bot Visits</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.total_bot_visits || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all pages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Bot Types</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.unique_bots || 0}</div>
            <p className="text-xs text-muted-foreground">Distinct crawlers seen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents Seen by AI</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.unique_agents_covered || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Unique agents crawled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">List Page Crawls</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.list_page_crawls || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">City & neighborhood page hits</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bots">Bot Breakdown</TabsTrigger>
          <TabsTrigger value="agents">Agent Coverage</TabsTrigger>
          <TabsTrigger value="list-pages">List Page Crawls</TabsTrigger>
        </TabsList>

        {/* Bot Breakdown */}
        <TabsContent value="bots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bot Activity by Type</CardTitle>
              <CardDescription>Total crawl events per bot, across all page types</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bot</TableHead>
                    <TableHead className="text-right">Total Visits</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {botStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No bot activity in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    botStats.map((stat) => {
                      const total = summary?.total_bot_visits || 1;
                      const pct = ((stat.total_visits / total) * 100).toFixed(1);
                      return (
                        <TableRow key={stat.bot_name}>
                          <TableCell>
                            <Badge style={getBotBadgeStyle(stat.bot_name)}>
                              {stat.bot_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {stat.total_visits.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {pct}%
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent Coverage */}
        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Agent Coverage</CardTitle>
              <CardDescription>
                One row per agent. Profile = direct profile visit. List = appeared on a city or neighborhood page. Sorted by total crawls.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Profile</TableHead>
                    <TableHead className="text-right">List</TableHead>
                    <TableHead>Bots</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentViews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No agent coverage recorded in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentViews.map((view) => (
                      <TableRow key={view.agent_slug}>
                        <TableCell className="font-medium text-sm">{view.agent_slug}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{view.total_crawls}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">{view.profile_hits}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">{view.list_hits}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {view.bots.map((bot) => (
                              <Badge key={bot} style={getBotBadgeStyle(bot)} className="text-[10px] px-1.5 py-0">
                                {bot}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(view.last_seen), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* List Page Crawls */}
        <TabsContent value="list-pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>City and Neighborhood List Crawls</CardTitle>
              <CardDescription>
                Each row is a distinct (page, bot) combination. Page crawls shows how many times AI visited that listing page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead className="text-right">Page Crawls</TableHead>
                    <TableHead>Last Crawled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listCrawls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No list page crawls in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    listCrawls.map((crawl, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium capitalize">{crawl.location_label}</TableCell>
                        <TableCell>
                          <Badge variant={crawl.page_type === "neighborhood" ? "default" : "secondary"}>
                            {crawl.page_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge style={getBotBadgeStyle(crawl.bot_name)}>
                            {crawl.bot_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{crawl.crawl_count}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(crawl.last_crawled), "MMM d, yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

