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
import { Play, Pause, Square, RefreshCw, Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";

const STATES = [
  { code: "CA", name: "California" },
  { code: "TX", name: "Texas" },
  { code: "FL", name: "Florida" },
  { code: "CO", name: "Colorado" },
  { code: "NY", name: "New York" },
  { code: "AZ", name: "Arizona" },
];

interface PipelineState {
  id: string;
  pipeline_name: string;
  state: string;
  state_abbr: string;
  current_index: number;
  batch_size: number;
  concurrency: number;
  is_running: boolean;
  is_paused: boolean;
  total_processed: number;
  total_qualified: number;
  total_not_qualified: number;
  total_duplicates: number;
  total_no_results: number;
  total_errors: number;
  last_run_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export function BackgroundPipelineControl() {
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState("");
  const [startIndex, setStartIndex] = useState(0);
  const [batchSize, setBatchSize] = useState(50);
  const [concurrency, setConcurrency] = useState(5);
  const [licenseCounts, setLicenseCounts] = useState<Record<string, number>>({});

  const fetchPipeline = async () => {
    const { data, error } = await supabase
      .from('pipeline_state')
      .select('*')
      .eq('pipeline_name', 'state-licenses')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching pipeline:', error);
    }
    setPipeline(data as PipelineState | null);
    setLoading(false);
  };

  const fetchLicenseCounts = async () => {
    const counts: Record<string, number> = {};
    for (const state of STATES) {
      const { count } = await supabase
        .from('state_licenses')
        .select('*', { count: 'exact', head: true })
        .eq('state', state.code);  // Use state code (CA, TX) not full name
      counts[state.code] = count || 0;
    }
    setLicenseCounts(counts);
  };

  useEffect(() => {
    fetchPipeline();
    fetchLicenseCounts();
    
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchPipeline, 10000);
    return () => clearInterval(interval);
  }, []);

  const startPipeline = async () => {
    if (!selectedState) {
      toast.error('Please select a state');
      return;
    }

    const stateInfo = STATES.find(s => s.code === selectedState);
    if (!stateInfo) return;

    const pipelineData = {
      pipeline_name: 'state-licenses',
      state: stateInfo.name,
      state_abbr: stateInfo.code,
      current_index: startIndex,
      batch_size: batchSize,
      concurrency: concurrency,
      is_running: true,
      is_paused: false,
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
      total_processed: 0,
      total_qualified: 0,
      total_not_qualified: 0,
      total_duplicates: 0,
      total_no_results: 0,
      total_errors: 0,
    };

    const { error } = await supabase
      .from('pipeline_state')
      .upsert(pipelineData, { onConflict: 'pipeline_name' });

    if (error) {
      toast.error('Failed to start pipeline: ' + error.message);
      return;
    }

    toast.success(`Started background pipeline for ${stateInfo.name}`);
    fetchPipeline();
  };

  const pausePipeline = async () => {
    if (!pipeline) return;
    
    const { error } = await supabase
      .from('pipeline_state')
      .update({ is_paused: true })
      .eq('id', pipeline.id);

    if (error) {
      toast.error('Failed to pause: ' + error.message);
      return;
    }

    toast.success('Pipeline paused');
    fetchPipeline();
  };

  const resumePipeline = async () => {
    if (!pipeline) return;
    
    const { error } = await supabase
      .from('pipeline_state')
      .update({ is_paused: false })
      .eq('id', pipeline.id);

    if (error) {
      toast.error('Failed to resume: ' + error.message);
      return;
    }

    toast.success('Pipeline resumed');
    fetchPipeline();
  };

  const stopPipeline = async () => {
    if (!pipeline) return;
    
    const { error } = await supabase
      .from('pipeline_state')
      .update({ 
        is_running: false, 
        is_paused: false,
        completed_at: new Date().toISOString()
      })
      .eq('id', pipeline.id);

    if (error) {
      toast.error('Failed to stop: ' + error.message);
      return;
    }

    toast.success('Pipeline stopped');
    fetchPipeline();
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const isActive = pipeline?.is_running && !pipeline?.is_paused;
  const isPaused = pipeline?.is_running && pipeline?.is_paused;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Background Pipeline (Cron)
        </CardTitle>
        <CardDescription>
          Runs automatically every 2 minutes. Safe to close browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Display */}
        {pipeline && (
          <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isActive && <Badge className="bg-green-500">Running</Badge>}
                {isPaused && <Badge variant="secondary">Paused</Badge>}
                {!pipeline.is_running && pipeline.completed_at && <Badge variant="outline">Completed</Badge>}
                {!pipeline.is_running && !pipeline.completed_at && <Badge variant="outline">Stopped</Badge>}
                <span className="font-medium">{pipeline.state}</span>
              </div>
              <div className="flex gap-2">
                {isActive && (
                  <Button size="sm" variant="secondary" onClick={pausePipeline}>
                    <Pause className="h-4 w-4 mr-1" /> Pause
                  </Button>
                )}
                {isPaused && (
                  <Button size="sm" variant="secondary" onClick={resumePipeline}>
                    <Play className="h-4 w-4 mr-1" /> Resume
                  </Button>
                )}
                {pipeline.is_running && (
                  <Button size="sm" variant="destructive" onClick={stopPipeline}>
                    <Square className="h-4 w-4 mr-1" /> Stop
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Index:</span>
                <span className="ml-2 font-mono">{pipeline.current_index.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Processed:</span>
                <span className="ml-2 font-mono">{pipeline.total_processed.toLocaleString()}</span>
              </div>
              <div className="text-green-600">
                <span className="text-muted-foreground">Qualified:</span>
                <span className="ml-2 font-mono">{pipeline.total_qualified.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duplicates:</span>
                <span className="ml-2 font-mono">{pipeline.total_duplicates.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Last run: {formatTime(pipeline.last_run_at)}
              {pipeline.error_message && (
                <span className="text-red-500 ml-4">Error: {pipeline.error_message}</span>
              )}
            </div>
          </div>
        )}

        {/* Start New Pipeline */}
        {!pipeline?.is_running && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>State</Label>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map(s => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name} ({(licenseCounts[s.code] || 0).toLocaleString()} licenses)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Index</Label>
                <Input 
                  type="number" 
                  value={startIndex} 
                  onChange={(e) => setStartIndex(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Batch Size</Label>
                <Input 
                  type="number" 
                  value={batchSize} 
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 50)}
                />
              </div>
              <div>
                <Label>Concurrency</Label>
                <Input 
                  type="number" 
                  value={concurrency} 
                  onChange={(e) => setConcurrency(parseInt(e.target.value) || 5)}
                />
              </div>
            </div>

            <Button onClick={startPipeline} disabled={!selectedState} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Start Background Pipeline
            </Button>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={fetchPipeline}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </CardContent>
    </Card>
  );
}
