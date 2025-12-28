import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Loader2, Square, Play, AlertCircle } from "lucide-react";

interface SynthesisStats {
  totalQualified: number;
  fullSynthesis: number;
  shortSynthesis: number;
  noSynthesis: number;
  needsResynthesis: number;
}

interface StateStats {
  state: string;
  count: number;
}

export function IncompleteSynthesisRunner() {
  const [stats, setStats] = useState<SynthesisStats | null>(null);
  const [stateStats, setStateStats] = useState<StateStats[]>([]);
  const [selectedState, setSelectedState] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchSize, setBatchSize] = useState(20);
  const [concurrency, setConcurrency] = useState(3);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const stoppedRef = useRef(false);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setIsLoading(true);
    
    try {
      // Get all qualified agents with their bio lengths
      const { data: professionals, error } = await supabase
        .from('professionals')
        .select('id, synthesized_bio, city:cities(state)')
        .eq('active', true)
        .gte('review_stars_rating', 4.8)
        .gte('num_total_reviews', 20);

      if (error) throw error;

      const totalQualified = professionals?.length || 0;
      
      // Categorize by bio length
      let fullSynthesis = 0;
      let shortSynthesis = 0;
      let noSynthesis = 0;
      const stateCounts: Record<string, number> = {};

      professionals?.forEach(p => {
        const bioLength = p.synthesized_bio?.length || 0;
        const state = (p.city as any)?.state || 'Unknown';
        
        if (bioLength === 0) {
          noSynthesis++;
          stateCounts[state] = (stateCounts[state] || 0) + 1;
        } else if (bioLength <= 600) {
          shortSynthesis++;
          stateCounts[state] = (stateCounts[state] || 0) + 1;
        } else {
          fullSynthesis++;
        }
      });

      setStats({
        totalQualified,
        fullSynthesis,
        shortSynthesis,
        noSynthesis,
        needsResynthesis: shortSynthesis + noSynthesis
      });

      // Convert state counts to sorted array
      const stateStatsArray = Object.entries(stateCounts)
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count);
      
      setStateStats(stateStatsArray);

    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to load synthesis stats');
    } finally {
      setIsLoading(false);
    }
  }

  async function startResynthesis(dryRun: boolean = false) {
    setIsProcessing(true);
    stoppedRef.current = false;
    setLogs([]);
    setProcessedCount(0);

    const stateFilter = selectedState === 'all' ? undefined : selectedState;
    const stateLabel = stateFilter ? ` for ${stateFilter}` : '';

    try {
      // Get count of agents to process
      const { data: professionals, error: countError } = await supabase
        .from('professionals')
        .select('id, synthesized_bio, city:cities(state)')
        .eq('active', true)
        .gte('review_stars_rating', 4.8)
        .gte('num_total_reviews', 20);

      if (countError) throw countError;

      // Filter by short/missing bios and state
      let toProcess = professionals?.filter(p => {
        const bioLength = p.synthesized_bio?.length || 0;
        const passesFilter = bioLength === 0 || bioLength <= 600;
        const passesState = !stateFilter || (p.city as any)?.state === stateFilter;
        return passesFilter && passesState;
      }) || [];

      setTotalToProcess(toProcess.length);
      addLog(`🚀 Starting re-synthesis${stateLabel}: ${toProcess.length} agents with short/missing bios`);
      addLog(`📊 Batch size: ${batchSize}, Concurrency: ${concurrency}`);
      
      if (dryRun) {
        addLog(`⚠️ DRY RUN MODE - No changes will be made`);
      }

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('rerun-press-synthesis', {
        body: {
          batchSize,
          concurrency,
          dryRun,
          offset: 0,
          state: stateFilter,
          targetShortBios: true
        }
      });

      if (error) {
        addLog(`❌ Error: ${error.message}`);
        toast.error(`Re-synthesis failed: ${error.message}`);
      } else {
        addLog(`✅ Re-synthesis job started in background`);
        addLog(`📋 Response: ${JSON.stringify(data)}`);
        toast.success(`Re-synthesis started${stateLabel}! Check edge function logs for progress.`);
      }

    } catch (error) {
      console.error('Error starting re-synthesis:', error);
      addLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Failed to start re-synthesis');
    } finally {
      setIsProcessing(false);
    }
  }

  function addLog(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }

  function stopProcessing() {
    stoppedRef.current = true;
    setIsProcessing(false);
    addLog('⏹️ Stop requested (note: background job may continue)');
    toast.info('Stopped. Note: background job may continue processing.');
  }

  const selectedStateCount = selectedState === 'all' 
    ? stats?.needsResynthesis || 0
    : stateStats.find(s => s.state === selectedState)?.count || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Re-Synthesize Incomplete Agents
          </CardTitle>
          <CardDescription>
            Re-run Claude Sonnet 4 synthesis for agents with short (≤600 chars) or missing bios. 
            Updates synthesized_bio with rich 4-paragraph format, selection_rationale, and syncs to Pipedrive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stats...
            </div>
          ) : stats ? (
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <Badge variant="secondary">{stats.totalQualified.toLocaleString()} Qualified Agents</Badge>
                <Badge className="bg-primary text-primary-foreground">{stats.fullSynthesis.toLocaleString()} Full Synthesis (&gt;600 chars)</Badge>
                <Badge className="bg-amber-500 text-black">{stats.shortSynthesis.toLocaleString()} Short Synthesis (≤600)</Badge>
                <Badge className="bg-destructive text-destructive-foreground">{stats.noSynthesis.toLocaleString()} No Synthesis</Badge>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <span className="font-medium">
                  {stats.needsResynthesis.toLocaleString()} agents need re-synthesis with latest Claude Sonnet 4 prompt
                </span>
              </div>
            </div>
          ) : null}

          {/* Controls */}
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States ({stats?.needsResynthesis || 0})</SelectItem>
                {stateStats.map(s => (
                  <SelectItem key={s.state} value={s.state}>
                    {s.state} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={batchSize.toString()} onValueChange={(v) => setBatchSize(parseInt(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Batch size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per batch</SelectItem>
                <SelectItem value="20">20 per batch</SelectItem>
                <SelectItem value="50">50 per batch</SelectItem>
                <SelectItem value="100">100 per batch</SelectItem>
              </SelectContent>
            </Select>

            <Select value={concurrency.toString()} onValueChange={(v) => setConcurrency(parseInt(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Concurrency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 concurrent</SelectItem>
                <SelectItem value="3">3 concurrent</SelectItem>
                <SelectItem value="5">5 concurrent</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchStats}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            {!isProcessing ? (
              <>
                <Button
                  onClick={() => startResynthesis(true)}
                  variant="outline"
                  disabled={selectedStateCount === 0}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Dry Run ({selectedStateCount.toLocaleString()} agents)
                </Button>

                <Button
                  onClick={() => startResynthesis(false)}
                  disabled={selectedStateCount === 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Re-Synthesis ({selectedStateCount.toLocaleString()} agents)
                </Button>
              </>
            ) : (
              <Button
                onClick={stopProcessing}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
          </div>

          {/* Progress */}
          {isProcessing && totalToProcess > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing in background...
                </span>
                <span className="text-muted-foreground">
                  {processedCount} / {totalToProcess}
                </span>
              </div>
              <Progress value={(processedCount / totalToProcess) * 100} className="h-2" />
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Logs</h4>
              <ScrollArea className="h-[200px] border rounded-md p-3 bg-muted/50">
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((log, idx) => (
                    <div key={idx} className="text-muted-foreground">{log}</div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* State Breakdown */}
          {stateStats.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Agents Needing Re-Synthesis by State</h4>
              <div className="flex gap-2 flex-wrap">
                {stateStats.slice(0, 10).map(s => (
                  <Badge 
                    key={s.state} 
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setSelectedState(s.state)}
                  >
                    {s.state}: {s.count}
                  </Badge>
                ))}
                {stateStats.length > 10 && (
                  <Badge variant="outline">+{stateStats.length - 10} more</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
