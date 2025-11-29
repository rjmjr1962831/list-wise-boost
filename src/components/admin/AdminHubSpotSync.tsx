import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Copy, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface SyncStats {
  total: number;
  synced: number;
  unsynced: number;
  errors: number;
}

interface SyncError {
  id: string;
  name: string;
  email: string;
  error: string;
  created_at: string;
}

export const AdminHubSpotSync = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<SyncStats>({ total: 0, synced: 0, unsynced: 0, errors: 0 });
  const [recentErrors, setRecentErrors] = useState<SyncError[]>([]);
  const [isSyncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hubspot-webhook`;

  const fetchStats = async () => {
    try {
      const { data: prospects, error } = await supabase
        .from('prospects')
        .select('id, hubspot_synced, hubspot_last_error');

      if (error) throw error;

      const total = prospects?.length || 0;
      const synced = prospects?.filter(p => p.hubspot_synced).length || 0;
      const unsynced = total - synced;
      const errors = prospects?.filter(p => p.hubspot_last_error).length || 0;

      setStats({ total, synced, unsynced, errors });

      // Get recent errors
      const { data: errorProspects, error: errorFetchError } = await supabase
        .from('prospects')
        .select('id, name, email, hubspot_last_error, created_at')
        .not('hubspot_last_error', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!errorFetchError && errorProspects) {
        setRecentErrors(
          errorProspects.map(p => ({
            id: p.id,
            name: p.name,
            email: p.email,
            error: p.hubspot_last_error || '',
            created_at: p.created_at
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error",
        description: "Failed to fetch sync statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleBulkSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-sync-hubspot', {
        body: { limit: 50 }
      });

      if (error) throw error;

      toast({
        title: "Sync Complete",
        description: `Synced ${data.synced} prospects. ${data.failed} failed.`,
      });

      // Refresh stats
      await fetchStats();
    } catch (error) {
      console.error('Bulk sync error:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleRetrySync = async (prospectId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-to-hubspot', {
        body: { prospectId }
      });

      if (error) throw error;

      toast({
        title: "Retry Successful",
        description: `Prospect synced to HubSpot`,
      });

      await fetchStats();
    } catch (error) {
      console.error('Retry sync error:', error);
      toast({
        title: "Retry Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copied!",
      description: "Webhook URL copied to clipboard",
    });
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">HubSpot Sync</h2>
        <p className="text-muted-foreground">
          Manage two-way synchronization between prospects and HubSpot
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prospects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Synced</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.synced}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unsynced</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unsynced}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.errors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Sync Action */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sync all unsynced prospects to HubSpot. This will process up to 50 prospects at a time.
          </p>
          <Button 
            onClick={handleBulkSync} 
            disabled={isSyncing || stats.unsynced === 0}
            className="w-full md:w-auto"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync {stats.unsynced} Prospects
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>HubSpot Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              To enable two-way sync, create a workflow in HubSpot that sends updates to this webhook URL when prospects are modified.
            </AlertDescription>
          </Alert>
          
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-muted rounded text-sm break-all">
              {webhookUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyWebhookUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-semibold">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to HubSpot Workflows</li>
              <li>Create a new workflow triggered when a contact is updated</li>
              <li>Add a "Send webhook" action</li>
              <li>Paste the webhook URL above</li>
              <li>Configure to send contact properties including custom fields</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sync Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentErrors.map((error) => (
                <div key={error.id} className="flex items-start justify-between p-3 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">{error.name}</div>
                    <div className="text-sm text-muted-foreground">{error.email}</div>
                    <div className="text-sm text-red-600 mt-1">{error.error}</div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleRetrySync(error.id)}
                  >
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
