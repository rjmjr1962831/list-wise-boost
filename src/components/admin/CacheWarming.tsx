import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Flame, Play, Square, RotateCcw, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Job {
  id: string;
  status: string;
  total_urls: number;
  processed_count: number;
  success_count: number;
  fail_count: number;
  current_index: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export function CacheWarming() {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchJobStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('warm-cache', {
        body: { action: 'status' }
      });
      if (error) throw error;
      setJob(data.job);
    } catch (err) {
      console.error('Error fetching job status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobStatus();
    
    // Poll for updates every 2 seconds if job is running (faster for real-time feedback)
    const interval = setInterval(() => {
      if (job?.status === 'running') {
        fetchJobStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [job?.status, fetchJobStatus]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('warm-cache', {
        body: { action: 'start' }
      });
      if (error) throw error;
      toast.success(`Started cache warming job with ${data.totalUrls} URLs`);
      fetchJobStatus();
    } catch (err) {
      toast.error('Failed to start cache warming');
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      const { error } = await supabase.functions.invoke('warm-cache', {
        body: { action: 'stop', jobId: job?.id }
      });
      if (error) throw error;
      toast.success('Cache warming stopped');
      fetchJobStatus();
    } catch (err) {
      toast.error('Failed to stop cache warming');
      console.error(err);
    }
  };

  const handleResume = async () => {
    try {
      const { error } = await supabase.functions.invoke('warm-cache', {
        body: { action: 'resume', jobId: job?.id }
      });
      if (error) throw error;
      toast.success('Cache warming resumed');
      fetchJobStatus();
    } catch (err) {
      toast.error('Failed to resume cache warming');
      console.error(err);
    }
  };

  const progress = job ? (job.processed_count / job.total_urls) * 100 : 0;

  const getStatusBadge = () => {
    if (!job) return null;
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      running: 'default',
      completed: 'secondary',
      stopped: 'outline',
      failed: 'destructive'
    };
    return <Badge variant={variants[job.status] || 'outline'}>{job.status}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Cloudflare Cache Warming
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5" />
          Cloudflare Cache Warming
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          Warm the Cloudflare KV cache by fetching all pages with a bot user-agent. 
          This populates the 24-hour KV cache for faster bot/crawler responses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(!job || job.status === 'completed' || job.status === 'failed' || job.status === 'stopped') && (
            <Button onClick={handleStart} disabled={starting}>
              {starting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  {job?.status === 'stopped' ? 'Start Fresh' : 'Start Cache Warming'}
                </>
              )}
            </Button>
          )}
          {job?.status === 'stopped' && (
            <Button onClick={handleResume} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Resume Previous
            </Button>
          )}
          {job?.status === 'running' && (
            <Button onClick={handleStop} variant="destructive">
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
          <Button 
            onClick={() => { setLoading(true); fetchJobStatus(); }} 
            variant="outline" 
            size="icon"
            title="Refresh status"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {job && (
          <div className="space-y-3">
            <Progress value={progress} className="h-2" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Processed:</span>
                <span className="ml-2 font-medium">{job.processed_count} / {job.total_urls}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Success:</span>
                <span className="ml-2 font-medium text-green-600">{job.success_count}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Failed:</span>
                <span className="ml-2 font-medium text-red-600">{job.fail_count}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Progress:</span>
                <span className="ml-2 font-medium">{progress.toFixed(1)}%</span>
              </div>
            </div>

            {job.started_at && (
              <p className="text-xs text-muted-foreground">
                Started: {new Date(job.started_at).toLocaleString()}
                {job.completed_at && ` • Completed: ${new Date(job.completed_at).toLocaleString()}`}
              </p>
            )}

            {job.error_message && (
              <p className="text-sm text-destructive">{job.error_message}</p>
            )}
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <p className="text-xs text-muted-foreground">
            <strong>How it works:</strong> Fetches each URL with a Googlebot user-agent. 
            Your Cloudflare Worker detects bot traffic and caches the pre-rendered response in KV for 24 hours.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
