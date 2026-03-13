import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, TrendingUp, Eye, Activity, Bell, BellOff } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface BotStat {
  bot_name: string;
  total_visits: number;
}

interface BotVisit {
  crawled_at: string;
  bot_name: string;
  page_path: string;
  user_agent: string;
}

interface SummaryStats {
  total_bot_visits: number;
  unique_bots: number;
  profile_visits: number;
  artifact_visits: number;
  cache_hit_rate: number;
}

interface NotificationPreferences {
  email_notifications_enabled: boolean;
  notification_frequency: string;
  notify_for_bots: string[];
}

export default function AgentBotAnalyticsDashboard() {
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [botStats, setBotStats] = useState<BotStat[]>([]);
  const [recentVisits, setRecentVisits] = useState<BotVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7d");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAgentData();
  }, []);

  useEffect(() => {
    if (agentId) {
      loadAnalytics();
    }
  }, [dateRange, agentId]);

  const loadAgentData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to view your bot analytics",
        variant: "destructive"
      });
      return;
    }

    // Get agent ID from user
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('email', user.email)
      .single();

    if (professional) {
      setAgentId(professional.id);
      
      // Load notification preferences
      const { data: prefs } = await supabase
        .from('agent_bot_notification_preferences')
        .select('*')
        .eq('agent_id', professional.id)
        .single();
      
      if (prefs) {
        setNotificationPrefs(prefs);
      } else {
        // Create default preferences
        const { data: newPrefs } = await supabase
          .from('agent_bot_notification_preferences')
          .insert({
            agent_id: professional.id,
            email_notifications_enabled: true,
            notification_frequency: 'daily',
            notify_for_bots: ['googlebot', 'claudebot', 'gptbot', 'perplexitybot']
          })
          .select()
          .single();
        
        if (newPrefs) setNotificationPrefs(newPrefs);
      }
    }
  };

  const loadAnalytics = async () => {
    if (!agentId) return;
    
    setLoading(true);
    
    const daysAgo = dateRange === "24h" ? 1 : dateRange === "7d" ? 7 : 30;
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    // All aggregation done server-side via run_sql to avoid PostgREST 1000-row cap

    // 1. Summary counts for this agent
    const { data: summaryRaw } = await supabase.rpc("run_sql", { query: `
      SELECT
        COUNT(*)::int                                               AS total_visits,
        COUNT(DISTINCT bot_name)::int                              AS unique_bots,
        COUNT(*) FILTER (WHERE page_path LIKE '%/agents/%')::int   AS profile_visits
      FROM bot_crawl_logs
      WHERE agent_id = '${agentId}'
        AND crawled_at >= '${startDate}'
    ` });
    const s = Array.isArray(summaryRaw) ? summaryRaw[0] : null;
    setSummary({
      total_bot_visits:  s?.total_visits   ?? 0,
      unique_bots:       s?.unique_bots    ?? 0,
      profile_visits:    s?.profile_visits ?? 0,
      artifact_visits:   0,
      cache_hit_rate:    0,
    });

    // 2. Bot breakdown for this agent
    const { data: botBreakdown } = await supabase.rpc("run_sql", { query: `
      SELECT bot_name, COUNT(*)::int AS total_visits
      FROM bot_crawl_logs
      WHERE agent_id = '${agentId}'
        AND crawled_at >= '${startDate}'
      GROUP BY bot_name
      ORDER BY total_visits DESC
    ` });
    setBotStats(
      (Array.isArray(botBreakdown) ? botBreakdown : []).map((r: any) => ({
        bot_name: r.bot_name || "Unknown",
        total_visits: r.total_visits,
      }))
    );

    // 3. Recent visits (capped at 50 -- display only)
    const { data: recentRaw } = await supabase.rpc("run_sql", { query: `
      SELECT bot_name, page_path, crawled_at, user_agent
      FROM bot_crawl_logs
      WHERE agent_id = '${agentId}'
        AND crawled_at >= '${startDate}'
      ORDER BY crawled_at DESC
      LIMIT 50
    ` });
    setRecentVisits((Array.isArray(recentRaw) ? recentRaw : []) as BotVisit[]);

    setLoading(false);
  };

  const toggleNotifications = async () => {
    if (!agentId || !notificationPrefs) return;

    const newEnabled = !notificationPrefs.email_notifications_enabled;

    const { error } = await supabase
      .from('agent_bot_notification_preferences')
      .update({ email_notifications_enabled: newEnabled })
      .eq('agent_id', agentId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive"
      });
      return;
    }

    setNotificationPrefs({ ...notificationPrefs, email_notifications_enabled: newEnabled });
    toast({
      title: newEnabled ? "Notifications Enabled" : "Notifications Disabled",
      description: newEnabled 
        ? "You'll receive daily emails about bot visits"
        : "Bot visit notifications have been disabled"
    });
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
          <h1 className="text-3xl font-bold">Your Bot Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Track AI bot visits to your profile and certification artifact
          </p>
        </div>
        
        <div className="flex gap-2 items-center">
          <Button
            variant={notificationPrefs?.email_notifications_enabled ? "default" : "outline"}
            size="sm"
            onClick={toggleNotifications}
          >
            {notificationPrefs?.email_notifications_enabled ? (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Notifications On
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 mr-2" />
                Notifications Off
              </>
            )}
          </Button>
          
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
              To your profile and artifact
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
              Different AI systems
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profile Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.profile_visits || 0}</div>
            <p className="text-xs text-muted-foreground">
              Agent profile page visits
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
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
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
                      <TableCell>
                        <Badge className={getBotColor(stat.bot_name)}>
                          {stat.bot_name || "unknown"}
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

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Bot Visits</CardTitle>
              <CardDescription>
                Latest AI bot visits to your profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bot Type</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Cache Status</TableHead>
                    <TableHead>Visited At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentVisits.map((visit, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Badge className={getBotColor(visit.bot_name)}>
                          {visit.bot_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {visit.page_path?.includes('/artifact/') ? '📜 Artifact' : '👤 Profile'}
                      </TableCell>
                      <TableCell>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(visit.crawled_at), "MMM d, yyyy HH:mm")}
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

