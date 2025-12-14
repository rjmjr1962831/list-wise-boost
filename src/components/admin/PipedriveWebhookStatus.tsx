import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Copy, RefreshCw, Check, AlertTriangle, ExternalLink, Loader2, Search } from 'lucide-react';

export function PipedriveWebhookStatus() {
  const [recentSyncs, setRecentSyncs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testProfessionalId, setTestProfessionalId] = useState('');
  const [pulling, setPulling] = useState(false);

  const webhookUrl = 'https://bgdtekbhelormzbymkhh.supabase.co/functions/v1/pipedrive-webhook';

  useEffect(() => {
    fetchRecentSyncs();
  }, []);

  const fetchRecentSyncs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pipedrive_sync_state')
        .select('*, professionals!inner(name, email)')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentSyncs(data || []);
    } catch (error) {
      console.error('Error fetching syncs:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  };

  const pullFromPipedrive = async (professionalId: string) => {
    setPulling(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-from-pipedrive', {
        body: { professional_id: professionalId }
      });

      if (error) throw error;

      toast.success(`Pulled ${data.updates?.length || 0} fields from Pipedrive`);
      fetchRecentSyncs();
    } catch (error: any) {
      console.error('Error pulling from Pipedrive:', error);
      toast.error(error.message || 'Failed to pull from Pipedrive');
    } finally {
      setPulling(false);
    }
  };

  const handleTestPull = async () => {
    if (!testProfessionalId.trim()) {
      toast.error('Enter a professional ID');
      return;
    }
    await pullFromPipedrive(testProfessionalId.trim());
  };

  return (
    <div className="space-y-6">
      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Pipedrive Webhook Configuration
          </CardTitle>
          <CardDescription>
            Configure this webhook in Pipedrive to enable automatic 2-way sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">Setup Required in Pipedrive</p>
                <p className="text-amber-700 mt-1">
                  Go to Pipedrive → Settings → Webhooks and create a webhook with these settings:
                </p>
                <ul className="list-disc ml-4 mt-2 text-amber-700">
                  <li>Event types: <code className="bg-amber-100 px-1 rounded">person.updated</code>, <code className="bg-amber-100 px-1 rounded">person.deleted</code>, <code className="bg-amber-100 px-1 rounded">person.merged</code></li>
                  <li>HTTP Method: POST</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Webhook URL</label>
            <div className="flex gap-2">
              <Input 
                value={webhookUrl} 
                readOnly 
                className="font-mono text-sm bg-muted"
              />
              <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={() => window.open('https://top10lists.pipedrive.com/settings/webhooks', '_blank')}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open Pipedrive Webhooks Settings
          </Button>
        </CardContent>
      </Card>

      {/* Manual Pull */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Manual Pull from Pipedrive
          </CardTitle>
          <CardDescription>
            Pull latest data from Pipedrive for a specific professional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Professional ID (UUID)"
              value={testProfessionalId}
              onChange={(e) => setTestProfessionalId(e.target.value)}
              className="font-mono"
            />
            <Button onClick={handleTestPull} disabled={pulling}>
              {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Pull</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sync Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Sync Activity</CardTitle>
              <CardDescription>Last 10 professionals synced with Pipedrive</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRecentSyncs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentSyncs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No sync records found</p>
          ) : (
            <div className="space-y-2">
              {recentSyncs.map((sync) => (
                <div 
                  key={sync.id} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{sync.professionals?.name}</p>
                    <p className="text-sm text-muted-foreground">{sync.professionals?.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">
                        PD #{sync.pipedrive_person_id}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {sync.last_synced_at 
                          ? new Date(sync.last_synced_at).toLocaleString() 
                          : 'Never'}
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => pullFromPipedrive(sync.professional_id)}
                      disabled={pulling}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
