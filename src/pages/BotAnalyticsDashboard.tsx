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
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7d");

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    
    const daysAgo = dateRange === "24h" ? 1 : dateRange === "7d" ? 7 : 30;
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    // Summary stats
    const { data: summaryData } = await supabase
      .from("cloudflare_request_logs")
      .select("*")
      .eq("is_bot", true)
      .gte("timestamp", startDate);

    if (summaryData) {
      const hits = summaryData.filter(r => r.cache_status === 'HIT').length;
      const total = summaryData.length;
      const uniqueAgents = new Set(
        summaryData
          .map(r => r.path?.match(/\/([^\/]+)\/([^\/]+)\/([^\/]+)/)?.[3])
          .filter(Boolean)
      ).size;

      setSummary({
        total_bot_visits: total,
        unique_bots: new Set(summaryData.map(r => r.bot_type)).size,
        unique_agents_viewed: uniqueAgents,
        cache_hit_rate: total > 0 ? (hits / total) * 100 : 0,
      });
    }

    // Bot type breakdown
    const { data: botData } = await supabase.rpc('get_bot_stats', {
      start_date: startDate
    });

    if (botData) {
      setBotStats(botData);
    }

    // Agent-specific views
    const { data: agentData } = await supabase
      .from("cloudflare_request_logs")
      .select("path, bot_type, timestamp, cache_status, user_agent")
      .eq("is_bot", true)
      .gte("timestamp", startDate)
      .like("path", "%top10%")
      .order("timestamp", { ascending: false })
      .limit(100);

    if (agentData) {
      const views = agentData
        .map(record => {
          const match = record.path?.match(/\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
          return match ? {
            agent_slug: match[3],
            bot_type: record.bot_type || 'unknown',
            viewed_at: record.timestamp,
            cache_status: record.cache_status || 'UNKNOWN',
            user_agent: record.user_agent || '',
          } : null;
        })
        .filter((v): v is AgentView => v !== null);

      setAgentViews(views);
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
            Track AI bot visits and agent profile views
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
              {summary?.cache_hit_rate.toFixed(1)}%
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
      </Tabs>
    </div>
  );
}
