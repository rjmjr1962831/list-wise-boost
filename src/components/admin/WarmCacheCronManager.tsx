import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Play, Square, RefreshCw, Loader2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CronStatus {
  running: boolean;
  jobid?: number;
  schedule?: string;
}

export function WarmCacheCronManager() {
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkCronStatus = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.rpc('check_warm_cache_cron' as any);
      if (error) {
        console.error('Error checking cron:', error);
        setCronStatus({ running: false });
        return;
      }
      setCronStatus(data || { running: false });
    } catch (err) {
      console.error('Cron check failed:', err);
      setCronStatus({ running: false });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkCronStatus();
  }, []);

  const startCron = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('start_warm_cache_cron' as any);
      if (error) throw error;
      toast.success('Warm cache cron started (every 10 minutes)');
      await checkCronStatus();
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCron = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('stop_warm_cache_cron' as any);
      if (error) throw error;
      toast.success('Warm cache cron stopped');
      await checkCronStatus();
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerNow = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('warm-cache', {
        body: {}
      });
      if (error) throw error;
      toast.success('Warm cache triggered manually');
    } catch (error) {
      toast.error(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Warm Cache Cron Job
        </CardTitle>
        <CardDescription>
          Automated cache warming runs every 10 minutes. Sends email alerts on failure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Status:</span>
          {isChecking ? (
            <Badge variant="secondary">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Checking...
            </Badge>
          ) : cronStatus?.running ? (
            <Badge className="bg-blue-500 hover:bg-blue-600">
              Scheduled ({cronStatus.schedule || '*/10 * * * *'})
            </Badge>
          ) : (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">
              Not Scheduled - Restart Required
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={checkCronStatus}
            disabled={isChecking}
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {cronStatus?.running ? (
            <Button
              variant="outline"
              onClick={stopCron}
              disabled={isLoading}
              className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
              Stop Cron
            </Button>
          ) : (
            <Button
              onClick={startCron}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Start Cron
            </Button>
          )}
          <Button
            variant="outline"
            onClick={triggerNow}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Run Now
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Email alerts are sent to robert@top10lists.us when warming fails.
        </p>
      </CardContent>
    </Card>
  );
}
