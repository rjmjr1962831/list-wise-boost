import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

export function AdminPipedriveAutoSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState({ created: 0, updated: 0, errors: 0 });
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    // Set up realtime subscription for automatic sync
    const channel = supabase
      .channel('professionals-sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'professionals'
        },
        async (payload) => {
          const professional = payload.new;
          
          // Skip if this update came from Pipedrive (has skip_pipedrive_sync flag)
          if (professional.skip_pipedrive_sync) {
            console.log('Skipping sync for update from Pipedrive');
            return;
          }

          // Only sync if professional has email
          if (professional.email) {
            console.log(`Auto-syncing professional: ${professional.name}`);
            try {
              const { data, error } = await supabase.functions.invoke(
                'sync-single-professional',
                {
                  body: { professional_id: professional.id }
                }
              );

              if (error) throw error;
              
              console.log('✅ Auto-sync completed:', data);
            } catch (error) {
              console.error('❌ Auto-sync error:', error);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsListening(true);
          console.log('✅ Realtime sync listener active');
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setIsListening(false);
    };
  }, []);

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

      setSyncStats({
        created: data.created || 0,
        updated: data.updated || 0,
        errors: data.errors?.length || 0
      });

      if (data.errors && data.errors.length > 0) {
        toast.error(`Sync completed with ${data.errors.length} errors`, {
          description: data.errors.slice(0, 3).join('\n')
        });
      } else {
        toast.success(`Synced ${data.created + data.updated} professionals to Pipedrive`);
      }
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
            <CardTitle>Automatic Pipedrive Sync</CardTitle>
            <CardDescription>
              Bidirectional sync between Supabase and Pipedrive
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant={isListening ? "default" : "secondary"}>
              {isListening ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Listening
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Offline
                </>
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Supabase → Pipedrive
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Auto-sync active</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Changes to professionals automatically sync to Pipedrive
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium text-muted-foreground mb-1">
              Pipedrive → Supabase
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Webhook active</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Pipedrive webhook updates Supabase records
            </p>
          </div>
        </div>

        {(syncStats.created > 0 || syncStats.updated > 0 || syncStats.errors > 0) && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="text-2xl font-bold text-green-600">{syncStats.created}</div>
              <div className="text-xs text-muted-foreground">Created</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{syncStats.updated}</div>
              <div className="text-xs text-muted-foreground">Updated</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{syncStats.errors}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Manual Sync</h4>
          <p className="text-sm text-muted-foreground">
            Sync up to 50 professionals to Pipedrive manually
          </p>
          <Button 
            onClick={handleManualSync} 
            disabled={isSyncing}
            className="w-full"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Updates to professionals in Supabase automatically sync to Pipedrive</li>
            <li>Updates in Pipedrive trigger webhook to update Supabase</li>
            <li>Loop prevention: updates from Pipedrive don't trigger sync back</li>
            <li>Only professionals with email addresses are synced</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
