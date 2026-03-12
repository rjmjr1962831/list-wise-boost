import { useState, useEffect } from "react";
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
  bot_name: string;
  viewed_at: string;
  user_agent: string;
  source: "profile" | "list";
}

interface ListCrawl {
  page_path: string;
  location_label: string;
  page_type: "city" | "neighborhood";
  bot_name: string;
  agent_count: number;
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
        COUNT(DISTINCT page_path)
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

    // 3. Recent agent views -- both direct profile hits and city-page coverage
    //    Direct profile hits: join professionals to get canonical_slug
    //    City-page hits: agent_id is set but path is the list page
    const { data: recentRaw } = await supabase.rpc("run_sql", { query: `
      SELECT
        p.canonical_slug                          AS agent_slug,
        b.bot_name,
        b.page_path,
        b.crawled_at,
        b.user_agent,
        CASE WHEN b.page_path LIKE '%/agents/%' THEN 'profile' ELSE 'list' END AS source
      FROM bot_crawl_logs b
      JOIN professionals p ON p.id = b.agent_id
      WHERE b.crawled_at >= '${startDate}'
      ORDER BY b.crawled_at DESC
      LIMIT 300
    ` });
    setAgentViews(
      (Array.isArray(recentRaw) ? recentRaw : []).map((r: any) => ({
        agent_slug: r.agent_slug || r.page_path,
        bot_name:   r.bot_name || "Unknown",
        viewed_at:  r.crawled_at,
        user_agent: r.user_agent || "",
        source:     r.source || "profile",
      }))
    );

    // 4. List page crawls -- one row per distinct (page_path, bot_name) event window
    const { data: listRaw } = await supabase.rpc("run_sql", { query: `
      SELECT
        page_path,
        bot_name,
        COUNT(DISTINCT agent_id)::int   AS agent_count,
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
          agent_count:    r.agent_count,
          last_crawled:   r.last_crawled,
        } as ListCrawl;
      })
    );

    setLoading(false);
  };

  const getBotColor = (botName: string) => {
    const colors: Record<string, string> = {
      "Googlebot": "bg-blue-500",
      "Google-Extended": "bg-blue-400",
      "ClaudeBot": "bg-purple-500",
      "Anthropic-AI": "bg-violet-500",
      "GPTBot": "bg-green-500",
      "ChatGPT-User": "bg-green-400",
      "OAI-SearchBot": "bg-emerald-500",
      "Bingbot": "bg-orange-500",
      "PerplexityBot": "bg-pink-500",
      "Twitterbot": "bg-sky-500",
      "LinkedInBot": "bg-blue-700",
      "Meta-ExternalAgent": "bg-indigo-500",
      "AhrefsBot": "bg-yellow-500",
      "SEMrushBot": "bg-amber-500",
      "ByteSpider": "bg-teal-500",
      "Applebot": "bg-gray-400",
      "YandexBot": "bg-red-500",
    };
    return colors[botName] || "bg-gray-500";
  };

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
            <CardTitle className="text-sm font-medium">Agents Covered</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.unique_agents_covered || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Via profile or list page</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">List Pages Crawled</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.list_page_crawls || 0}</div>
            <p className="text-xs text-muted-foreground">City and neighborhood pages</p>
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
                            <Badge className={getBotColor(stat.bot_name)}>
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
                Agents seen by bots -- via direct profile visit or city/neighborhood list page (most recent 300)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>User Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentViews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No agent coverage recorded in this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    agentViews.map((view, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{view.agent_slug}</TableCell>
                        <TableCell>
                          <Badge className={getBotColor(view.bot_name)}>
                            {view.bot_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={view.source === "profile" ? "default" : "secondary"}>
                            {view.source === "profile" ? "Profile" : "List page"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(view.viewed_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {view.user_agent}
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
                Each row is a distinct (page, bot) combination. Agent count shows how many listed agents received coverage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead className="text-right">Agents Covered</TableHead>
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
                          <Badge className={getBotColor(crawl.bot_name)}>
                            {crawl.bot_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{crawl.agent_count}</TableCell>
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
