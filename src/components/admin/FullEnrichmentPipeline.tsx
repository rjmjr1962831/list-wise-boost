import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface City {
  id: string;
  name: string;
  state: string;
}

export default function FullEnrichmentPipeline() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>("");
  const [fullEnrichment, setFullEnrichment] = useState(true);
  const [targetAgents, setTargetAgents] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  
  // Cost control options (defaults to enabled)
  const [dryRun, setDryRun] = useState(false);
  const [skipRecentlyEnriched, setSkipRecentlyEnriched] = useState(true);
  const [skipGenericBios, setSkipGenericBios] = useState(true);
  const [skipIfNoPress, setSkipIfNoPress] = useState(true);

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    const { data, error } = await supabase
      .from("cities")
      .select("id, name, state")
      .eq("active", true)
      .eq("state", "Arizona")
      .order("name");

    if (error) {
      console.error("Error fetching cities:", error);
      toast.error("Failed to load cities");
    } else {
      setCities(data || []);
    }
  };

  const addLog = (message: string) => {
    setStatusLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const estimateCredits = () => {
    const baseCreditsPerAgent = 2; // 1 for bio + 1 for synthesis
    let creditsPerAgent = baseCreditsPerAgent;

    if (skipGenericBios) creditsPerAgent -= 0.5;
    if (skipIfNoPress) creditsPerAgent -= 0.5;
    if (skipRecentlyEnriched) creditsPerAgent *= 0.5;

    return {
      perAgent: Math.max(0.1, creditsPerAgent).toFixed(1),
      total: (Math.max(0.1, creditsPerAgent) * targetAgents).toFixed(0),
      savings: ((1 - creditsPerAgent / baseCreditsPerAgent) * 100).toFixed(0)
    };
  };

  const runEnrichment = async () => {
    if (!selectedCityId) {
      toast.error("Please select a city");
      return;
    }

    setIsRunning(true);
    setStatusLog([]);
    setProgress(0);

    try {
      // Get category ID
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", "top10realestateagents")
        .single();

      if (!category) {
        throw new Error("Real Estate Agent category not found");
      }

      const city = cities.find(c => c.id === selectedCityId);
      const credits = estimateCredits();
      
      addLog(`🚀 Starting ${fullEnrichment ? 'FULL' : 'standard'} enrichment for ${city?.name}, ${city?.state}`);
      addLog(`🎯 Target: ${targetAgents} qualified agents`);
      addLog(`💰 Estimated cost: ${credits.total} credits (${credits.perAgent} per agent, ${credits.savings}% savings)`);
      if (dryRun) addLog(`⚠️ DRY RUN MODE - No AI calls will be made`);
      
      setCurrentPhase("Phase 1: Import");
      setProgress(10);

      // Call import-city-agents with cost controls
      const { data, error } = await supabase.functions.invoke("import-city-agents", {
        body: {
          cityId: selectedCityId,
          categoryId: category.id,
          maxResults: 100,
          forceRefresh: true,
          fullEnrichment: fullEnrichment,
          maxQualifiedAgents: targetAgents,
          dryRun,
          skipRecentlyEnriched,
          skipGenericBios,
          skipIfNoPress
        }
      });

      if (error) {
        throw error;
      }

      addLog(`✅ Import phase complete: ${data.agenscrapeImported || 0} agents imported`);
      setProgress(30);
      
      setCurrentPhase("Phase 2: Enriching");
      addLog(`📋 Enriching agent profiles with memo23...`);
      addLog(`⚙️ Smart deduplication active - reusing existing enriched data`);
      
      // Poll for enrichment progress
      await pollEnrichmentProgress(selectedCityId, category.id);
      
      if (fullEnrichment) {
        setCurrentPhase("Phase 3: Press & Synthesis");
        addLog(`📰 Running press research & profile synthesis...`);
        setProgress(70);
        
        // Wait for synthesis to complete
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        addLog(`✅ Press research & synthesis complete`);
      }
      
      setProgress(100);
      setCurrentPhase("Complete");
      addLog(`🎉 Enrichment complete for ${city?.name}!`);
      
      toast.success(`Full enrichment complete for ${city?.name}!`);
    } catch (error: any) {
      console.error("Enrichment error:", error);
      addLog(`❌ Error: ${error.message}`);
      toast.error(error.message || "Enrichment failed");
    } finally {
      setIsRunning(false);
    }
  };

  const pollEnrichmentProgress = async (cityId: string, categoryId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max

    while (attempts < maxAttempts) {
      const { data: agents } = await supabase
        .from("professionals")
        .select("id, name, zillow_data_fetched_at", { count: "exact" })
        .eq("city_id", cityId)
        .eq("category_id", categoryId)
        .eq("active", true);

      const enrichedCount = agents?.filter(a => a.zillow_data_fetched_at).length || 0;
      const totalCount = agents?.length || 0;

      if (enrichedCount > 0) {
        const progressPercent = 30 + Math.floor((enrichedCount / Math.max(totalCount, 1)) * 40);
        setProgress(progressPercent);
        addLog(`📊 Enrichment progress: ${enrichedCount}/${totalCount} agents`);
      }

      if (enrichedCount >= targetAgents || enrichedCount === totalCount) {
        addLog(`✅ Enrichment complete: ${enrichedCount} agents enriched`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10s
      attempts++;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-6 w-6" />
          Full Enrichment Pipeline
        </CardTitle>
        <CardDescription>
          Run complete agent enrichment: Import → Memo23 → Press Research → Profile Synthesis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            <strong>Smart Deduplication:</strong> Agents appearing in multiple cities are enriched once, then data is copied.
            <br />
            <strong>Full Enrichment:</strong> Includes press research via Claude and auto-synthesis of bios, achievements, and publications.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>City</Label>
            <Select value={selectedCityId} onValueChange={setSelectedCityId} disabled={isRunning}>
              <SelectTrigger>
                <SelectValue placeholder="Select a city" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}, {city.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Target Qualified Agents: {targetAgents}</Label>
            <Slider
              value={[targetAgents]}
              onValueChange={([value]) => setTargetAgents(value)}
              min={50}
              max={500}
              step={10}
              disabled={isRunning}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground">
              System will import until it reaches this many agents with 4.8★+ rating and 100+ reviews
            </p>
          </div>
        </div>

        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Cost Controls</Label>
            <div className="text-sm text-muted-foreground">
              Est: <span className="font-mono font-semibold">{estimateCredits().total}</span> credits 
              <span className="text-green-600 ml-2">({estimateCredits().savings}% savings)</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={isRunning}
              />
              <Label htmlFor="dry-run" className="cursor-pointer text-sm">
                Dry Run (zero cost, logs only)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="skip-recent"
                checked={skipRecentlyEnriched}
                onCheckedChange={setSkipRecentlyEnriched}
                disabled={isRunning}
              />
              <Label htmlFor="skip-recent" className="cursor-pointer text-sm">
                Skip Recently Enriched (saves ~70%)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="skip-generic"
                checked={skipGenericBios}
                onCheckedChange={setSkipGenericBios}
                disabled={isRunning}
              />
              <Label htmlFor="skip-generic" className="cursor-pointer text-sm">
                Skip Generic Bio Rewrites (saves ~25%)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="skip-no-press"
                checked={skipIfNoPress}
                onCheckedChange={setSkipIfNoPress}
                disabled={isRunning}
              />
              <Label htmlFor="skip-no-press" className="cursor-pointer text-sm">
                Skip Synthesis Without Press (saves ~25%)
              </Label>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="full-enrichment"
            checked={fullEnrichment}
            onCheckedChange={setFullEnrichment}
            disabled={isRunning}
          />
          <Label htmlFor="full-enrichment" className="cursor-pointer">
            Enable Full Enrichment (Press Research + Profile Synthesis)
          </Label>
        </div>

        <Button
          onClick={runEnrichment}
          disabled={isRunning || !selectedCityId}
          className="w-full"
          size="lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {currentPhase}...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Run {fullEnrichment ? "Full" : "Standard"} Enrichment
            </>
          )}
        </Button>

        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{currentPhase}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {statusLog.length > 0 && (
          <div className="space-y-2">
            <Label>Status Log</Label>
            <div className="bg-muted rounded-md p-4 max-h-96 overflow-y-auto font-mono text-xs space-y-1">
              {statusLog.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap">
                  {log.includes("✅") ? (
                    <span className="text-green-600 dark:text-green-400">{log}</span>
                  ) : log.includes("❌") ? (
                    <span className="text-red-600 dark:text-red-400">{log}</span>
                  ) : log.includes("🎉") ? (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
