import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Play, Loader2, MapPin, Users, Clock, RefreshCw, CheckCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const STATES = [
  { code: "CA", name: "California", full: "California" },
  { code: "TX", name: "Texas", full: "Texas" },
  { code: "FL", name: "Florida", full: "Florida" },
  { code: "CO", name: "Colorado", full: "Colorado" },
  { code: "NY", name: "New York", full: "New York" },
  { code: "AZ", name: "Arizona", full: "Arizona" },
];

interface RunResult {
  city: string;
  runId?: string;
  error?: string;
}

interface PipelineResult {
  state: string;
  stateAbbr: string;
  citiesProcessed: number;
  totalCities: number;
  startIndex: number;
  nextIndex: number | null;
  runsStarted: number;
  runsFailed: number;
  message: string;
  runs: RunResult[];
  errors: RunResult[];
}

interface PollResult {
  polled: number;
  completed: number;
  stillRunning: number;
  failed: number;
  totalImported: number;
  results: Array<{
    city: string;
    status: string;
    imported?: number;
    skipped?: number;
    error?: string;
  }>;
}

export function StatePipelineRunner() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [startIndex, setStartIndex] = useState<number>(0);
  const [maxCities, setMaxCities] = useState<number>(10);
  const [running, setRunning] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [pollResult, setPollResult] = useState<PollResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [runningJobsCount, setRunningJobsCount] = useState<number>(0);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Check for running jobs on mount
  useEffect(() => {
    checkRunningJobs();
  }, []);

  const checkRunningJobs = async () => {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .select('id')
      .eq('status', 'running');
    
    if (!error && data) {
      setRunningJobsCount(data.length);
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
    setPollResult(null);
    setLogs([]);

    addLog(`🚀 Starting pipeline for ${state.full}`);
    addLog(`📍 Kicking off Apify runs for cities ${startIndex + 1} to ${startIndex + maxCities}`);

    try {
      const { data, error } = await supabase.functions.invoke('run-state-pipeline', {
        body: {
          state: state.full,
          stateAbbr: state.code,
          startIndex,
          maxCities
        }
      });

      if (error) {
        addLog(`❌ Error: ${error.message}`);
        toast.error(`Pipeline failed: ${error.message}`);
        return;
      }

      setResult(data as PipelineResult);
      addLog(`✅ Kicked off ${data.runsStarted} Apify runs`);
      
      if (data.runsFailed > 0) {
        addLog(`⚠️ Failed to start ${data.runsFailed} runs`);
      }
      
      if (data.nextIndex) {
        addLog(`➡️ Next batch starts at index ${data.nextIndex}`);
        setStartIndex(data.nextIndex);
      } else {
        addLog(`🎉 All cities in ${state.full} have been queued!`);
      }

      addLog(`⏳ Use "Poll Status" to check progress and import results`);
      toast.success(`Started ${data.runsStarted} Apify runs. Poll to check status.`);
      
      // Update running jobs count
      setRunningJobsCount(prev => prev + data.runsStarted);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Error: ${message}`);
      toast.error(`Pipeline failed: ${message}`);
    } finally {
      setRunning(false);
    }
  };

  const pollStatus = async () => {
    setPolling(true);
    addLog(`🔄 Polling for completed Apify runs...`);

    try {
      const { data, error } = await supabase.functions.invoke('poll-apify-runs', {
        body: {}
      });

      if (error) {
        addLog(`❌ Poll error: ${error.message}`);
        toast.error(`Poll failed: ${error.message}`);
        return;
      }

      setPollResult(data as PollResult);
      addLog(`📊 Polled ${data.polled} jobs: ${data.completed} completed, ${data.stillRunning} running`);
      
      if (data.totalImported > 0) {
        addLog(`✅ Imported ${data.totalImported} agents and queued for enrichment`);
        toast.success(`Imported ${data.totalImported} agents!`);
      }
      
      if (data.stillRunning > 0) {
        addLog(`⏳ ${data.stillRunning} jobs still running. Poll again in a few minutes.`);
      } else if (data.polled > 0) {
        addLog(`🎉 All polled jobs complete!`);
      }

      // Update running jobs count
      setRunningJobsCount(data.stillRunning);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Poll error: ${message}`);
      toast.error(`Poll failed: ${message}`);
    } finally {
      setPolling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          State Pipeline Runner
        </CardTitle>
        <CardDescription>
          Kick off Rigelbytes scrapes for cities in a state. Jobs run in background - poll to check status and import results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <Label className="mb-2 block">Select State</Label>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="Choose state..." />
              </SelectTrigger>
              <SelectContent>
                {STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name}
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
            <Label className="mb-2 block">Cities per Batch</Label>
            <Input 
              type="number" 
              value={maxCities} 
              onChange={(e) => setMaxCities(parseInt(e.target.value) || 10)}
              min={1}
              max={50}
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
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Runs
                </>
              )}
            </Button>
          </div>

          <div className="flex items-end">
            <Button 
              onClick={pollStatus} 
              disabled={polling}
              variant="secondary"
              className="w-full"
            >
              {polling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Polling...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Poll Status
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            Jobs run in background
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~5-10 min per city
          </Badge>
          {runningJobsCount > 0 && (
            <Badge variant="default" className="flex items-center gap-1 bg-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              {runningJobsCount} running
            </Badge>
          )}
        </div>

        {/* Start Results Summary */}
        {result && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-blue-50 dark:bg-blue-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{result.citiesProcessed}</div>
                <div className="text-sm text-muted-foreground">Cities Queued</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{result.runsStarted}</div>
                <div className="text-sm text-muted-foreground">Runs Started</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 dark:bg-orange-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600">{result.runsFailed}</div>
                <div className="text-sm text-muted-foreground">Failed to Start</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-purple-600">{result.totalCities}</div>
                <div className="text-sm text-muted-foreground">Total Cities in State</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Poll Results Summary */}
        {pollResult && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-green-50 dark:bg-green-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{pollResult.completed}</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{pollResult.stillRunning}</div>
                <div className="text-sm text-muted-foreground">Still Running</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-purple-600">{pollResult.totalImported}</div>
                <div className="text-sm text-muted-foreground">Agents Imported</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 dark:bg-red-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{pollResult.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Progress */}
        {result && result.nextIndex && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{result.citiesProcessed + result.startIndex} / {result.totalCities} cities queued</span>
            </div>
            <Progress value={(result.citiesProcessed + result.startIndex) / result.totalCities * 100} />
          </div>
        )}

        {/* Logs */}
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

        {/* Poll Results Details */}
        {pollResult && pollResult.results.length > 0 && (
          <div>
            <Label className="mb-2 block">Poll Results</Label>
            <ScrollArea className="h-64 border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">City</th>
                    <th className="text-center p-2">Status</th>
                    <th className="text-right p-2">Imported</th>
                    <th className="text-right p-2">Skipped</th>
                    <th className="text-left p-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {pollResult.results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.city}</td>
                      <td className="text-center p-2">
                        {r.status === 'completed' ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Done
                          </Badge>
                        ) : r.status === 'running' ? (
                          <Badge variant="outline" className="text-blue-600">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Running
                          </Badge>
                        ) : (
                          <Badge variant="destructive">{r.status}</Badge>
                        )}
                      </td>
                      <td className="text-right p-2">{r.imported || '-'}</td>
                      <td className="text-right p-2">{r.skipped || '-'}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {r.error?.substring(0, 40)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {/* Kicked off runs */}
        {result && result.runs.length > 0 && (
          <div>
            <Label className="mb-2 block">Started Runs ({result.runs.length})</Label>
            <ScrollArea className="h-40 border rounded-md p-3 bg-muted/50">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {result.runs.map((r, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {r.city}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
