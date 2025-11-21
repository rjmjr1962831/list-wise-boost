import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Database,
  Users,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CityStats {
  city_id: string;
  city_name: string;
  total_agents: number;
  enriched_count: number;
  qualifying_agents: number;
  needs_enrichment: number;
  recent_enrichments: number;
}

interface RecentAgent {
  id: string;
  name: string;
  city_name: string;
  zillow_data_fetched_at: string;
  review_stars_rating: number;
  num_total_reviews: number;
}

interface EnrichmentAlert {
  id: string;
  timestamp: string;
  city: string;
  state: string;
  totalAttempts: number;
  error403Count: number;
  error403Rate: string;
  enrichedCount: number;
  reusedCount: number;
  remainingAgents: number;
  lastFailedAgent: string;
}

export function EnrichmentProgressDashboard() {
  const [stats, setStats] = useState<CityStats[]>([]);
  const [recentAgents, setRecentAgents] = useState<RecentAgent[]>([]);
  const [alerts, setAlerts] = useState<EnrichmentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchStats = async () => {
    try {
      // Try to get enrichment stats by city - use direct query since RPC might not exist
      const { data: agentData, error: agentError } = await supabase
        .from('professionals')
        .select(`
          city_id,
          cities!inner(name),
          professional_information,
          review_stars_rating,
          num_total_reviews,
          zillow_profile_url,
          zillow_data_fetched_at
        `)
        .eq('category_id', '1384f127-fc2e-4693-9b8f-406451adf3aa')
        .eq('active', true);

      if (!agentError && agentData) {
        // Aggregate manually
        const cityMap = new Map<string, CityStats>();
        
        agentData.forEach((agent: any) => {
          const cityId = agent.city_id;
          const cityName = agent.cities.name;
          
          if (!cityMap.has(cityId)) {
            cityMap.set(cityId, {
              city_id: cityId,
              city_name: cityName,
              total_agents: 0,
              enriched_count: 0,
              qualifying_agents: 0,
              needs_enrichment: 0,
              recent_enrichments: 0
            });
          }

          const stats = cityMap.get(cityId)!;
          stats.total_agents++;

          if (agent.professional_information) {
            stats.enriched_count++;
            
            // Check if enriched recently (last 24 hours)
            if (agent.zillow_data_fetched_at) {
              const enrichedAt = new Date(agent.zillow_data_fetched_at);
              const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
              if (enrichedAt > oneDayAgo) {
                stats.recent_enrichments++;
              }
            }
          }

          if (agent.review_stars_rating >= 4.9 && agent.num_total_reviews >= 200) {
            stats.qualifying_agents++;
          }

          if (agent.zillow_profile_url && !agent.professional_information) {
            stats.needs_enrichment++;
          }
        });

        setStats(Array.from(cityMap.values()).sort((a, b) => b.total_agents - a.total_agents));
      }

      // Get recently enriched agents
      const { data: recent } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          cities!inner(name),
          zillow_data_fetched_at,
          review_stars_rating,
          num_total_reviews
        `)
        .eq('category_id', '1384f127-fc2e-4693-9b8f-406451adf3aa')
        .not('zillow_data_fetched_at', 'is', null)
        .order('zillow_data_fetched_at', { ascending: false })
        .limit(10);

      if (recent) {
        setRecentAgents(recent.map((agent: any) => ({
          ...agent,
          city_name: agent.cities.name
        })));
      }

      // Fetch enrichment alerts
      const { data: alertsData } = await supabase
        .from('marketing_content')
        .select('*')
        .eq('page', 'admin')
        .eq('section', 'enrichment_alert')
        .eq('type', 'error')
        .order('created_at', { ascending: false })
        .limit(5);

      if (alertsData) {
        const parsedAlerts = alertsData.map((alert: any) => {
          try {
            return {
              id: alert.id,
              ...JSON.parse(alert.value)
            };
          } catch {
            return null;
          }
        }).filter(Boolean);
        setAlerts(parsedAlerts as EnrichmentAlert[]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const dismissAlert = async (alertId: string) => {
    await supabase
      .from('marketing_content')
      .delete()
      .eq('id', alertId);
    setAlerts(alerts.filter(a => a.id !== alertId));
  };

  useEffect(() => {
    fetchStats();

    if (autoRefresh) {
      const interval = setInterval(fetchStats, 60000); // Refresh every 60 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const totalStats = stats.reduce(
    (acc, city) => ({
      total: acc.total + city.total_agents,
      enriched: acc.enriched + city.enriched_count,
      qualifying: acc.qualifying + city.qualifying_agents,
      needsEnrichment: acc.needsEnrichment + city.needs_enrichment,
      recent: acc.recent + city.recent_enrichments
    }),
    { total: 0, enriched: 0, qualifying: 0, needsEnrichment: 0, recent: 0 }
  );

  const overallProgress = totalStats.total > 0 
    ? (totalStats.enriched / totalStats.total) * 100 
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enrichment Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Alert key={alert.id} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>Enrichment Stopped - High 403 Error Rate</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissAlert(alert.id)}
                >
                  Dismiss
                </Button>
              </AlertTitle>
              <AlertDescription>
                <div className="mt-2 space-y-1 text-sm">
                  <p><strong>Location:</strong> {alert.city}, {alert.state}</p>
                  <p><strong>403 Error Rate:</strong> {alert.error403Rate} ({alert.error403Count}/{alert.totalAttempts} attempts)</p>
                  <p><strong>Progress:</strong> {alert.enrichedCount} enriched, {alert.reusedCount} reused, {alert.remainingAgents} remaining</p>
                  <p><strong>Last Failed Agent:</strong> {alert.lastFailedAgent}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">{totalStats.total.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enriched
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{totalStats.enriched.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Qualifying (4.9+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold">{totalStats.qualifying.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Needs Enrichment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-2xl font-bold">{totalStats.needsEnrichment.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-500" />
              <span className="text-2xl font-bold">{totalStats.recent.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Overall Enrichment Progress</CardTitle>
              <CardDescription>
                {totalStats.enriched.toLocaleString()} of {totalStats.total.toLocaleString()} agents enriched
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={overallProgress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {overallProgress.toFixed(1)}% complete
          </p>
        </CardContent>
      </Card>

      {/* City-by-City Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>City Breakdown</CardTitle>
          <CardDescription>Enrichment status by city</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {stats.map((city) => {
                const progress = city.total_agents > 0 
                  ? (city.enriched_count / city.total_agents) * 100 
                  : 0;

                return (
                  <div key={city.city_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{city.city_name}</span>
                        {city.recent_enrichments > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{city.recent_enrichments} today
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {city.enriched_count}/{city.total_agents}
                        </span>
                        <span className="font-medium">{progress.toFixed(0)}%</span>
                      </div>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {city.qualifying_agents} qualifying
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {city.needs_enrichment} pending
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recently Enriched Agents */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Enriched Agents</CardTitle>
          <CardDescription>Last 10 agents processed</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {recentAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                >
                  <div className="flex-1">
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-sm text-muted-foreground">{agent.city_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {agent.review_stars_rating}★ ({agent.num_total_reviews} reviews)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(agent.zillow_data_fetched_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
