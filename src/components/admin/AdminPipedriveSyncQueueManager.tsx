import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AdminPipedriveSyncQueueManager() {
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState<Record<string, number> | null>(null);
  const { toast } = useToast();

  const fetchQueueStats = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("pipedrive_sync_queue")
        .select("status");

      if (error) throw error;

      const stats: Record<string, number> = {};
      let total = 0;
      data?.forEach((item) => {
        stats[item.status] = (stats[item.status] || 0) + 1;
        total++;
      });

      setQueueStats(stats);
      toast({
        title: "Stats Refreshed",
        description: `Found ${total} total entries in queue`,
      });
    } catch (error) {
      console.error("Error fetching queue stats:", error);
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-pipedrive-sync-queue");

      if (error) throw error;

      toast({
        title: "Queue Processing Complete",
        description: `Processed: ${data.processed}, Succeeded: ${data.succeeded}, Failed: ${data.failed}`,
      });

      await fetchQueueStats();
    } catch (error) {
      console.error("Error processing queue:", error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process queue",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearStuckEntries = async () => {
    setIsClearing(true);
    try {
      // Delete all processing, pending, and failed entries
      const { error } = await supabase
        .from("pipedrive_sync_queue")
        .delete()
        .in("status", ["processing", "pending", "failed"]);

      if (error) throw error;

      toast({
        title: "Queue Cleared",
        description: "Removed all stuck sync entries. You can now re-sync with correct field mappings.",
      });

      await fetchQueueStats();
    } catch (error) {
      console.error("Error clearing queue:", error);
      toast({
        title: "Clear Failed",
        description: error instanceof Error ? error.message : "Failed to clear queue",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    fetchQueueStats();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Pipedrive Sync Queue Manager
        </CardTitle>
        <CardDescription>
          Clear stuck sync entries and reset the queue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {queueStats !== null && (
          <Alert variant={Object.keys(queueStats).length === 0 ? "default" : undefined}>
            <AlertDescription>
              <div className="font-semibold mb-2">Current Queue Status:</div>
              {Object.keys(queueStats).length === 0 ? (
                <p className="text-green-600 font-medium">✓ Queue is empty - no pending syncs</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(queueStats).map(([status, count]) => (
                    <div key={status}>
                      <span className="font-medium capitalize">{status}:</span> {count}
                    </div>
                  ))}
                  <div className="col-span-2 mt-2 pt-2 border-t">
                    <span className="font-bold">Total:</span> {Object.values(queueStats).reduce((a, b) => a + b, 0)}
                  </div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Alert variant="destructive">
          <AlertDescription>
            If the dashboard is frozen or syncs are failing, it's likely because queue entries were 
            created with old/incorrect field mappings. Clear the stuck entries and re-sync after 
            verifying your field mappings are correct.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={fetchQueueStats}
              variant="outline"
              className="flex-1"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Stats
                </>
              )}
            </Button>

            <Button
              onClick={processQueue}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Process Queue Now
                </>
              )}
            </Button>
          </div>

          <Button
            onClick={clearStuckEntries}
            disabled={isClearing}
            variant="destructive"
            className="w-full"
          >
            {isClearing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Stuck Entries
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
