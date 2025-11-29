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
      addLog("🚀 Starting streaming enrichment test for Avondale (2 agents max)...");

      // Step 1: Get Avondale city
      const { data: city } = await supabase
        .from('cities')
        .select('id, name')
        .eq('slug', 'avondale')
        .eq('state', 'Arizona')
        .single();

      if (!city) {
        throw new Error("Avondale city not found");
      }
      addLog(`✅ Found city: ${city.name}`);

      // Step 2: Get real estate agents category
      const { data: category } = await supabase
        .from('categories')
        .select('id, name')
        .eq('slug', 'top10realestateagents')
        .single();

      if (!category) {
        throw new Error("Real estate agents category not found");
      }
      addLog(`✅ Found category: ${category.name}`);

      // Step 3: Start streaming enrichment pipeline
      addLog("🔄 Starting streaming enrichment (agenscrape→memo23→claude)...");
      addLog("This will discover agents and enrich them concurrently as they're found.");
      
      const { data: result, error: enrichError } = await supabase.functions.invoke(
        'streaming-city-enrichment',
        {
          body: {
            cityId: city.id,
            categoryId: category.id,
            maxResults: 2  // Limit to 2 agents for testing
          }
        }
      );

      if (enrichError) throw enrichError;
      
      addLog(`✅ Streaming enrichment complete!`);
      addLog(`📊 Results: ${result.succeeded}/${result.processed} agents fully enriched`);
      addLog(`   - Succeeded: ${result.succeeded}`);
      addLog(`   - Failed: ${result.failed}`);

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
          Test Streaming Enrichment (2 Agents)
        </CardTitle>
        <CardDescription>
          Streams agents from agenscrape → memo23 → claude with 10 concurrent workers
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
              Run Streaming Test
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
