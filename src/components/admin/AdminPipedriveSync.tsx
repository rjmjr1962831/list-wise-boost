import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function AdminPipedriveSync() {
  const [stats, setStats] = useState({
    total: 0,
    synced: 0,
    unsynced: 0,
    errors: 0,
  });
  const [professionalStats, setProfessionalStats] = useState({
    total: 0,
    synced: 0,
  });
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingProfessionals, setIsSyncingProfessionals] = useState(false);
  const { toast } = useToast();

  const fetchStats = async () => {
    const { count: total } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true })
      .not('email', 'is', null);

    const { count: synced } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true })
      .eq('pipedrive_synced', true);

    const { count: errors } = await supabase
      .from('prospects')
      .select('*', { count: 'exact', head: true })
      .not('pipedrive_last_error', 'is', null);

    const { data: errorProspects } = await supabase
      .from('prospects')
      .select('id, name, email, pipedrive_last_error, updated_at')
      .not('pipedrive_last_error', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10);

    // Fetch professional stats
    const { count: profTotal } = await supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .not('email', 'is', null);

    setStats({
      total: total || 0,
      synced: synced || 0,
      unsynced: (total || 0) - (synced || 0),
      errors: errors || 0,
    });
    setProfessionalStats({
      total: profTotal || 0,
      synced: 0, // We don't track this separately for professionals
    });
    setRecentErrors(errorProspects || []);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleBulkSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-sync-pipedrive', {
        body: { limit: 5 },
      });

      if (error) throw error;

      toast({
        title: 'Sync Complete',
        description: `Created: ${data.created}, Updated: ${data.updated}, Errors: ${data.errors}`,
      });

      fetchStats();
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryError = async (prospectId: string) => {
    try {
      const { error } = await supabase.functions.invoke('sync-to-pipedrive', {
        body: { prospect_id: prospectId },
      });

      if (error) throw error;

      toast({ title: 'Retry Successful' });
      fetchStats();
    } catch (error: any) {
      toast({
        title: 'Retry Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSyncProfessionals = async () => {
    setIsSyncingProfessionals(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-professionals-to-pipedrive', {
        body: { limit: 500 }, // Sync all active professionals at once
      });

      if (error) throw error;

      toast({
        title: 'Professionals Sync Complete',
        description: `Created: ${data.created}, Updated: ${data.updated}, Errors: ${data.errors}`,
      });

      fetchStats();
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSyncingProfessionals(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Pipedrive Sync</h2>
        <p className="text-muted-foreground">
          Manage two-way synchronization between prospects and Pipedrive CRM
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Prospects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <CheckCircle className="inline w-4 h-4 mr-1 text-green-500" />
              Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.synced}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <AlertCircle className="inline w-4 h-4 mr-1 text-yellow-500" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.unsynced}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <XCircle className="inline w-4 h-4 mr-1 text-red-500" />
              Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
          </CardContent>
        </Card>
      </div>

      {/* Prospects Sync Button */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Sync Prospects</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Sync up to 100 unsynced prospects (leads) to Pipedrive.
          </p>
          <Button onClick={handleBulkSync} disabled={isSyncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : `Sync ${stats.unsynced} Prospects`}
          </Button>
        </CardContent>
      </Card>

      {/* Professionals Sync Button */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Professionals with Card URLs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Sync active professionals (agents with profile cards) to Pipedrive. This will populate the Card URL field for each agent.
          </p>
          <div className="mb-4">
            <p className="text-sm">
              <strong>{professionalStats.total}</strong> active professionals with email addresses
            </p>
          </div>
          <Button onClick={handleSyncProfessionals} disabled={isSyncingProfessionals}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncingProfessionals ? 'animate-spin' : ''}`} />
            {isSyncingProfessionals ? 'Syncing...' : `Sync ${professionalStats.total} Professionals`}
          </Button>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-2">
            Add this URL to Pipedrive webhooks (Settings → Tools and apps → Webhooks):
          </p>
          <code className="bg-muted p-2 rounded block text-sm break-all">
            {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pipedrive-webhook`}
          </code>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sync Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentErrors.map((prospect) => (
                <div
                  key={prospect.id}
                  className="flex items-center justify-between p-4 bg-destructive/10 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{prospect.name}</p>
                    <p className="text-sm text-muted-foreground">{prospect.email}</p>
                    <p className="text-sm text-destructive">{prospect.pipedrive_last_error}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryError(prospect.id)}
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
}
