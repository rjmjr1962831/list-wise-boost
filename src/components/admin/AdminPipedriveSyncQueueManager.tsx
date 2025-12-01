import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function AdminPipedriveSyncQueueManager() {
  const [isClearing, setIsClearing] = useState(false);
  const [queueStats, setQueueStats] = useState<Record<string, number> | null>(null);
  const { toast } = useToast();

  const fetchQueueStats = async () => {
    try {
      const { data, error } = await supabase
        .from("pipedrive_sync_queue")
        .select("status");

      if (error) throw error;

      const stats: Record<string, number> = {};
      data?.forEach((item) => {
        stats[item.status] = (stats[item.status] || 0) + 1;
      });

      setQueueStats(stats);
    } catch (error) {
      console.error("Error fetching queue stats:", error);
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
        {queueStats && (
          <Alert>
            <AlertDescription>
              <div className="font-semibold mb-2">Current Queue Status:</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(queueStats).map(([status, count]) => (
                  <div key={status}>
                    <span className="font-medium capitalize">{status}:</span> {count}
                  </div>
                ))}
              </div>
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

        <div className="flex gap-2">
          <Button
            onClick={fetchQueueStats}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Stats
          </Button>

          <Button
            onClick={clearStuckEntries}
            disabled={isClearing}
            variant="destructive"
            className="flex-1"
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
