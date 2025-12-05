import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { RefreshCw, Globe, CheckCircle, XCircle, Loader2, Square, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Job {
  id: string;
  status: string;
  total_urls: number;
  processed_count: number;
  success_count: number;
  fail_count: number;
  current_index: number;
  results: { url: string; success: boolean; timestamp: string }[];
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export const PrerenderRecache: React.FC = () => {
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const fetchJobStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('prerender_recache_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching job:', error);
        return;
      }

      if (data) {
        setJob({
          ...data,
          results: (data.results as unknown as Job['results']) || []
        });
      } else {
        setJob(null);
      }
    } catch (err) {
      console.error('Exception fetching job:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll for updates when job is running
  useEffect(() => {
    fetchJobStatus();

    const interval = setInterval(() => {
      if (job?.status === 'running') {
        fetchJobStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchJobStatus, job?.status]);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-prerender-recache', {
        body: { action: 'start' }
      });

      if (error) throw error;

      toast.success(`Started recaching ${data.totalUrls} URLs in background`);
      fetchJobStatus();
    } catch (err) {
      console.error('Error starting job:', err);
      toast.error('Failed to start recache job');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (!job) return;

    try {
      const { error } = await supabase.functions.invoke('process-prerender-recache', {
        body: { action: 'stop', jobId: job.id }
      });

      if (error) throw error;

      toast.info('Stopping recache job...');
      fetchJobStatus();
    } catch (err) {
      console.error('Error stopping job:', err);
      toast.error('Failed to stop job');
    }
  };

  const handleResume = async () => {
    if (!job) return;

    try {
      const { error } = await supabase.functions.invoke('process-prerender-recache', {
        body: { action: 'resume', jobId: job.id }
      });

      if (error) throw error;

      toast.success('Resuming recache job...');
      fetchJobStatus();
    } catch (err) {
      console.error('Error resuming job:', err);
      toast.error('Failed to resume job');
    }
  };

  const isRunning = job?.status === 'running';
  const isStopped = job?.status === 'stopped';
  const canResume = isStopped && job && job.current_index < job.total_urls;
  const progress = job && job.total_urls > 0 
    ? Math.round((job.processed_count / job.total_urls) * 100) 
    : 0;

  const getStatusBadge = () => {
    if (!job) return null;
    const statusColors: Record<string, string> = {
      running: 'bg-blue-500',
      completed: 'bg-green-500',
      stopped: 'bg-yellow-500',
      failed: 'bg-red-500',
      pending: 'bg-gray-500'
    };
    return (
      <Badge className={`${statusColors[job.status] || 'bg-gray-500'} text-white`}>
        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Prerender.io Recache (Background)
        </CardTitle>
        <CardDescription>
          Recache runs in the background - you can close this page and it will continue.
          {job && ` Last job: ${job.total_urls} URLs.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap items-center">
          {!isRunning && (
            <Button onClick={handleStart} disabled={isLoading || isStarting}>
              {isStarting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Start New Recache
            </Button>
          )}
          
          {isRunning && (
            <Button onClick={handleStop} variant="destructive">
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          )}

          {canResume && (
            <Button onClick={handleResume} variant="outline">
              <Play className="mr-2 h-4 w-4" />
              Resume from {job.current_index}/{job.total_urls}
            </Button>
          )}

          <Button onClick={fetchJobStatus} variant="ghost" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>

          {getStatusBadge()}
        </div>

        {job && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{job.processed_count} / {job.total_urls} ({progress}%)</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{job.processed_count}</div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950">
                <div className="text-2xl font-bold text-green-600">{job.success_count}</div>
                <div className="text-xs text-muted-foreground">Success</div>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950">
                <div className="text-2xl font-bold text-red-600">{job.fail_count}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {/* Results log */}
            {job.results && job.results.length > 0 && (
              <ScrollArea className="h-64 rounded-lg border">
                <div className="p-2 space-y-1">
                  {[...job.results].reverse().map((result, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 text-xs p-2 rounded ${
                        result.success 
                          ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' 
                          : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-3 w-3 flex-shrink-0" />
                      )}
                      <span className="truncate">{result.url}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {job.error_message && (
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg text-red-800 dark:text-red-200 text-sm">
                Error: {job.error_message}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>Background processing:</strong> Jobs continue even if you close this page. Refresh to see progress.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PrerenderRecache;
