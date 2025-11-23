import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, PlayCircle, CheckCircle2, XCircle, PauseCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface CityCategory {
  cityId: string;
  cityName: string;
  categoryId: string;
  categoryName: string;
}

interface EnrichmentJob {
  id: string;
  cityName: string;
  categoryName: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export const BulkMemo23Enricher = () => {
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [pausedJobs, setPausedJobs] = useState<any[]>([]);

  // Load paused jobs on mount
  useEffect(() => {
    loadPausedJobs();
  }, []);

  const loadPausedJobs = async () => {
    const { data, error } = await supabase
      .from('enrichment_queue')
      .select('*')
      .eq('job_type', 'memo23')
      .in('status', ['paused', 'running'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPausedJobs(data);
    }
  };

  const handlePause = async () => {
    setPaused(true);
    if (currentJobId) {
      await supabase
        .from('enrichment_queue')
        .update({ 
          status: 'paused',
          paused_at: new Date().toISOString()
        })
        .eq('id', currentJobId);
      
      toast.info('Job paused. Progress saved to database.');
      await loadPausedJobs();
    }
  };

  const resumeJob = async (queueJob: any) => {
    setLoading(true);
    setPaused(false);
    setCurrentJobId(queueJob.id);

    try {
      // Update status to running
      await supabase
        .from('enrichment_queue')
        .update({ 
          status: 'running',
          paused_at: null
        })
        .eq('id', queueJob.id);

      // Fetch combinations again
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: agentCombos, error: combosError } = await supabase
        .from('professionals')
        .select('city_id, category_id, zillow_data_fetched_at, cities(name), categories(name)')
        .eq('active', true)
        .eq('city_id', queueJob.city_id);

      if (combosError) {
        toast.error('Failed to resume job');
        return;
      }

      const uniqueCombosMap = new Map<string, { combo: CityCategory, needsEnrichment: boolean }>();
      for (const agent of agentCombos || []) {
        const key = `${agent.city_id}-${agent.category_id}`;
        if (!agent.cities || !agent.categories) continue;
        
        const needsEnrichment = !agent.zillow_data_fetched_at || 
          new Date(agent.zillow_data_fetched_at) < thirtyDaysAgo;
        
        if (!uniqueCombosMap.has(key)) {
          uniqueCombosMap.set(key, {
            combo: {
              cityId: agent.city_id,
              cityName: (agent.cities as any).name,
              categoryId: agent.category_id,
              categoryName: (agent.categories as any).name
            },
            needsEnrichment
          });
        } else if (needsEnrichment) {
          uniqueCombosMap.get(key)!.needsEnrichment = true;
        }
      }
      
      const combinations = Array.from(uniqueCombosMap.values())
        .filter(item => item.needsEnrichment)
        .map(item => item.combo);

      const initialJobs: EnrichmentJob[] = combinations.map(combo => ({
        id: `${combo.cityId}-${combo.categoryId}`,
        cityName: combo.cityName,
        categoryName: combo.categoryName,
        status: 'pending' as const
      }));
      setJobs(initialJobs);

      // Resume from where we left off
      for (let i = queueJob.current_index; i < combinations.length && !paused; i++) {
        const combo = combinations[i];
        const jobId = `${combo.cityId}-${combo.categoryId}`;
        
        setJobs(prev => prev.map(j => 
          j.id === jobId ? { ...j, status: 'running' as const } : j
        ));

        try {
          const { data, error } = await supabase.functions.invoke('fetch-memo23-agents', {
            body: { 
              cityId: combo.cityId,
              categoryId: combo.categoryId
            }
          });

          if (error) throw error;

          setJobs(prev => prev.map(j => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: 'success' as const, 
                  message: `Enriched ${data?.imported || 0} profiles` 
                } 
              : j
          ));
          
          // Update database progress
          await supabase
            .from('enrichment_queue')
            .update({ 
              current_index: i + 1,
              processed_items: i + 1,
              successful_items: queueJob.successful_items + 1
            })
            .eq('id', queueJob.id);

        } catch (error: any) {
          setJobs(prev => prev.map(j => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: 'error' as const, 
                  message: error.message || 'Unknown error' 
                } 
              : j
          ));

          await supabase
            .from('enrichment_queue')
            .update({ 
              current_index: i + 1,
              processed_items: i + 1,
              failed_items: queueJob.failed_items + 1
            })
            .eq('id', queueJob.id);
        }
        
        setProgress(((i + 1) / combinations.length) * 100);
        
        if (i < combinations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!paused) {
        await supabase
          .from('enrichment_queue')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', queueJob.id);

        toast.success('Job completed!');
      }
      
      await loadPausedJobs();
    } catch (error: any) {
      toast.error(`Resume failed: ${error.message}`);
    } finally {
      setLoading(false);
      setCurrentJobId(null);
    }
  };

