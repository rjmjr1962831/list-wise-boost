import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Play, Loader2, MapPin, Users, Clock, CheckCircle, XCircle, AlertCircle, Search, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const STATES = [
  { code: "CA", name: "California", full: "California" },
  { code: "TX", name: "Texas", full: "Texas" },
  { code: "FL", name: "Florida", full: "Florida" },
  { code: "CO", name: "Colorado", full: "Colorado" },
  { code: "NY", name: "New York", full: "New York" },
  { code: "AZ", name: "Arizona", full: "Arizona" },
];

interface AgentResult {
  name: string;
  licenseNumber: string;
  city: string;
  status: 'qualified' | 'not_qualified' | 'duplicate' | 'error' | 'no_result';
  zillowUrl?: string;
  rating?: number;
  reviewCount?: number;
  error?: string;
}

interface ProcessingStats {
  processed: number;
  qualified: number;
  notQualified: number;
  duplicates: number;
  noResults: number;
  errors: number;
}

interface PipelineResult {
  state: string;
  stateAbbr: string;
  startIndex: number;
  nextIndex: number | null;
  totalInState: number;
  hasMore: boolean;
  stats: ProcessingStats;
  results: AgentResult[];
  message: string;
}

export function StatePipelineRunner() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedState, setSelectedState] = useState<string>("");
  const [startIndex, setStartIndex] = useState<number>(0);
  const [batchSize, setBatchSize] = useState<number>(50);
  const [concurrency, setConcurrency] = useState<number>(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [restartFromEmail, setRestartFromEmail] = useState(false);
  const [totalStats, setTotalStats] = useState<ProcessingStats>({
    processed: 0,
    qualified: 0,
    notQualified: 0,
    duplicates: 0,
    noResults: 0,
    errors: 0
  });
  const [licenseCounts, setLicenseCounts] = useState<Record<string, number>>({});

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Check for restart params from email link
  useEffect(() => {
    const pipelineState = searchParams.get('pipeline_state');
    const pipelineIndex = searchParams.get('pipeline_index');
    
    if (pipelineState && pipelineIndex) {
      setSelectedState(pipelineState);
      setStartIndex(parseInt(pipelineIndex) || 0);
      setRestartFromEmail(true);
      addLog(`📧 Restart requested from email: ${pipelineState} at index ${pipelineIndex}`);
      
      // Clear the URL params
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  // Fetch license counts for each state on mount
  useEffect(() => {
    fetchLicenseCounts();
  }, []);

  const fetchLicenseCounts = async () => {
    for (const state of STATES) {
      const { count } = await supabase
        .from('state_licenses')
        .select('*', { count: 'exact', head: true })
        .eq('state', state.code)
        .not('city', 'is', null);
      
      if (count !== null) {
        setLicenseCounts(prev => ({ ...prev, [state.code]: count }));
      }
    }
  };

  const runPipeline = async () => {
    if (!selectedState) {
      toast.error("Please select a state");
      return;
    }

    const state = STATES.find(s => s.code === selectedState);
    if (!state) return;

    setRunning(true);
    setResult(null);

    addLog(`🚀 Starting sequential pipeline for ${state.full}`);
    addLog(`📍 Processing agents ${startIndex + 1} to ${startIndex + batchSize}`);
    addLog(`⚙️ Concurrency: ${concurrency} agents at a time`);
    addLog(`⏳ Each agent takes ~30-60 seconds (Rigelbytes search)`);

    try {
      const { data, error } = await supabase.functions.invoke('process-state-licenses', {
        body: {
          state: state.full,
          stateAbbr: state.code,
          startIndex,
          batchSize,
          concurrency
        }
      });

      if (error) {
        addLog(`❌ Error: ${error.message}`);
        toast.error(`Pipeline failed: ${error.message}`);
        return;
      }

      const pipelineResult = data as PipelineResult;
      setResult(pipelineResult);
      
      // Update total stats
      setTotalStats(prev => ({
        processed: prev.processed + pipelineResult.stats.processed,
        qualified: prev.qualified + pipelineResult.stats.qualified,
        notQualified: prev.notQualified + pipelineResult.stats.notQualified,
        duplicates: prev.duplicates + pipelineResult.stats.duplicates,
        noResults: prev.noResults + pipelineResult.stats.noResults,
        errors: prev.errors + pipelineResult.stats.errors
      }));

      addLog(`✅ Batch complete: ${pipelineResult.stats.processed} processed`);
      addLog(`   📊 Qualified: ${pipelineResult.stats.qualified}`);
      addLog(`   ⏭️ Not Qualified: ${pipelineResult.stats.notQualified}`);
      addLog(`   🔄 Duplicates: ${pipelineResult.stats.duplicates}`);
      addLog(`   🔍 No Zillow: ${pipelineResult.stats.noResults}`);
      
      if (pipelineResult.hasMore && pipelineResult.nextIndex) {
        addLog(`➡️ Continue at index ${pipelineResult.nextIndex}`);
        setStartIndex(pipelineResult.nextIndex);
        toast.success(`${pipelineResult.stats.qualified} qualified! Continue at index ${pipelineResult.nextIndex}`);
      } else {
        addLog(`🎉 All agents in ${state.full} have been processed!`);
        toast.success(`Complete! ${pipelineResult.stats.qualified} agents qualified total.`);
      }

    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Error: ${message}`);
      addLog(`📧 Failure notification email sent. Check your inbox for restart link.`);
      toast.error(`Pipeline failed: ${message}. Check email for restart link.`);
    } finally {
      setRunning(false);
      setRestartFromEmail(false);
    }
  };

  const resetStats = () => {
    setTotalStats({
      processed: 0,
      qualified: 0,
      notQualified: 0,
      duplicates: 0,
      noResults: 0,
      errors: 0
    });
    setLogs([]);
    setResult(null);
    setStartIndex(0);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'qualified':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'not_qualified':
        return <XCircle className="h-4 w-4 text-orange-500" />;
      case 'duplicate':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'no_result':
        return <Search className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'qualified':
        return <Badge className="bg-green-100 text-green-800">Qualified</Badge>;
      case 'not_qualified':
        return <Badge className="bg-orange-100 text-orange-800">Low Rating</Badge>;
      case 'duplicate':
        return <Badge className="bg-blue-100 text-blue-800">Duplicate</Badge>;
      case 'no_result':
        return <Badge variant="outline">No Zillow</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          State License Pipeline
        </CardTitle>
        <CardDescription>
          Process agents one-by-one from state_licenses. Each agent is searched on Zillow via Rigelbytes.
          Agents with 4.5+ stars and 50+ reviews are qualified and queued for full enrichment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Restart from Email Banner */}
        {restartFromEmail && selectedState && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Restart requested from email
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Ready to resume {STATES.find(s => s.code === selectedState)?.name} at index {startIndex}
              </p>
            </div>
            <Button onClick={runPipeline} disabled={running}>
              <Play className="h-4 w-4 mr-2" />
              Resume Now
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="grid gap-4 md:grid-cols-6">
          <div>
            <Label className="mb-2 block">State</Label>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="Choose..." />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name} ({licenseCounts[state.code]?.toLocaleString() || '...'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Start Index</Label>
            <Input 
              type="number" 
              value={startIndex} 
              onChange={(e) => setStartIndex(parseInt(e.target.value) || 0)}
              min={0}
            />
          </div>

          <div>
            <Label className="mb-2 block">Batch Size</Label>
            <Input 
              type="number" 
              value={batchSize} 
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 50)}
              min={1}
              max={100}
            />
          </div>

          <div>
            <Label className="mb-2 block">Concurrency</Label>
            <Input 
              type="number" 
              value={concurrency} 
              onChange={(e) => setConcurrency(parseInt(e.target.value) || 5)}
              min={1}
              max={10}
            />
          </div>

          <div className="flex items-end">
            <Button 
              onClick={runPipeline} 
              disabled={running || !selectedState}
              className="w-full"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Batch
                </>
              )}
            </Button>
          </div>

          <div className="flex items-end">
            <Button 
              onClick={resetStats} 
              variant="outline"
              className="w-full"
              disabled={running}
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Info Badges */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~30-60s per agent
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {concurrency} concurrent searches
          </Badge>
          <Badge variant="outline">
            Qualification: 4.5★ + 50 reviews
          </Badge>
        </div>

        {/* Running Total Stats */}
        {totalStats.processed > 0 && (
          <div className="grid gap-4 md:grid-cols-6">
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{totalStats.processed}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{totalStats.qualified}</div>
                <div className="text-sm text-muted-foreground">Qualified</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 dark:bg-orange-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600">{totalStats.notQualified}</div>
                <div className="text-sm text-muted-foreground">Low Rating</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{totalStats.duplicates}</div>
                <div className="text-sm text-muted-foreground">Duplicates</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-50 dark:bg-gray-900">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-gray-600">{totalStats.noResults}</div>
                <div className="text-sm text-muted-foreground">No Zillow</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{totalStats.errors}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Progress */}
        {result && selectedState && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress in {STATES.find(s => s.code === selectedState)?.name}</span>
              <span>{result.nextIndex || result.startIndex + result.stats.processed} / {result.totalInState}</span>
            </div>
            <Progress value={((result.nextIndex || result.startIndex + result.stats.processed) / result.totalInState) * 100} />
          </div>
        )}

        {/* Activity Log */}
        {logs.length > 0 && (
          <div>
            <Label className="mb-2 block">Activity Log</Label>
            <ScrollArea className="h-48 border rounded-md p-3 bg-muted/50">
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Recent Results */}
        {result && result.results.length > 0 && (
          <div>
            <Label className="mb-2 block">Recent Results ({result.results.length} shown)</Label>
            <ScrollArea className="h-64 border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Agent</th>
                    <th className="text-left p-2">City</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-right p-2">Rating</th>
                    <th className="text-right p-2">Reviews</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(r.status)}
                          <span className="truncate max-w-[200px]">{r.name}</span>
                        </div>
                      </td>
                      <td className="p-2 text-muted-foreground">{r.city}</td>
                      <td className="text-center p-2">{getStatusBadge(r.status)}</td>
                      <td className="text-right p-2">
                        {r.rating ? `${r.rating.toFixed(1)}★` : '-'}
                      </td>
                      <td className="text-right p-2">
                        {r.reviewCount || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
