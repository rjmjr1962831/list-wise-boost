import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, Pause, RotateCcw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface BatchResult {
  neighborhood: string;
  city: string;
  success: boolean;
  error?: string;
}

interface Stats {
  total: number;
  withWriteup: number;
  remaining: number;
}

export default function NeighborhoodWriteups() {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [currentBatch, setCurrentBatch] = useState<BatchResult[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [batchSize, setBatchSize] = useState(5);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

  const fetchStats = async () => {
    const { data: totalData } = await supabase
      .from('neighborhood_catalog')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'AZ')
      .eq('is_active', true);

    const { data: withWriteupData, count: withWriteupCount } = await supabase
      .from('neighborhood_catalog')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'AZ')
      .eq('is_active', true)
      .not('writeup_html', 'is', null);

    const { count: totalCount } = await supabase
      .from('neighborhood_catalog')
      .select('*', { count: 'exact', head: true })
      .eq('state', 'AZ')
      .eq('is_active', true);

    if (totalCount !== null && withWriteupCount !== null) {
      setStats({
        total: totalCount,
        withWriteup: withWriteupCount,
        remaining: totalCount - withWriteupCount,
      });
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const runBatch = async () => {
    if (isPaused) return;

    try {
      addLog(`Starting batch of ${batchSize} neighborhoods...`);
      
      const { data, error } = await supabase.functions.invoke('batch-neighborhood-writeups', {
        body: { batchSize, dryRun: false }
      });

      if (error) {
        addLog(`Error: ${error.message}`);
        toast.error(`Batch error: ${error.message}`);
        setIsRunning(false);
        return;
      }

      if (data.processed === 0 || data.message === 'No more neighborhoods to process') {
        addLog('✅ All neighborhoods processed!');
        toast.success('All Arizona neighborhoods have writeups!');
        setIsRunning(false);
        return;
      }

      setCurrentBatch(data.results || []);
      setProcessedCount(prev => prev + (data.successful || 0));
      addLog(`Batch complete: ${data.successful} success, ${data.failed} failed. ${data.totalRemaining} remaining.`);
      
      await fetchStats();

      // Continue with next batch if still running
      if (!isPaused && data.totalRemaining > 0) {
        setTimeout(() => runBatch(), 3000); // 3 second delay between batches
      } else if (data.totalRemaining === 0) {
        setIsRunning(false);
        toast.success('All neighborhoods processed!');
      }
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
      toast.error(err.message);
      setIsRunning(false);
    }
  };

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
    setProcessedCount(0);
    addLog('🚀 Starting batch processing...');
    runBatch();
  };

  const handlePause = () => {
    setIsPaused(true);
    addLog('⏸️ Paused processing');
  };

  const handleResume = () => {
    setIsPaused(false);
    addLog('▶️ Resuming processing...');
    runBatch();
  };

  const progressPercent = stats ? ((stats.withWriteup / stats.total) * 100) : 0;

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Neighborhood Writeup Generator</CardTitle>
          <CardDescription>
            Generate AI-powered writeups for all Arizona neighborhoods using Gemini (research) and Claude Sonnet (narrative)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          {stats && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.withWriteup} of {stats.total} neighborhoods complete</span>
                <span>{progressPercent.toFixed(1)}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-sm text-muted-foreground">
                {stats.remaining} neighborhoods remaining
              </p>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm">Batch size:</label>
              <select 
                value={batchSize} 
                onChange={(e) => setBatchSize(Number(e.target.value))}
                disabled={isRunning}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>

            {!isRunning ? (
              <Button onClick={handleStart} className="gap-2">
                <Play className="h-4 w-4" />
                Start Processing
              </Button>
            ) : isPaused ? (
              <Button onClick={handleResume} variant="outline" className="gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
            ) : (
              <Button onClick={handlePause} variant="outline" className="gap-2">
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}

            <Button onClick={fetchStats} variant="ghost" size="icon">
              <RotateCcw className="h-4 w-4" />
            </Button>

            {isRunning && !isPaused && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Processing...
              </Badge>
            )}
          </div>

          {/* Current Batch Results */}
          {currentBatch.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Last Batch Results:</h4>
              <div className="grid grid-cols-2 gap-2">
                {currentBatch.map((result, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center gap-2 p-2 rounded text-sm ${
                      result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <span className="truncate">{result.neighborhood}, {result.city}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Activity Log:</h4>
            <div className="bg-muted rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs space-y-1">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">No activity yet. Click "Start Processing" to begin.</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground">{log}</div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
