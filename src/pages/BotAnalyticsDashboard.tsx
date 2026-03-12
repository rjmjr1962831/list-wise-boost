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
}

/** Returns agent slug from canonical path /state/agents/slug */
function getAgentSlugFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const m = path.match(/\/[^/]+\/agents\/([^/?#]+)/);
  if (m && m[1] && !/^\d{5}$/.test(m[1])) return m[1];
  return null;
}

interface SummaryStats {
  total_bot_visits: number;
  unique_bots: number;
  unique_agents_viewed: number;
  cache_hit_rate: number;
}

export default function BotAnalyticsDashboard() {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [botStats, setBotStats] = useState<BotStat[]>([]);
  const [agentViews, setAgentViews] = useState<AgentView[]>([]);
  const [listPageViews, setListPageViews] = useState<ListPageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7d");

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    
    const daysAgo = dateRange === "24h" ? 1 : dateRange === "7d" ? 7 : 30;
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    // Bot breakdown from bot_crawl_logs
    const { data: botData } = await supabase
      .from("bot_crawl_logs")
      .select("bot_name, agent_id, page_path, crawled_at, user_agent")
      .gte("crawled_at", startDate)
      .order("crawled_at", { ascending: false })
      .limit(5000);

    if (botData && botData.length > 0) {
      // Aggregate by bot_name
      const byBot = botData.reduce((acc, r) => {
        const k = r.bot_name || "Unknown";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const stats: BotStat[] = Object.entries(byBot)
        .map(([bot_name, total_visits]) => ({ bot_name, total_visits }))
        .sort((a, b) => b.total_visits - a.total_visits);

      setBotStats(stats);

      // Agent views
      const views: AgentView[] = botData
        .map(r => {
          const agent_slug = getAgentSlugFromPath(r.page_path);
          if (!agent_slug) return null;
          return {
            agent_slug,
            bot_name: r.bot_name || "Unknown",
            viewed_at: r.crawled_at,
            user_agent: r.user_agent || "",
          } as AgentView;
        })
        .filter((v): v is AgentView => v !== null);

      setAgentViews(views);

      const uniqueAgents = new Set(views.map(v => v.agent_slug)).size;
      const uniqueBots = Object.keys(byBot).length;

      setSummary({
        total_bot_visits: botData.length,
        unique_bots: uniqueBots,
        unique_agents_viewed: uniqueAgents,
        cache_hit_rate: 0,
      });
    } else {
      setBotStats([]);
      setAgentViews([]);
      setSummary({ total_bot_visits: 0, unique_bots: 0, unique_agents_viewed: 0, cache_hit_rate: 0 });
    }

    setLoading(false);
  };

  const getBotColor = (botName: string) => {
    const colors: Record<string, string> = {
      "Googlebot": "bg-blue-500",
      "ClaudeBot": "bg-purple-500",
      "GPTBot": "bg-green-500",
      "Bingbot": "bg-orange-500",
      "PerplexityBot": "bg-pink-500",
      "Anthropic-AI": "bg-violet-500",
      "Twitterbot": "bg-sky-500",
      "LinkedInBot": "bg-blue-700",
      "AhrefsBot": "bg-yellow-500",
      "SEMrushBot": "bg-amber-500",
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
            Track AI and search bot crawls of agent profiles on top10lists.us
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
            <div className="text-2xl font-bold">{summary?.total_bot_visits || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all pages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Bots</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.unique_bots || 0}</div>
            <p className="text-xs text-muted-foreground">
              Different bot types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents Viewed</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.unique_agents_viewed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Agent profiles seen by bots
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bot Types Seen</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.unique_bots ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Served from cache
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="bots" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bots">Bot Breakdown</TabsTrigger>
          <TabsTrigger value="agents">Agent Views</TabsTrigger>
          <TabsTrigger value="list-pages">List page crawls</TabsTrigger>
        </TabsList>

        <TabsContent value="bots" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Bot Activity by Type</CardTitle>
              <CardDescription>
                Breakdown of visits by AI bot type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bot Type</TableHead>
                    <TableHead className="text-right">Total Visits</TableHead>
                    <TableHead className="text-right">Cache Hits</TableHead>
                    <TableHead className="text-right">Cache Misses</TableHead>
                    <TableHead className="text-right">Hit Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {botStats.map((stat) => (
                    <TableRow key={stat.bot_name}>
                      
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Agent Profile Views</CardTitle>
              <CardDescription>
                Individual agent profiles viewed by AI bots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Slug</TableHead>
                    <TableHead>Bot Type</TableHead>
                    <TableHead>Cache Status</TableHead>
                    <TableHead>Viewed At</TableHead>
                    <TableHead>User Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentViews.map((view, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {view.agent_slug}
                      </TableCell>
                      <TableCell>
                        <Badge className={getBotColor(view.bot_name)}>
                          {view.bot_name}
                        </Badge>
                      </TableCell>
                      <TableCell>

                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(view.viewed_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {view.user_agent}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list-pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Neighborhood &amp; city list crawls</CardTitle>
              <CardDescription>
                When a bot crawled a city or neighborhood list page, which location and which agents were shown (up to 10 per page)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead>Agents shown</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Cache</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listPageViews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No list page crawls in this period. Data is recorded when bots hit city or neighborhood list pages.
                      </TableCell>
                    </TableRow>
                  ) : (
                    listPageViews.map((view, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{view.location_display}</TableCell>
                        <TableCell>
                          <Badge variant={view.list_page_type === "neighborhood" ? "default" : "secondary"}>
                            {view.list_page_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getBotColor(view.bot_name)}>{view.bot_name}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <span className="text-sm" title={view.agents_shown.map(a => a.name).join(", ")}>
                            {view.agents_shown.length} agent{view.agents_shown.length !== 1 ? "s" : ""}:{" "}
                            {view.agents_shown.map(a => a.name || a.canonical_slug).join(", ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(view.viewed_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>

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

