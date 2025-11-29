import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface RecentEnrichment {
  id: string;
  professional_name: string;
  status: string;
  completed_at: string | null;
  error_message: string | null;
}

export function EnrichmentPipelineStatus() {
  const [stats, setStats] = useState<QueueStats>({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [recent, setRecent] = useState<RecentEnrichment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      // Get queue stats
      const { data: queueData, error: queueError } = await supabase
        .from('contact_enrichment_queue')
        .select('status');

      if (queueError) throw queueError;

      const newStats = {
        pending: queueData?.filter(q => q.status === 'pending').length || 0,
        processing: queueData?.filter(q => q.status === 'processing').length || 0,
        completed: queueData?.filter(q => q.status === 'completed').length || 0,
        failed: queueData?.filter(q => q.status === 'failed').length || 0,
      };
      setStats(newStats);

      // Get recent enrichments
      const { data: recentData, error: recentError } = await supabase
        .from('contact_enrichment_queue')
        .select(`
          id,
          status,
          completed_at,
          error_message,
          professional_id,
          professionals (name)
        `)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      const formattedRecent = recentData?.map(item => ({
        id: item.id,
        professional_name: (item.professionals as any)?.name || 'Unknown',
        status: item.status,
        completed_at: item.completed_at,
        error_message: item.error_message,
      })) || [];

      setRecent(formattedRecent);
    } catch (error) {
      console.error('Error fetching enrichment status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Poll every 5 seconds when there's active processing or pending items
    const interval = setInterval(() => {
      if (stats.processing > 0 || stats.pending > 0) {
        fetchStatus();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [stats.processing, stats.pending]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-500';
      case 'failed':
        return 'bg-red-500/10 text-red-500';
      case 'processing':
        return 'bg-blue-500/10 text-blue-500';
      default:
        return 'bg-yellow-500/10 text-yellow-500';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enrichment Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>Loading...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Enrichment Pipeline Status
          {(stats.processing > 0 || stats.pending > 0) && (
            <Badge variant="outline" className="ml-2">
              <Clock className="mr-1 h-3 w-3 animate-pulse" />
              Live (5s refresh)
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Real-time status of agent data enrichment</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Queue Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Processing</p>
            <p className="text-2xl font-bold text-blue-500">{stats.processing}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-2">
          <h4 className="font-semibold">Recent Activity</h4>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {recent.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <span className="text-sm font-medium">{item.professional_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                    {item.completed_at && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.completed_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
