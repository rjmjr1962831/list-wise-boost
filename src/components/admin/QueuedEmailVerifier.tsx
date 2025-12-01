import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Play, Pause, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  failedVerifications: number;
}

interface QueueItem {
  id: string;
  professional_id: string;
  email: string;
  name: string;
  status: string;
  attempts: number;
  max_attempts: number;
  delay_seconds: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  verification_result?: any;
}

export const QueuedEmailVerifier = () => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<QueueStats>({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0, failedVerifications: 0 });
  const [recentItems, setRecentItems] = useState<QueueItem[]>([]);
  const [limit, setLimit] = useState(20);
  const [delaySeconds, setDelaySeconds] = useState(3);
  const [concurrency, setConcurrency] = useState(5);
  const [citySlug, setCitySlug] = useState<string>('');
  const [cities, setCities] = useState<Array<{ name: string; slug: string }>>([]);
  const [unverifiedCount, setUnverifiedCount] = useState<number>(0);
  const [processInterval, setProcessInterval] = useState<number | null>(null);

  useEffect(() => {
    fetchCities();
    fetchUnverifiedCount();
    fetchStats();
    fetchRecentItems();

    // Subscribe to queue changes
    const channel = supabase
      .channel('queue-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'email_verification_queue' },
        () => {
          fetchStats();
          fetchRecentItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (processInterval) {
        clearInterval(processInterval);
      }
    };
  }, []);

  const fetchCities = async () => {
    const { data } = await supabase
      .from('cities')
      .select('name, slug')
      .eq('active', true)
      .order('name');
    
    if (data) setCities(data);
  };

  const fetchUnverifiedCount = async () => {
    const { count } = await supabase
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)
      .not('email', 'is', null)
      .is('email_verified_at', null);
    
    setUnverifiedCount(count || 0);
  };

  const fetchStats = async () => {
    const { count: total } = await supabase
      .from('email_verification_queue')
      .select('*', { count: 'exact', head: true });

    const { count: pending } = await supabase
      .from('email_verification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: processing } = await supabase
      .from('email_verification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    const { count: completed } = await supabase
      .from('email_verification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    const { count: failed } = await supabase
      .from('email_verification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    // Count completed items with failed verification results
    const { data: failedVerifications } = await supabase
      .from('email_verification_queue')
      .select('verification_result', { count: 'exact', head: false })
      .eq('status', 'completed')
      .not('verification_result', 'is', null);

    const failedVerificationCount = failedVerifications?.filter(
      (item: any) => item.verification_result?.status === 'failed'
    ).length || 0;

    setStats({
      total: total || 0,
      pending: pending || 0,
      processing: processing || 0,
      completed: completed || 0,
      failed: failed || 0,
      failedVerifications: failedVerificationCount,
    });
  };

  const fetchRecentItems = async () => {
    const { data } = await supabase
      .from('email_verification_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setRecentItems(data);
  };

  const addToQueue = async (addAll = false) => {
    setLoading(true);
    try {
      let query = supabase
        .from('professionals')
        .select('id, name, email, city_id')
        .eq('active', true)
        .not('email', 'is', null)
        .is('email_verified_at', null)
        .order('review_stars_rating', { ascending: false, nullsFirst: false });

      if (citySlug) {
        const { data: city } = await supabase
          .from('cities')
          .select('id')
          .eq('slug', citySlug)
          .single();
        
        if (city) {
          query = query.eq('city_id', city.id);
        }
      }

      if (!addAll) {
        query = query.limit(limit);
      }

      const { data: professionals, error } = await query;

      if (error) throw error;

      if (!professionals || professionals.length === 0) {
        toast.info('No unverified emails found');
        return;
      }

      // Add to queue
      const queueItems = professionals.map(prof => ({
        professional_id: prof.id,
        email: prof.email!,
        name: prof.name,
        delay_seconds: delaySeconds,
        priority: 0,
      }));

      const { error: insertError } = await supabase
        .from('email_verification_queue')
        .upsert(queueItems, { onConflict: 'professional_id' });

      if (insertError) throw insertError;

      toast.success(`Added ${professionals.length} emails to verification queue`);
      fetchStats();
      fetchRecentItems();
      fetchUnverifiedCount();
    } catch (error: any) {
      console.error('Error adding to queue:', error);
      toast.error(`Failed to add to queue: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processQueue = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-email-verification-queue', {
        body: { concurrency }
      });

      if (error) throw error;

      if (data.queueEmpty) {
        toast.info('Queue is empty');
        stopProcessing();
        return false;
      }

      if (data.rateLimited) {
        toast.warning('Rate limit reached - pausing for 30 seconds');
        setTimeout(() => {
          if (processing) {
            processQueue();
          }
        }, 30000);
        return false;
      }

      // Show success for concurrent processing
      if (data.processed > 1) {
        toast.success(`Processed ${data.processed} emails: ${data.successful} successful, ${data.errors} errors`);
      }

      return true;
    } catch (error: any) {
      console.error('Error processing queue:', error);
      toast.error(`Processing failed: ${error.message}`);
      return false;
    }
  };

  const startProcessing = async () => {
    setProcessing(true);
    toast.info('Started processing queue');

    // Process first item immediately
    await processQueue();

    // Set up interval for continuous processing
    const interval = window.setInterval(async () => {
      const shouldContinue = await processQueue();
      if (!shouldContinue) {
        stopProcessing();
      }
    }, (delaySeconds + 2) * 1000); // Add 2 seconds buffer

    setProcessInterval(interval);
  };

  const stopProcessing = () => {
    setProcessing(false);
    if (processInterval) {
      clearInterval(processInterval);
      setProcessInterval(null);
    }
    toast.info('Stopped processing queue');
  };

  const clearQueue = async () => {
    if (!confirm('Clear entire queue? This cannot be undone.')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('email_verification_queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      toast.success('Queue cleared');
      fetchStats();
      fetchRecentItems();
    } catch (error: any) {
      console.error('Error clearing queue:', error);
      toast.error(`Failed to clear queue: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetFailedVerifications = async () => {
    if (!confirm(`Reset ${stats.failedVerifications} failed verifications back to pending? They will be re-processed with the corrected timeout.`)) return;

    setLoading(true);
    try {
      // Get all completed items with their verification results
      const { data: itemsToReset, error: fetchError } = await supabase
        .from('email_verification_queue')
        .select('id, verification_result')
        .eq('status', 'completed')
        .not('verification_result', 'is', null);

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        throw fetchError;
      }

      if (!itemsToReset || itemsToReset.length === 0) {
        toast.info('No completed items with verification results found');
        return;
      }

      // Filter for failed verification results
      const failedIds = itemsToReset
        .filter((item: any) => item.verification_result?.status === 'failed')
        .map((item: any) => item.id);

      console.log('Items to reset:', failedIds.length, 'out of', itemsToReset.length);

      if (failedIds.length === 0) {
        toast.info('No failed verifications found');
        return;
      }

      // Reset them one by one to avoid RLS issues
      let resetCount = 0;
      for (const id of failedIds) {
        const { error: updateError } = await supabase
          .from('email_verification_queue')
          .update({
            status: 'pending',
            attempts: 0,
            error_message: null,
            started_at: null,
            completed_at: null,
            verification_result: null
          })
          .eq('id', id);

        if (!updateError) {
          resetCount++;
        } else {
          console.error('Error updating item:', id, updateError);
        }
      }

      if (resetCount > 0) {
        toast.success(`Reset ${resetCount} failed verifications to pending`);
        fetchStats();
        fetchRecentItems();
      } else {
        toast.error('Failed to reset any verifications - check console for details');
      }
    } catch (error: any) {
      console.error('Error resetting failed verifications:', error);
      toast.error(`Failed to reset: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (item: QueueItem) => {
    switch (item.status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'processing':
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{item.status}</Badge>;
    }
  };

  const progressPercent = stats.total > 0 
    ? ((stats.completed + stats.failed) / stats.total) * 100 
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Queue-Based Email Verifier
          </CardTitle>
          <CardDescription>
            Process {concurrency} emails in parallel with configurable delays • {unverifiedCount} unverified emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Concurrent processing verifies {concurrency} emails in parallel with atomic queue locking to prevent duplicates.
              Configure concurrency (1-10) and delay between batches. Cost: ~$0.02 per verification.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-6 gap-4 text-sm">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="text-2xl font-bold">{stats.processing}</div>
              <div className="text-muted-foreground">Processing</div>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold">{stats.completed}</div>
              <div className="text-muted-foreground">Completed</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold">{stats.failed}</div>
              <div className="text-muted-foreground">Failed</div>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="text-2xl font-bold">{stats.failedVerifications}</div>
              <div className="text-muted-foreground">Failed Results</div>
            </div>
          </div>

          {stats.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progressPercent.toFixed(1)}%</span>
              </div>
              <Progress value={progressPercent} className="w-full" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Emails to add:</label>
              <input
                type="number"
                min="1"
                max="500"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={loading || processing}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Concurrency:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={concurrency}
                onChange={(e) => setConcurrency(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={loading || processing}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Delay (seconds):</label>
              <input
                type="number"
                min="1"
                max="10"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={loading || processing}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by city:</label>
              <Select value={citySlug || "all"} onValueChange={(val) => setCitySlug(val === "all" ? "" : val)} disabled={loading || processing}>
                <SelectTrigger>
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
              {cities.map((city, index) => (
                <SelectItem key={`${city.slug}-${index}`} value={city.slug}>
                  {city.name}
                </SelectItem>
              ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => addToQueue(false)} 
              disabled={loading || processing}
              variant="outline"
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  Add {limit} to Queue
                </>
              )}
            </Button>

            <Button 
              onClick={() => addToQueue(true)} 
              disabled={loading || processing}
              variant="outline"
              className="flex-1"
            >
              Add ALL ({unverifiedCount})
            </Button>

            {!processing ? (
              <Button 
                onClick={startProcessing} 
                disabled={loading || stats.pending === 0}
                className="flex-1"
              >
                <Play className="mr-2 h-4 w-4" />
                Start Processing
              </Button>
            ) : (
              <Button 
                onClick={stopProcessing}
                variant="destructive"
                className="flex-1"
              >
                <Pause className="mr-2 h-4 w-4" />
                Stop Processing
              </Button>
            )}

            <Button 
              onClick={clearQueue} 
              disabled={loading || processing || stats.total === 0}
              variant="ghost"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {stats.failedVerifications > 0 && (
            <Alert className="border-orange-500">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    {stats.failedVerifications} completed items have failed verification results (likely timeout errors)
                  </span>
                  <Button 
                    onClick={resetFailedVerifications}
                    disabled={loading || processing}
                    variant="outline"
                    size="sm"
                  >
                    Reset Failed to Pending
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {recentItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Recent Queue Items:</h4>
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {recentItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                      {item.error_message && (
                        <div className="text-xs text-red-500 mt-1">{item.error_message}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {item.attempts}/{item.max_attempts} attempts
                      </span>
                      {getStatusBadge(item)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
