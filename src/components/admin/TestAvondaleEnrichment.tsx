import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, TestTube, DollarSign, AlertCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export const TestAvondaleEnrichment = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [forceReEnrich, setForceReEnrich] = useState(true);
  const [concurrency, setConcurrency] = useState(3);
  const [delaySeconds, setDelaySeconds] = useState(2);
  
  // Cost control options
  const [dryRun, setDryRun] = useState(false);
  const [skipRecentlyEnriched, setSkipRecentlyEnriched] = useState(true);
  const [skipGenericBios, setSkipGenericBios] = useState(true);
  const [skipIfNoPress, setSkipIfNoPress] = useState(true);

  const addLog = (message: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const estimateCredits = () => {
    const agentCount = 2; // Test uses 2 agents
    let creditsPerAgent = 4; // Base: rewrite-bio (1) + search-press (1) + synthesize (2)
    
    if (dryRun) return 0;
    if (skipGenericBios) creditsPerAgent -= 0.5; // ~50% skip bio rewrites
    if (skipIfNoPress) creditsPerAgent -= 1; // Skip synthesis when no press
    if (skipRecentlyEnriched) return Math.round(agentCount * 0.3 * creditsPerAgent); // Only ~30% need enrichment
    
    return Math.round(agentCount * creditsPerAgent);
  };

  const runTest = async () => {
    const estimatedCredits = estimateCredits();
    
    if (!dryRun && estimatedCredits > 0) {
      const proceed = window.confirm(
        `This will use approximately ${estimatedCredits} credits.\n\n` +
        `Settings:\n` +
        `- Concurrency: ${concurrency} workers\n` +
        `- Delay: ${delaySeconds}s between agents\n` +
        `- Skip recently enriched: ${skipRecentlyEnriched ? 'Yes' : 'No'}\n` +
        `- Skip generic bios: ${skipGenericBios ? 'Yes' : 'No'}\n` +
        `- Skip synthesis without press: ${skipIfNoPress ? 'Yes' : 'No'}\n\n` +
        `Proceed?`
      );
      
      if (!proceed) return;
    }
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
      addLog(`⚙️ Settings: ${concurrency} workers, ${delaySeconds}s delay between agents`);
      addLog("This will discover agents and enrich them concurrently as they're found.");
      if (forceReEnrich) {
        addLog("⚡ Force re-enrich enabled: existing agents will be re-enriched");
      }
      
      // Estimate time (very rough approximation)
      const estimatedTimePerAgent = 30 + (delaySeconds * concurrency); // ~30s per agent + delays
      const estimatedTotalMinutes = Math.ceil((2 * estimatedTimePerAgent) / 60);
      addLog(`⏱️ Estimated time: ~${estimatedTotalMinutes} minutes`);
      
      const { data: result, error: enrichError } = await supabase.functions.invoke(
        'streaming-city-enrichment',
        {
          body: {
            cityId: city.id,
            categoryId: category.id,
            maxResults: 2,  // Limit to 2 agents for testing
            forceReEnrich: forceReEnrich,
            concurrency: concurrency,
            delayMs: delaySeconds * 1000,
            // Cost control flags
            dryRun,
            skipRecentlyEnriched,
            skipGenericBios,
            skipIfNoPress
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
          Test the enrichment pipeline with configurable concurrency and delays
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost Estimation */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="font-medium">Estimated Cost</span>
          </div>
          <div className="text-2xl font-bold text-primary">
            {dryRun ? '0' : estimateCredits()} credits
          </div>
          {dryRun && (
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              <span>Dry run mode - no credits will be used</span>
            </div>
          )}
        </div>

        {/* Cost Controls */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
          <h4 className="font-medium text-sm">Cost Controls</h4>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dry-run">Dry Run Mode</Label>
              <p className="text-xs text-muted-foreground">Log what would happen (0 credits)</p>
            </div>
            <Switch
              id="dry-run"
              checked={dryRun}
              onCheckedChange={setDryRun}
              disabled={isRunning}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="skip-recent">Skip Recently Enriched</Label>
              <p className="text-xs text-muted-foreground">Skip agents enriched within 7 days</p>
            </div>
            <Switch
              id="skip-recent"
              checked={skipRecentlyEnriched}
              onCheckedChange={setSkipRecentlyEnriched}
              disabled={isRunning}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="skip-generic">Skip Generic Bio Rewrites</Label>
              <p className="text-xs text-muted-foreground">Don't rewrite short/templated bios</p>
            </div>
            <Switch
              id="skip-generic"
              checked={skipGenericBios}
              onCheckedChange={setSkipGenericBios}
              disabled={isRunning}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="skip-no-press">Skip Synthesis Without Press</Label>
              <p className="text-xs text-muted-foreground">Don't synthesize when no press found</p>
            </div>
            <Switch
              id="skip-no-press"
              checked={skipIfNoPress}
              onCheckedChange={setSkipIfNoPress}
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Concurrency: {concurrency} workers
              </Label>
            </div>
            <Slider
              value={[concurrency]}
              onValueChange={(value) => setConcurrency(value[0])}
              min={1}
              max={5}
              step={1}
              disabled={isRunning}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Number of agents processed simultaneously
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Delay: {delaySeconds}s between agents
              </Label>
            </div>
            <Slider
              value={[delaySeconds]}
              onValueChange={(value) => setDelaySeconds(value[0])}
              min={0}
              max={5}
              step={1}
              disabled={isRunning}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Wait time before processing each agent
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="force-reenrich" className="text-sm font-medium">
              Force Re-enrich
            </Label>
            <p className="text-xs text-muted-foreground">
              Re-run enrichment on existing agents
            </p>
          </div>
          <Switch
            id="force-reenrich"
            checked={forceReEnrich}
            onCheckedChange={setForceReEnrich}
            disabled={isRunning}
          />
        </div>

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
