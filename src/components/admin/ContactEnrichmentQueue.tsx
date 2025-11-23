import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, PlayCircle, RefreshCw, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface QueueItem {
  id: string;
  professional_id: string;
  status: string;
  reason: string;
  attempts: number;
  error_message: string | null;
  created_at: string;
  professionals: {
    name: string;
  };
}

export const ContactEnrichmentQueue = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [recentItems, setRecentItems] = useState<QueueItem[]>([]);

  const fetchStats = async () => {
    const { data: queueData } = await supabase
      .from('contact_enrichment_queue')
      .select('status');

    if (queueData) {
      const stats: QueueStats = {
        total: queueData.length,
        pending: queueData.filter(i => i.status === 'pending').length,
        processing: queueData.filter(i => i.status === 'processing').length,
        completed: queueData.filter(i => i.status === 'completed').length,
        failed: queueData.filter(i => i.status === 'failed').length,
      };
      setStats(stats);
    }

    // Fetch recent items
    const { data: recentData } = await supabase
      .from('contact_enrichment_queue')
      .select('*, professionals(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentData) {
      setRecentItems(recentData as QueueItem[]);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const enqueueAgents = async () => {
    setLoading(true);
    try {
      toast.info('Finding agents to enqueue...');
      
      const { data, error } = await supabase.functions.invoke('enqueue-agents-for-enrichment');

      if (error) throw error;

      toast.success(`Added ${data.queued} agents to queue`);
      fetchStats();
    } catch (error: any) {
      console.error('Error enqueueing agents:', error);
      toast.error(`Failed to enqueue: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    setLoading(true);
    try {
      toast.info('Processing queue batch...');
      
      const { data, error } = await supabase.functions.invoke('process-contact-enrichment-queue', {
        body: { batchSize: 5 }
      });

      if (error) throw error;

      toast.success(`Processed ${data.processed} agents`);
      fetchStats();
    } catch (error: any) {
      console.error('Error processing queue:', error);
      toast.error(`Failed to process: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: 'secondary',
      processing: 'default',
      completed: 'default',
      failed: 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Contact Enrichment Queue
          </CardTitle>
          <CardDescription>
            Background job system that processes agents with generic emails or missing phones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This queue runs automatically every minute, processing 3 agents at a time. You can manually add agents or process batches below.
            </AlertDescription>
          </Alert>

          {stats && (
            <div className="grid grid-cols-5 gap-4 text-sm">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-2xl font-bold">{stats.pending}</div>
                <div className="text-muted-foreground">Pending</div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="text-2xl font-bold">{stats.processing}</div>
                <div className="text-muted-foreground">Processing</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-2xl font-bold">{stats.completed}</div>
                <div className="text-muted-foreground">Completed</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-2xl font-bold">{stats.failed}</div>
                <div className="text-muted-foreground">Failed</div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={enqueueAgents} 
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Add Agents to Queue
            </Button>
            
            <Button 
              onClick={processQueue} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Process 5 Now
            </Button>

            <Button 
              onClick={fetchStats} 
              disabled={loading}
              variant="ghost"
              size="icon"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {recentItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Recent Queue Items:</h4>
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {recentItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{item.professionals?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Reason: {item.reason.replace('_', ' ')} • Attempts: {item.attempts}/3
                      </div>
                      {item.error_message && (
                        <div className="text-xs text-red-500 mt-1">
                          {item.error_message}
                        </div>
                      )}
                    </div>
                    <div>
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
