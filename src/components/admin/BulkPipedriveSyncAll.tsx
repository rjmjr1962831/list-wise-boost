import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function BulkPipedriveSyncAll() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    errors: [] as any[],
    totalCount: 0,
    processedCount: 0
  });
  const { toast } = useToast();

  const handleBulkSync = async () => {
    setIsSyncing(true);
    setProgress({ total: 0, successful: 0, failed: 0, errors: [], totalCount: 0, processedCount: 0 });

    try {
      let offset = 0;
      let hasMore = true;
      const batchSize = 50;
      let aggregatedResults = {
        total: 0,
        successful: 0,
        failed: 0,
        errors: [] as any[],
        totalCount: 0,
        processedCount: 0
      };

      while (hasMore) {
        console.log(`Processing batch at offset ${offset}...`);

        const { data, error } = await supabase.functions.invoke('bulk-sync-all-professionals', {
          body: { batch_size: batchSize, offset }
        });

        if (error) throw error;

        // Aggregate results
        aggregatedResults.total += data.results.total;
        aggregatedResults.successful += data.results.successful;
        aggregatedResults.failed += data.results.failed;
        aggregatedResults.errors.push(...data.results.errors);
        aggregatedResults.totalCount = data.totalCount;
        aggregatedResults.processedCount = data.processedCount;

        // Update UI
        setProgress({ ...aggregatedResults });

        hasMore = data.hasMore;
        offset = data.nextOffset || offset + batchSize;

        // Small delay between batches
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: 'Bulk Sync Complete',
        description: `✅ ${aggregatedResults.successful} successful, ❌ ${aggregatedResults.failed} failed`,
        variant: aggregatedResults.failed > 0 ? 'default' : 'default'
      });
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
      console.error('Bulk sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Sync All Professionals to Pipedrive</CardTitle>
          <CardDescription>
            Syncs all active professionals with email addresses to Pipedrive. This will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Create new contacts for agents not in Pipedrive</li>
              <li>Update existing contacts with latest data</li>
              <li>Merge duplicate contacts automatically</li>
              <li>Populate all 20+ custom fields including Card URL and Profile Link</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleBulkSync} 
            disabled={true}
            size="lg"
            className="w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Bulk Sync Temporarily Disabled (duplicate issue)
          </Button>

          {progress.totalCount > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Progress: {progress.processedCount} of {progress.totalCount} professionals
                </p>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(progress.processedCount / progress.totalCount) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{progress.total}</div>
                  <div className="text-sm text-muted-foreground">Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    <CheckCircle className="w-5 h-5" />
                    {progress.successful}
                  </div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                    <XCircle className="w-5 h-5" />
                    {progress.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>

              {progress.successful > 0 && (
                <Badge variant="default" className="w-full justify-center py-2">
                  Success Rate: {((progress.successful / progress.total) * 100).toFixed(1)}%
                </Badge>
              )}

              {progress.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <AlertTriangle className="w-4 h-4" />
                    Sync Errors ({progress.errors.length})
                  </div>
                  <ScrollArea className="h-64 w-full border rounded-md p-4">
                    <div className="space-y-3">
                      {progress.errors.map((err: any, idx: number) => (
                        <div key={idx} className="p-3 bg-destructive/10 rounded-lg text-sm">
                          <div className="font-semibold">{err.name}</div>
                          <div className="text-xs text-muted-foreground">{err.email}</div>
                          <div className="text-destructive mt-1">{err.error}</div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
