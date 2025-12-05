import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Loader2, Play, Square } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
}

interface SynthesisResult {
  id: string;
  name: string;
  success: boolean;
  error?: string;
}

export default function UnsynthesizedProfileRunner() {
  const [unsynthesized, setUnsynthesized] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SynthesisResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const stopRef = useRef(false);
  const { toast } = useToast();

  const fetchUnsynthesized = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('professionals')
      .select('id, name')
      .eq('active', true)
      .is('profile_last_synthesized_at', null)
      .order('name');

    if (error) {
      toast({ title: 'Error fetching agents', description: error.message, variant: 'destructive' });
    } else {
      setUnsynthesized(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUnsynthesized();
  }, []);

  const runSynthesis = async () => {
    if (unsynthesized.length === 0) return;

    setRunning(true);
    setResults([]);
    setCurrentIndex(0);
    stopRef.current = false;

    for (let i = 0; i < unsynthesized.length; i++) {
      if (stopRef.current) break;

      const agent = unsynthesized[i];
      setCurrentIndex(i + 1);

      try {
        const { data, error } = await supabase.functions.invoke('synthesize-agent-profile', {
          body: { professionalId: agent.id }
        });

        if (error) throw error;

        setResults(prev => [...prev, { id: agent.id, name: agent.name, success: true }]);
      } catch (err: any) {
        setResults(prev => [...prev, { 
          id: agent.id, 
          name: agent.name, 
          success: false, 
          error: err.message || 'Unknown error' 
        }]);
      }

      // Small delay between requests
      if (i < unsynthesized.length - 1 && !stopRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setRunning(false);
    toast({ 
      title: 'Synthesis complete', 
      description: `Processed ${results.length + 1} agents` 
    });
    
    // Refresh the list
    fetchUnsynthesized();
  };

  const stopSynthesis = () => {
    stopRef.current = true;
    setRunning(false);
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const progress = unsynthesized.length > 0 ? (currentIndex / unsynthesized.length) * 100 : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unsynthesized Profile Runner</CardTitle>
        <CardDescription>
          Run AI synthesis on profiles that haven't been processed yet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium text-2xl">{unsynthesized.length}</span>
            <span className="text-muted-foreground ml-2">profiles need synthesis</span>
          </div>
          
          {!running ? (
            <Button 
              onClick={runSynthesis} 
              disabled={unsynthesized.length === 0}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Run All ({unsynthesized.length})
            </Button>
          ) : (
            <Button onClick={stopSynthesis} variant="destructive" className="gap-2">
              <Square className="h-4 w-4" />
              Stop
            </Button>
          )}
        </div>

        {running && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">
              Processing {currentIndex} of {unsynthesized.length}...
            </p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" /> {successCount} success
              </span>
              <span className="text-red-600 flex items-center gap-1">
                <XCircle className="h-4 w-4" /> {failCount} failed
              </span>
            </div>
            
            <div className="max-h-60 overflow-y-auto border rounded-md">
              {results.map((result, idx) => (
                <div 
                  key={result.id} 
                  className={`px-3 py-2 text-sm flex items-center justify-between ${
                    idx % 2 === 0 ? 'bg-muted/50' : ''
                  }`}
                >
                  <span>{result.name}</span>
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <span className="text-red-600 text-xs">{result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {unsynthesized.length > 0 && !running && results.length === 0 && (
          <div className="max-h-40 overflow-y-auto border rounded-md">
            {unsynthesized.map((agent, idx) => (
              <div 
                key={agent.id} 
                className={`px-3 py-2 text-sm ${idx % 2 === 0 ? 'bg-muted/50' : ''}`}
              >
                {agent.name}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
