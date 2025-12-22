import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Play, Loader2, MapPin, Users, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const STATES = [
  { code: "CA", name: "California", full: "California" },
  { code: "TX", name: "Texas", full: "Texas" },
  { code: "FL", name: "Florida", full: "Florida" },
  { code: "CO", name: "Colorado", full: "Colorado" },
  { code: "NY", name: "New York", full: "New York" },
  { code: "AZ", name: "Arizona", full: "Arizona" },
];

interface PipelineResult {
  state: string;
  citiesProcessed: number;
  totalCities: number;
  startIndex: number;
  nextIndex: number | null;
  totalImported: number;
  totalSkipped: number;
  totalQueued: number;
  errors: number;
  results: Array<{
    city: string;
    imported: number;
    skipped: number;
    enriched: number;
    error?: string;
  }>;
}

export function StatePipelineRunner() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [startIndex, setStartIndex] = useState<number>(0);
  const [maxCities, setMaxCities] = useState<number>(100);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
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
    setLogs([]);

    addLog(`🚀 Starting pipeline for ${state.full}`);
    addLog(`📍 Processing cities ${startIndex + 1} to ${startIndex + maxCities}`);
    addLog(`⚙️ Using 5 concurrent processes`);

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
      addLog(`✅ Batch complete!`);
      addLog(`📊 Imported: ${data.totalImported}, Skipped: ${data.totalSkipped}`);
      addLog(`🔄 Queued for enrichment: ${data.totalQueued}`);
      
      if (data.nextIndex) {
        addLog(`➡️ Next batch starts at index ${data.nextIndex}`);
        setStartIndex(data.nextIndex);
        toast.success(`Batch complete! ${data.citiesProcessed} cities processed. Next batch starting...`);
      } else {
        addLog(`🎉 All cities in ${state.full} processed!`);
        toast.success(`All ${data.totalCities} cities in ${state.full} have been processed!`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Error: ${message}`);
      toast.error(`Pipeline failed: ${message}`);
    } finally {
      setRunning(false);
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
          Run Rigelbytes + enrichment across all cities in a state using state_licenses data.
          Uses 5 concurrent processes throughout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
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
              onChange={(e) => setMaxCities(parseInt(e.target.value) || 100)}
              min={1}
              max={500}
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
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Pipeline
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            5 Concurrent Processes
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~20 min per city
          </Badge>
        </div>

        {/* Results Summary */}
        {result && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-blue-50 dark:bg-blue-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{result.citiesProcessed}</div>
                <div className="text-sm text-muted-foreground">Cities Processed</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{result.totalImported}</div>
                <div className="text-sm text-muted-foreground">Agents Imported</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-purple-600">{result.totalQueued}</div>
                <div className="text-sm text-muted-foreground">Queued for Enrichment</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 dark:bg-orange-950">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600">{result.errors}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Progress */}
        {result && result.nextIndex && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{result.citiesProcessed + result.startIndex} / {result.totalCities} cities</span>
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

        {/* City Results */}
        {result && result.results.length > 0 && (
          <div>
            <Label className="mb-2 block">City Results</Label>
            <ScrollArea className="h-64 border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">City</th>
                    <th className="text-right p-2">Imported</th>
                    <th className="text-right p-2">Skipped</th>
                    <th className="text-right p-2">Enriched</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.city}</td>
                      <td className="text-right p-2">{r.imported}</td>
                      <td className="text-right p-2">{r.skipped}</td>
                      <td className="text-right p-2">{r.enriched}</td>
                      <td className="p-2">
                        {r.error ? (
                          <Badge variant="destructive" className="text-xs">{r.error.substring(0, 30)}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-green-100">Success</Badge>
                        )}
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
