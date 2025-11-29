import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp, 
  Users, 
  Activity,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface EnrichmentJob {
  id: string;
  city_name: string;
  category_name: string;
  status: string;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

interface EnrichedAgent {
  id: string;
  name: string;
  city_name: string;
  review_stars_rating: number;
  num_total_reviews: number;
  press_mentions: any;
  publications: any;
  notable_achievements: any;
  zillow_data_fetched_at: string;
  profile_last_synthesized_at: string;
}

export const EnrichmentResultsDashboard = () => {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [recentAgents, setRecentAgents] = useState<EnrichedAgent[]>([]);
  const [stats, setStats] = useState({
    totalJobs: 0,
    completedJobs: 0,
    runningJobs: 0,
    totalAgents: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      // Fetch enrichment jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('enrichment_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (jobsError) throw jobsError;

      // Fetch recently enriched agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('professionals')
        .select(`
          id,
          name,
          review_stars_rating,
          num_total_reviews,
          press_mentions,
          publications,
          notable_achievements,
          zillow_data_fetched_at,
          profile_last_synthesized_at,
          city_id,
          cities!inner(name)
        `)
        .not('zillow_data_fetched_at', 'is', null)
        .order('zillow_data_fetched_at', { ascending: false })
        .limit(20);

      if (agentsError) throw agentsError;

      // Transform agents data
      const transformedAgents = (agentsData || []).map((agent: any) => ({
        ...agent,
        city_name: agent.cities?.name || 'Unknown'
      }));

      setJobs(jobsData || []);
      setRecentAgents(transformedAgents);

      // Calculate stats
      const totalJobs = jobsData?.length || 0;
      const completedJobs = jobsData?.filter(j => j.status === 'completed').length || 0;
      const runningJobs = jobsData?.filter(j => j.status === 'running').length || 0;
      const totalSuccessful = jobsData?.reduce((sum, j) => sum + (j.successful_items || 0), 0) || 0;
      const totalProcessed = jobsData?.reduce((sum, j) => sum + (j.processed_items || 0), 0) || 0;

      setStats({
        totalJobs,
        completedJobs,
        runningJobs,
        totalAgents: totalSuccessful,
        successRate: totalProcessed > 0 ? (totalSuccessful / totalProcessed) * 100 : 0,
      });

    } catch (error) {
      console.error('Error fetching enrichment data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup realtime subscription for enrichment_queue
    const channel = supabase
      .channel('enrichment-results')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrichment_queue'
        },
        () => {
          if (autoRefresh) {
            fetchData();
          }
        }
      )
      .subscribe();

    // Auto-refresh every 10 seconds if enabled
    const interval = autoRefresh ? setInterval(fetchData, 10000) : undefined;

    return () => {
      supabase.removeChannel(channel);
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'running': return 'secondary';
      case 'failed': return 'destructive';
      case 'paused': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4" />;
      case 'running': return <Activity className="h-4 w-4 animate-pulse" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeSince = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading results...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Enrichment Results</h2>
          <p className="text-muted-foreground">Track agent enrichment pipeline performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={fetchData} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalJobs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedJobs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.runningJobs}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents Enriched</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAgents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Enrichment Jobs</CardTitle>
            <CardDescription>Latest pipeline runs and their status</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div key={job.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusColor(job.status)} className="flex items-center gap-1">
                            {getStatusIcon(job.status)}
                            {job.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {getTimeSince(job.created_at)}
                          </span>
                        </div>
                        <p className="font-medium">{job.city_name}</p>
                        <p className="text-sm text-muted-foreground">{job.category_name}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {job.processed_items} / {job.total_items}
                        </span>
                      </div>
                      <Progress 
                        value={job.total_items > 0 ? (job.processed_items / job.total_items) * 100 : 0} 
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-success/10 p-2">
                        <div className="text-lg font-bold text-success">{job.successful_items}</div>
                        <div className="text-xs text-muted-foreground">Success</div>
                      </div>
                      <div className="rounded-md bg-destructive/10 p-2">
                        <div className="text-lg font-bold text-destructive">{job.failed_items}</div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                      </div>
                      <div className="rounded-md bg-muted p-2">
                        <div className="text-lg font-bold">{job.total_items - job.processed_items}</div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                    </div>

                    {job.completed_at && (
                      <div className="text-xs text-muted-foreground">
                        Completed: {formatDate(job.completed_at)}
                      </div>
                    )}
                  </div>
                ))}

                {jobs.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No enrichment jobs found. Run a test to see results here.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recently Enriched Agents */}
        <Card>
          <CardHeader>
            <CardTitle>Recently Enriched Agents</CardTitle>
            <CardDescription>Agents that were recently processed</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {recentAgents.map((agent) => (
                  <div key={agent.id} className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.city_name}</p>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`/admin`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{agent.review_stars_rating || 0}★</span>
                        <span className="text-muted-foreground">({agent.num_total_reviews || 0} reviews)</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-bold">
                          {Array.isArray(agent.press_mentions) ? agent.press_mentions.length : 0}
                        </div>
                        <div className="text-muted-foreground">Press</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold">
                          {Array.isArray(agent.publications) ? agent.publications.length : 0}
                        </div>
                        <div className="text-muted-foreground">Publications</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold">
                          {Array.isArray(agent.notable_achievements) ? agent.notable_achievements.length : 0}
                        </div>
                        <div className="text-muted-foreground">Achievements</div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Enriched: {getTimeSince(agent.zillow_data_fetched_at)}
                    </div>
                  </div>
                ))}

                {recentAgents.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No enriched agents found yet.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
