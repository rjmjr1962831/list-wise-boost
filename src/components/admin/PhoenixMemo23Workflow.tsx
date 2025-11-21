import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, PlayCircle, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface AgentJob {
  id: string;
  name: string;
  profileUrl: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export const PhoenixMemo23Workflow = () => {
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [progress, setProgress] = useState(0);
  const [concurrency, setConcurrency] = useState(10);

  const runWorkflow = async () => {
    setLoading(true);
    setJobs([]);
    setProgress(0);
    const processedAgentIds = new Set<string>(); // Track successfully processed agents
    
    try {
      // Get Phoenix city and realtor category
      const { data: phoenix, error: cityError } = await supabase
        .from('cities')
        .select('id, name')
        .eq('name', 'Phoenix')
        .single();

      if (cityError || !phoenix) {
        toast.error('Phoenix city not found');
        return;
      }

      const { data: category, error: catError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('slug', 'top10realestateagents')
        .single();

      if (catError || !category) {
        toast.error('Real estate agents category not found');
        return;
      }

      // Fetch agents that need enrichment (active, have zillow URL, rating >= 5.0)
      const { data: agents, error: agentsError } = await supabase
        .from('professionals')
        .select('id, name, zillow_profile_url, review_stars_rating')
        .eq('city_id', phoenix.id)
        .eq('category_id', category.id)
        .eq('active', true)
        .gte('review_stars_rating', 5.0)
        .not('zillow_profile_url', 'is', null)
        .order('zillow_data_fetched_at', { ascending: true, nullsFirst: true })
        .limit(50);

      if (agentsError) {
        toast.error('Failed to load agents');
        console.error(agentsError);
        return;
      }

      if (!agents || agents.length === 0) {
        toast.error('No agents found that need enrichment');
        return;
      }

      toast.info(`Starting memo23 enrichment for ${agents.length} Phoenix agents with ${concurrency} concurrent sessions`);
      
      // Initialize jobs
      const initialJobs: AgentJob[] = agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        profileUrl: agent.zillow_profile_url || '',
        status: 'pending' as const
      }));
      setJobs(initialJobs);

      // Process agents in batches based on concurrency
      const batchSize = concurrency;
      let completed = 0;

      for (let i = 0; i < agents.length; i += batchSize) {
        const batch = agents.slice(i, i + batchSize);
        
        // Process batch in parallel
        const batchPromises = batch.map(async (agent) => {
          const jobId = agent.id;
          
          // Skip if already successfully processed in this run
          if (processedAgentIds.has(jobId)) {
            console.log(`Skipping ${agent.name} - already processed successfully`);
            setJobs(prev => prev.map(j => 
              j.id === jobId 
                ? { ...j, status: 'success' as const, message: 'Already processed' } 
                : j
            ));
            return;
          }
          
          // Update job status to running
          setJobs(prev => prev.map(j => 
            j.id === jobId ? { ...j, status: 'running' as const } : j
          ));

          try {
            console.log(`Enriching ${agent.name}...`);
            
            // Call fetch-single-memo23-agent function
            const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
              body: { 
                professionalId: agent.id
              }
            });

            if (error) throw error;

            // Mark as successfully processed
            processedAgentIds.add(jobId);
            
            // Update job status to success
            setJobs(prev => prev.map(j => 
              j.id === jobId 
                ? { 
                    ...j, 
                    status: 'success' as const, 
                    message: `Updated ${data?.updatedFields?.length || 0} fields` 
                  } 
                : j
            ));
            
            console.log(`✓ ${agent.name} enriched successfully`);
          } catch (error: any) {
            console.error(`Error enriching ${agent.name}:`, error);
            
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
          }
        });

        // Wait for batch to complete
        await Promise.all(batchPromises);
        
        completed += batch.length;
        setProgress((completed / agents.length) * 100);
        
        // Small delay between batches
        if (i + batchSize < agents.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const successCount = jobs.filter(j => j.status === 'success').length;
      toast.success(`Workflow completed! ${successCount}/${agents.length} agents enriched successfully`);
    } catch (error: any) {
      console.error('Error in workflow:', error);
      toast.error(`Workflow failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: AgentJob['status']) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
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
  const runningCount = jobs.filter(j => j.status === 'running').length;
  const pendingCount = jobs.filter(j => j.status === 'pending').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Phoenix Memo23 Enrichment Workflow</CardTitle>
          <CardDescription>
            Enrich Phoenix agents with ProxyScrape residential proxies (10 concurrent sessions)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>What this does:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Fetches top 50 active Phoenix agents with 5.0+ ratings</li>
                <li>Uses ProxyScrape residential proxies (85-95% success rate)</li>
                <li>Runs {concurrency} concurrent enrichment sessions</li>
                <li>Extracts videos, bios, licenses, stats, specialties, contact info</li>
                <li>Rewrites bios for uniqueness using AI</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Concurrency:</label>
            <select 
              value={concurrency} 
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={loading}
              className="border rounded px-3 py-2"
            >
              <option value="1">1 (Sequential)</option>
              <option value="5">5 Sessions</option>
              <option value="10">10 Sessions</option>
              <option value="20">20 Sessions</option>
            </select>
          </div>

          <Button 
            onClick={runWorkflow} 
            disabled={loading}
            className="w-full"
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
                Start Enrichment Workflow
              </>
            )}
          </Button>

          {jobs.length > 0 && (
            <>
              <Progress value={progress} className="w-full" />
              
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="text-center p-2 bg-muted rounded">
                  <div className="font-semibold">{pendingCount}</div>
                  <div className="text-muted-foreground">Pending</div>
                </div>
                <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <div className="font-semibold">{runningCount}</div>
                  <div className="text-muted-foreground">Running</div>
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
                      <span className="font-medium">{job.name}</span>
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
