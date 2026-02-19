import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bot, TrendingUp, Eye, Activity } from "lucide-react";
import { format } from "date-fns";

interface BotStat {
  bot_type: string;
  total_visits: number;
  cache_hits: number;
  cache_misses: number;
}

interface AgentView {
  agent_slug: string;
  bot_type: string;
  viewed_at: string;
  cache_status: string;
  user_agent: string;
}

interface ListPageView {
  location_display: string;
  list_page_type: "city" | "neighborhood";
  bot_type: string;
  viewed_at: string;
  cache_status: string;
  agents_shown: { canonical_slug: string; name: string }[];
}

// Report only MAIN (www.top10lists.us). Staging has no crawl / noindex.
const MAIN_HOST = "www.top10lists.us";

/** Returns agent slug only when path is an agent profile URL (canonical or legacy); otherwise null. */
function getAgentSlugFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  // Canonical: /state/agents/canonical-slug
  const canonicalMatch = path.match(/\/[^/]+\/agents\/([^/?#]+)/);
  if (canonicalMatch) {
    const slug = canonicalMatch[1];
    if (slug && !/^\d{5}$/.test(slug)) return slug;
    return null;
  }
  // Legacy: /state/city/top10realestateagents/agent-slug
  const legacyMatch = path.match(/\/[^/]+\/[^/]+\/top10realestateagents\/([^/?#]+)/);
  if (legacyMatch) {
    const slug = legacyMatch[1];
    if (!slug || slug === "top10realestateagents" || /^\d{5}$/.test(slug)) return null;
    return slug;
  }
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

    // Bot type breakdown (MAIN only) – same filter as summary
    const { data: botData } = await supabase.rpc('get_bot_stats', {
      start_date: startDate
    });

    if (botData) {
      setBotStats(botData);
      // Derive summary from same data so summary and table always match (no separate get_bot_summary RPC)
      const total = botData.reduce((s, r) => s + Number(r.total_visits ?? 0), 0);
      const hits = botData.reduce((s, r) => s + Number(r.cache_hits ?? 0), 0);
      const misses = botData.reduce((s, r) => s + Number(r.cache_misses ?? 0), 0);
      const hitRate = hits + misses > 0 ? (100 * hits / (hits + misses)) : 0;
      setSummary(prev => ({
        total_bot_visits: total,
        unique_bots: botData.length,
        unique_agents_viewed: prev?.unique_agents_viewed ?? 0, // set below from agentData
        cache_hit_rate: hitRate,
      }));
    } else {
      setSummary({ total_bot_visits: 0, unique_bots: 0, unique_agents_viewed: 0, cache_hit_rate: 0 });
    }

    // Agent-specific views (MAIN only): only paths that are agent profile URLs
    // Use same host filter as get_bot_stats: host = www OR (host IS NULL and url contains www)
    const { data: agentData } = await supabase
      .from("cloudflare_request_logs")
      .select("path, bot_type, timestamp, cache_status, user_agent, host, url")
      .eq("is_bot", true)
      .gte("timestamp", startDate)
      .or("path.ilike.%/agents/%,path.ilike.%/top10realestateagents/%")
      .order("timestamp", { ascending: false })
      .limit(500);

    if (agentData) {
      // Restrict to MAIN (www) in JS so we match get_bot_stats when host column is NULL
      const mainData = agentData.filter(
        r => r.host === MAIN_HOST || (r.host == null && r.url?.toLowerCase().includes('www.top10lists.us'))
      );
      const views = mainData
        .map(record => {
          const agent_slug = getAgentSlugFromPath(record.path);
          if (!agent_slug) return null;
          return {
            agent_slug,
            bot_type: record.bot_type || 'unknown',
            viewed_at: record.timestamp,
            cache_status: record.cache_status || 'UNKNOWN',
            user_agent: record.user_agent || '',
          } as AgentView;
        })
        .filter((v): v is AgentView => v !== null);

      setAgentViews(views);
      const uniqueAgents = new Set(views.map(v => v.agent_slug)).size;
      setSummary(prev => prev ? { ...prev, unique_agents_viewed: uniqueAgents } : { total_bot_visits: 0, unique_bots: 0, unique_agents_viewed: uniqueAgents, cache_hit_rate: 0 });
    }

    // List page crawls (MAIN only): same host filter as get_bot_stats
    const { data: listPageRaw } = await supabase
      .from("cloudflare_request_logs")
      .select("list_page_type, location_display, agents_shown, bot_type, timestamp, cache_status, host, url")
      .eq("is_bot", true)
      .gte("timestamp", startDate)
      .not("list_page_type", "is", null)
      .order("timestamp", { ascending: false })
      .limit(100);

    if (listPageRaw) {
      const listPageData = listPageRaw.filter(
        r => r.host === MAIN_HOST || (r.host == null && r.url?.toLowerCase().includes('www.top10lists.us'))
      );
      setListPageViews(
        listPageData
          .filter((r): r is typeof r & { location_display: string; list_page_type: "city" | "neighborhood" } =>
            r.list_page_type != null && r.location_display != null
          )
          .map(r => ({
            location_display: r.location_display,
            list_page_type: r.list_page_type,
            bot_type: r.bot_type || "unknown",
            viewed_at: r.timestamp,
            cache_status: r.cache_status || "UNKNOWN",
            agents_shown: Array.isArray(r.agents_shown) ? r.agents_shown : [],
          }))
      );
    }

    setLoading(false);
  };

  const getBotColor = (botType: string) => {
    const colors: Record<string, string> = {
      googlebot: "bg-blue-500",
      claudebot: "bg-purple-500",
      gptbot: "bg-green-500",
      bingbot: "bg-orange-500",
      perplexitybot: "bg-pink-500",
    };
    return colors[botType] || "bg-gray-500";
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
            Track AI bot visits and cache hits on MAIN (www.top10lists.us) only
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
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.cache_hit_rate ?? 0).toFixed(1)}%
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
                    <TableRow key={stat.bot_type}>
                      <TableCell>
                        <Badge className={getBotColor(stat.bot_type)}>
                          {stat.bot_type || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {stat.total_visits}
                      </TableCell>
                      <TableCell className="text-right">{stat.cache_hits}</TableCell>
                      <TableCell className="text-right">{stat.cache_misses}</TableCell>
                      <TableCell className="text-right">
                        {stat.total_visits > 0
                          ? ((stat.cache_hits / stat.total_visits) * 100).toFixed(1)
                          : 0}%
                      </TableCell>
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
                        <Badge className={getBotColor(view.bot_type)}>
                          {view.bot_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={view.cache_status === 'HIT' ? 'default' : 'secondary'}>
                          {view.cache_status}
                        </Badge>
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
                          <Badge className={getBotColor(view.bot_type)}>{view.bot_type}</Badge>
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
                          <Badge variant={view.cache_status === "HIT" ? "default" : "secondary"}>
                            {view.cache_status}
                          </Badge>
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
