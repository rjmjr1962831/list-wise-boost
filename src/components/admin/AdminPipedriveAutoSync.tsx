import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export function AdminPipedriveAutoSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats>({ pending: 0, processing: 0, completed: 0, failed: 0 });
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);

  useEffect(() => {
    fetchQueueStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchQueueStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueueStats = async () => {
    try {
      const { data, error } = await supabase
        .from('pipedrive_sync_queue')
        .select('status');
      
      if (error) throw error;

      const stats: QueueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      };

      data?.forEach(item => {
        if (item.status in stats) {
          stats[item.status as keyof QueueStats]++;
        }
      });

      setQueueStats(stats);
    } catch (error) {
      console.error('Error fetching queue stats:', error);
    }
  };

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'process-pipedrive-sync-queue',
        { body: {} }
      );

      if (error) throw error;

      setLastProcessed(new Date());
      await fetchQueueStats();

      if (data.processed === 0) {
        toast.info('No items in queue to process');
      } else if (data.failed > 0) {
        toast.warning(`Processed ${data.processed} items: ${data.succeeded} succeeded, ${data.failed} failed`);
      } else {
        toast.success(`Successfully processed ${data.succeeded} items from queue`);
      }
    } catch (error) {
      console.error('Queue processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process queue');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'sync-professionals-to-pipedrive',
        {
          body: { limit: 50 }
        }
      );

      if (error) throw error;

      await fetchQueueStats();
      toast.success(`Queued ${data.created + data.updated} professionals for sync`);
    } catch (error) {
      console.error('Sync error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sync');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Real-time Pipedrive Sync</CardTitle>
            <CardDescription>
              Queue-based automatic sync with retry logic
            </CardDescription>
          </div>
          <Badge variant="default">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active (Runs every 2 min)
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-2xl font-bold">{queueStats.pending}</div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Processing</span>
            </div>
            <div className="text-2xl font-bold">{queueStats.processing}</div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <div className="text-2xl font-bold">{queueStats.completed}</div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Failed</span>
            </div>
            <div className="text-2xl font-bold">{queueStats.failed}</div>
          </div>
        </div>

        {lastProcessed && (
          <div className="text-sm text-muted-foreground">
            Last processed: {lastProcessed.toLocaleTimeString()}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Process Queue Now</h4>
            <p className="text-sm text-muted-foreground">
              Manually trigger queue processing
            </p>
            <Button 
              onClick={handleProcessQueue} 
              disabled={isProcessing}
              variant="secondary"
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Process Queue
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Bulk Sync</h4>
            <p className="text-sm text-muted-foreground">
              Queue 50 professionals for sync
            </p>
            <Button 
              onClick={handleManualSync} 
              disabled={isSyncing}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Queueing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Queue Sync
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Database trigger automatically adds updated professionals to sync queue</li>
            <li>Cron job processes queue every 2 minutes</li>
            <li>Failed syncs retry with exponential backoff (2, 4, 8 minutes)</li>
            <li>Pipedrive webhook updates Supabase records bidirectionally</li>
            <li>Loop prevention via skip_pipedrive_sync flag</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
