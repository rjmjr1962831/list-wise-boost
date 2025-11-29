import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, TestTube } from "lucide-react";

export const TestAvondaleEnrichment = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTest = async () => {
    setIsRunning(true);
    setLog([]);
    
    try {
      addLog("🚀 Starting 2-agent test for Avondale with Claude enrichment...");

      // Step 1: Get Avondale city
      const { data: city } = await supabase
        .from('cities')
        .select('id, name')
        .eq('slug', 'avondale-az')
        .single();

      if (!city) {
        throw new Error("Avondale city not found");
      }
      addLog(`✅ Found city: ${city.name}`);

      // Step 2: Import 2 agents
      addLog("📥 Importing 2 agents via import-city-agents...");
      const { data: importResult, error: importError } = await supabase.functions.invoke(
        'import-city-agents',
        {
          body: {
            cityId: city.id,
            categorySlug: 'top10realestateagents',
            limit: 2
          }
        }
      );

      if (importError) throw importError;
      addLog(`✅ Import complete: ${importResult?.queued || 0} agents queued`);

      // Step 3: Wait 3 seconds for queue to populate
      addLog("⏳ Waiting 3s for queue setup...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 4: Trigger enrichment processor
      addLog("🔄 Starting Claude enrichment pipeline...");
      const { data: enrichResult, error: enrichError } = await supabase.functions.invoke(
        'process-contact-enrichment-queue',
        {
          body: {
            batchSize: 2,
            concurrency: 1
          }
        }
      );

      if (enrichError) throw enrichError;
      
      addLog(`✅ Enrichment complete!`);
      addLog(`📊 Results: ${enrichResult.succeeded} succeeded, ${enrichResult.failed} failed`);
      
      // Show agent details
      if (enrichResult.agents) {
        enrichResult.agents.forEach((agent: any) => {
          addLog(`   - ${agent.name}: ${agent.status}`);
        });
      }

      toast.success("Test complete! Check logs for details.");

    } catch (error: any) {
      console.error('Test error:', error);
      addLog(`❌ Error: ${error.message}`);
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test Avondale Enrichment (2 Agents)
        </CardTitle>
        <CardDescription>
          Import 2 Avondale agents and run full Claude enrichment pipeline
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runTest} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Test...
            </>
          ) : (
            <>
              <TestTube className="mr-2 h-4 w-4" />
              Run 2-Agent Test
            </>
          )}
        </Button>

        {log.length > 0 && (
          <div className="mt-4 rounded-lg bg-muted p-4 space-y-1">
            <div className="text-sm font-medium mb-2">Test Log:</div>
            <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
              {log.map((entry, i) => (
                <div key={i} className="text-muted-foreground">
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
