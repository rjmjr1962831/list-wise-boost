import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function BulkPipedriveReQueue() {
  const [isQueuing, setIsQueuing] = useState(false);
  const [stats, setStats] = useState<{ total: number; queued: number } | null>(null);
  const { toast } = useToast();

  const checkStats = async () => {
    try {
      // Count professionals not in queue
      const { count, error } = await supabase
        .from("professionals")
        .select("*", { count: "exact", head: true })
        .eq("active", true)
        .not("email", "is", null)
        .not("id", "in", `(SELECT professional_id FROM pipedrive_sync_queue WHERE status = 'pending')`);

      if (error) throw error;

      setStats({ total: count || 0, queued: 0 });
    } catch (error) {
      console.error("Error checking stats:", error);
      toast({
        title: "Check Failed",
        description: error instanceof Error ? error.message : "Failed to check stats",
        variant: "destructive",
      });
    }
  };

  const bulkReQueue = async () => {
    setIsQueuing(true);
    try {
      // Get all active professionals with emails who aren't already in the pending queue
      const { data: professionals, error: fetchError } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("active", true)
        .not("email", "is", null);

      if (fetchError) throw fetchError;

      if (!professionals || professionals.length === 0) {
        toast({
          title: "No Professionals Found",
          description: "No active professionals with emails found to queue",
        });
        return;
      }

      // Insert all professionals into queue (ON CONFLICT will prevent duplicates)
      const { error: insertError } = await supabase
        .from("pipedrive_sync_queue")
        .upsert(
          professionals.map(p => ({
            professional_id: p.id,
            status: 'pending',
            attempts: 0,
            next_retry_at: new Date().toISOString(),
          })),
          { 
            onConflict: 'professional_id',
            ignoreDuplicates: false 
          }
        );

      if (insertError) throw insertError;

      toast({
        title: "Bulk Re-Queue Complete",
        description: `Successfully queued ${professionals.length} professionals for Pipedrive sync`,
      });

      setStats({ total: 0, queued: professionals.length });
    } catch (error) {
      console.error("Error bulk re-queuing:", error);
      toast({
        title: "Bulk Re-Queue Failed",
        description: error instanceof Error ? error.message : "Failed to queue professionals",
        variant: "destructive",
      });
    } finally {
      setIsQueuing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          Bulk Pipedrive Re-Queue
        </CardTitle>
        <CardDescription>
          Queue all active professionals for Pipedrive sync
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <div>
                  <span className="font-semibold">Professionals not in queue:</span> {stats.total}
                </div>
                {stats.queued > 0 && (
                  <div className="text-green-600 font-medium">
                    ✓ Recently queued: {stats.queued}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertDescription>
            This will add all active professionals with emails to the Pipedrive sync queue. 
            Professionals already in the queue will be updated to retry immediately.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={checkStats}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Check Stats
          </Button>

          <Button
            onClick={bulkReQueue}
            disabled={isQueuing}
            className="flex-1"
          >
            {isQueuing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Queueing...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Bulk Re-Queue All
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