  const runBulkEnrichment = async () => {
    setLoading(true);
    setPaused(false);
    setJobs([]);
    setProgress(0);
    
    try {
      // Fetch only city-category combinations that have existing agents from agenscrape
      // Prioritize those not enriched in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: agentCombos, error: combosError } = await supabase
        .from('professionals')
        .select('city_id, category_id, zillow_data_fetched_at, cities(name), categories(name)')
        .eq('active', true);

      if (combosError) {
        toast.error('Failed to load agent combinations');
        return;
      }

      // Create unique city-category combinations that have agents needing enrichment
      const uniqueCombosMap = new Map<string, { combo: CityCategory, needsEnrichment: boolean }>();
      for (const agent of agentCombos || []) {
        const key = `${agent.city_id}-${agent.category_id}`;
        if (!agent.cities || !agent.categories) continue;
        
        const needsEnrichment = !agent.zillow_data_fetched_at || 
          new Date(agent.zillow_data_fetched_at) < thirtyDaysAgo;
        
        if (!uniqueCombosMap.has(key)) {
          uniqueCombosMap.set(key, {
            combo: {
              cityId: agent.city_id,
              cityName: (agent.cities as any).name,
              categoryId: agent.category_id,
              categoryName: (agent.categories as any).name
            },
            needsEnrichment
          });
        } else if (needsEnrichment) {
          // Mark combo as needing enrichment if any agent needs it
          uniqueCombosMap.get(key)!.needsEnrichment = true;
        }
      }
      
      // Filter to only combos with agents needing enrichment
      const combinations = Array.from(uniqueCombosMap.values())
        .filter(item => item.needsEnrichment)
        .map(item => item.combo);
      
      const totalCombos = uniqueCombosMap.size;
      const skippedCombos = totalCombos - combinations.length;

      if (skippedCombos > 0) {
        toast.info(`⚡ Skipping ${skippedCombos} recently-enriched combinations. Processing ${combinations.length}.`);
      } else {
        toast.info(`Starting enrichment for ${combinations.length} city-category combinations`);
      }
      
      if (combinations.length === 0) {
        toast.success('All agents are up to date! No enrichment needed.');
        setLoading(false);
        return;
      }

      // Create database job record
      const { data: queueJob, error: queueError } = await supabase
        .from('enrichment_queue')
        .insert({
          job_type: 'memo23',
          city_id: combinations[0].cityId,
          city_name: combinations[0].cityName,
          category_id: combinations[0].categoryId,
          category_name: combinations[0].categoryName,
          status: 'running',
          total_items: combinations.length,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (queueError || !queueJob) {
        toast.error('Failed to create job record');
        setLoading(false);
        return;
      }

      setCurrentJobId(queueJob.id);
      
      // Initialize jobs
      const initialJobs: EnrichmentJob[] = combinations.map(combo => ({
        id: `${combo.cityId}-${combo.categoryId}`,
        cityName: combo.cityName,
        categoryName: combo.categoryName,
        status: 'pending' as const
      }));
      setJobs(initialJobs);

      // Process each combination sequentially
      for (let i = 0; i < combinations.length && !paused; i++) {
        const combo = combinations[i];
        const jobId = `${combo.cityId}-${combo.categoryId}`;
        
        // Update job status to running
        setJobs(prev => prev.map(j => 
          j.id === jobId ? { ...j, status: 'running' as const } : j
        ));

        try {
          console.log(`Enriching ${combo.cityName} - ${combo.categoryName}...`);
          
          // Call fetch-memo23-agents function
          const { data, error } = await supabase.functions.invoke('fetch-memo23-agents', {
            body: { 
              cityId: combo.cityId,
              categoryId: combo.categoryId
            }
          });

          if (error) throw error;

          // Update job status to success
          setJobs(prev => prev.map(j => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: 'success' as const, 
                  message: `Enriched ${data?.imported || 0} profiles` 
                } 
              : j
          ));
          
          // Update database progress
          await supabase
            .from('enrichment_queue')
            .update({ 
              current_index: i + 1,
              processed_items: i + 1,
              successful_items: queueJob.successful_items + 1
            })
            .eq('id', queueJob.id);
          
          toast.success(`✓ ${combo.cityName} - ${combo.categoryName}`);
        } catch (error: any) {
          console.error(`Error enriching ${combo.cityName} - ${combo.categoryName}:`, error);
          
          // Update job status to error
          setJobs(prev => prev.map(j => 
            j.id === jobId 
              ? { 
                  ...j, 
                  status: 'error' as const, 
                  message: error.message || 'Unknown error' 
                } 
              : j
          ));

          await supabase
            .from('enrichment_queue')
            .update({ 
              current_index: i + 1,
              processed_items: i + 1,
              failed_items: queueJob.failed_items + 1,
              error_message: error.message
            })
            .eq('id', queueJob.id);
        }
        
        // Update progress
        setProgress(((i + 1) / combinations.length) * 100);
        
        // Small delay between requests to avoid rate limiting
        if (i < combinations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!paused) {
        await supabase
          .from('enrichment_queue')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', queueJob.id);

        toast.success('Bulk enrichment completed!');
      }
      
      await loadPausedJobs();
    } catch (error: any) {
      console.error('Error in bulk enrichment:', error);
      toast.error(`Bulk enrichment failed: ${error.message}`);
    } finally {
      setLoading(false);
      setCurrentJobId(null);
    }
  };

  const getStatusIcon = (status: EnrichmentJob['status']) => {
    switch (status) {
      case 'pending':
        return null;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const successCount = jobs.filter(j => j.status === 'success').length;
  const errorCount = jobs.filter(j => j.status === 'error').length;
  const pendingCount = jobs.filter(j => j.status === 'pending' || j.status === 'running').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Memo23 Enrichment</CardTitle>
          <CardDescription>
            Enrich all agents across all cities with fresh memo23 data (videos, licenses, stats, bios)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              This will fetch enriched data from memo23 for all agents in all active city-category combinations.
              It includes video URLs, professional info, sales stats, and more. Process runs sequentially to avoid rate limits.
            </AlertDescription>
          </Alert>

          {pausedJobs.length > 0 && (
            <Alert>
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>{pausedJobs.length} paused job(s) available to resume</span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={runBulkEnrichment} 
              disabled={loading}
              className="flex-1"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enriching... {Math.round(progress)}%
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Start New Job
                </>
              )}
            </Button>

            {loading && !paused && (
              <Button 
                onClick={handlePause}
                variant="outline"
                size="lg"
              >
                <PauseCircle className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
          </div>

          {pausedJobs.map(job => (
            <div key={job.id} className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-medium">{job.city_name} - {job.category_name}</div>
                  <div className="text-sm text-muted-foreground">
                    Progress: {job.processed_items}/{job.total_items} 
                    ({Math.round((job.processed_items / job.total_items) * 100)}%)
                  </div>
                </div>
                <Button
                  onClick={() => resumeJob(job)}
                  disabled={loading}
                  size="sm"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              </div>
              <Progress value={(job.processed_items / job.total_items) * 100} className="w-full" />
            </div>
          ))}

          {jobs.length > 0 && (
            <>
              <Progress value={progress} className="w-full" />
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="font-semibold">{pendingCount}</div>
                  <div className="text-muted-foreground">Pending</div>
                </div>
                <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded">
                  <div className="font-semibold">{successCount}</div>
                  <div className="text-muted-foreground">Success</div>
                </div>
                <div className="text-center p-2 bg-red-50 dark:bg-red-950 rounded">
                  <div className="font-semibold">{errorCount}</div>
                  <div className="text-muted-foreground">Errors</div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-1">
                {jobs.map(job => (
                  <div 
                    key={job.id} 
                    className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {getStatusIcon(job.status)}
                      <span className="font-medium">{job.cityName}</span>
                      <span className="text-muted-foreground">-</span>
                      <span>{job.categoryName}</span>
                    </div>
                    {job.message && (
                      <span className="text-xs text-muted-foreground">{job.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
