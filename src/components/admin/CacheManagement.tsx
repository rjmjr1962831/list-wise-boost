import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { 
  getCacheQueueStatus, 
  triggerCacheInvalidationNow, 
  clearCompletedQueueItems 
} from '@/services/cacheInvalidationService';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function CacheManagement() {
  const [status, setStatus] = useState({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0
  });
  const [loading, setLoading] = useState(false);
  const [processingNow, setProcessingNow] = useState(false);
  const [cronScheduled, setCronScheduled] = useState<boolean | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const queueStatus = await getCacheQueueStatus();
      setStatus(queueStatus);
    } catch (error) {
      console.error('Error loading cache status:', error);
      toast.error('Failed to load cache status');
    } finally {
      setLoading(false);
    }
  };

  const checkCronStatus = async () => {
    try {
      const { data } = await supabase.rpc('check_warm_cache_cron' as any);
      setCronScheduled(data?.running ?? false);
    } catch {
      setCronScheduled(false);
    }
  };

  useEffect(() => {
    loadStatus();
    checkCronStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadStatus();
      checkCronStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleProcessNow = async () => {
    setProcessingNow(true);
    toast.info('Triggering cache invalidation processor...');
    
    try {
      const result = await triggerCacheInvalidationNow();
      
      if (result.success) {
        toast.success('Cache invalidation completed', {
          description: result.data?.message || 'Processing complete'
        });
        await loadStatus();
      } else {
        toast.error('Cache invalidation failed', {
          description: result.error
        });
      }
    } catch (error) {
      console.error('Error processing cache:', error);
      toast.error('Failed to trigger cache processing');
    } finally {
      setProcessingNow(false);
    }
  };

  const handleClearCompleted = async () => {
    try {
      const result = await clearCompletedQueueItems();
      
      if (result.success) {
        toast.success(`Cleared ${result.deleted} items from queue`);
        await loadStatus();
      } else {
        toast.error('Failed to clear queue items', {
          description: result.error
        });
      }
    } catch (error) {
      console.error('Error clearing queue:', error);
      toast.error('Failed to clear queue');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Cache Management</h2>
        <p className="text-muted-foreground mt-2">
          Monitor and manage canonical ranking cache invalidation
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.total}</div>
            <p className="text-xs text-muted-foreground mt-1">In queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.processing}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.failed}</div>
            <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Manage cache invalidation queue and trigger manual processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={handleProcessNow}
              disabled={processingNow || loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${processingNow ? 'animate-spin' : ''}`} />
              Process Queue Now
            </Button>

            <Button 
              onClick={loadStatus}
              disabled={loading}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Status
            </Button>

            <Button 
              onClick={handleClearCompleted}
              disabled={loading || (status.completed === 0 && status.failed === 0)}
              variant="secondary"
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Completed/Failed
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">About Cache Invalidation</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Cron job runs every 10 minutes to process pending invalidations</li>
              <li>Regenerates canonical rankings for bots when agent data changes</li>
              <li>Maintains stable rankings for search engines and LLMs</li>
              <li>Failed items retry up to 3 times automatically</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Cron Job Status</span>
              {cronScheduled === null ? (
                <Badge variant="secondary">Checking...</Badge>
              ) : cronScheduled ? (
                <Badge className="gap-1 bg-blue-500 hover:bg-blue-600">
                  <CheckCircle className="h-3 w-3" />
                  Scheduled (Every 10 min)
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
                  <AlertCircle className="h-3 w-3" />
                  Not Scheduled - Restart Required
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto-Refresh</span>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Every 30 seconds
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Queue Health</span>
              <Badge 
                variant={status.failed > 5 ? "destructive" : status.pending > 20 ? "secondary" : "default"}
              >
                {status.failed > 5 ? 'Attention Needed' : status.pending > 20 ? 'High Load' : 'Healthy'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
