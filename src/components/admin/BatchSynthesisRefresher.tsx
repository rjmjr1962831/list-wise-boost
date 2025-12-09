import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, RefreshCw, CheckCircle, XCircle, Loader2, Search, FileText } from "lucide-react";

interface City {
  id: string;
  name: string;
  state: string;
}

interface SynthesisResult {
  id: string;
  name: string;
  success: boolean;
  pressMentions?: number;
  communityRoles?: number;
  synthesisPreview?: string;
  error?: string;
}

interface AgentPreview {
  id: string;
  name: string;
  company: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  synthesized_bio: string | null;
  profile_last_synthesized_at: string | null;
  city: { name: string; state: string } | null;
}

export function BatchSynthesisRefresher() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [agents, setAgents] = useState<AgentPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [results, setResults] = useState<SynthesisResult[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [batchSize, setBatchSize] = useState(10);

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [selectedCity]);

  async function fetchCities() {
    const { data, error } = await supabase
      .from('cities')
      .select('id, name, state')
      .eq('active', true)
      .order('name');

    if (error) {
      toast.error('Failed to load cities');
      return;
    }

    setCities(data || []);
  }

  async function fetchAgents() {
    setIsLoading(true);

    let query = supabase
      .from('professionals')
      .select(`
        id, name, company, review_stars_rating, num_total_reviews, 
        synthesized_bio, profile_last_synthesized_at,
        city:cities(name, state)
      `)
      .eq('active', true)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 50)
      .order('name');

    if (selectedCity !== 'all') {
      query = query.eq('city_id', selectedCity);
    }

    const { data, error } = await query.limit(500);

    if (error) {
      toast.error('Failed to load agents');
      setIsLoading(false);
      return;
    }

    setAgents(data || []);
    setIsLoading(false);
  }

  async function processAgent(agent: AgentPreview): Promise<SynthesisResult> {
    try {
      // Step 1: Run Gemini press search (also extracts community roles)
      const cityData = agent.city as { name: string; state: string } | null;
      
      console.log(`[Batch] Starting press search for: ${agent.name}`);
      
      const { data: searchData, error: searchError } = await supabase.functions.invoke('search-agent-press-gemini', {
        body: {
          agentName: agent.name,
          brokerage: agent.company,
          city: cityData?.name,
          state: cityData?.state,
          professionalId: agent.id,
          dryRun: false // Save to database
        }
      });

      if (searchError) {
        throw new Error(`Press search failed: ${searchError.message}`);
      }

      const pressMentions = searchData?.pressMentions?.length || 0;
      const communityRoles = searchData?.communityRoles?.length || 0;

      console.log(`[Batch] Press search complete for ${agent.name}: ${pressMentions} press, ${communityRoles} roles`);

      // Step 2: Run synthesis
      console.log(`[Batch] Starting synthesis for: ${agent.name}`);
      
      const { data: synthesisData, error: synthesisError } = await supabase.functions.invoke('synthesize-agent-profile', {
        body: {
          professionalId: agent.id
        }
      });

      if (synthesisError) {
        throw new Error(`Synthesis failed: ${synthesisError.message}`);
      }

      const bioPreview = synthesisData?.data?.synthesized_bio?.substring(0, 150) || '';
      console.log(`[Batch] Synthesis complete for ${agent.name}: ${bioPreview.length} chars`);

      return {
        id: agent.id,
        name: agent.name,
        success: true,
        pressMentions,
        communityRoles,
        synthesisPreview: bioPreview ? bioPreview + '...' : 'No bio generated'
      };

    } catch (error) {
      console.error(`[Batch] Error processing ${agent.name}:`, error);
      return {
        id: agent.id,
        name: agent.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async function runBatchSynthesis(regenerateAll: boolean) {
    setIsProcessing(true);
    setResults([]);
    setProcessedCount(0);

    // Filter agents based on regenerateAll flag
    const agentsToProcess = regenerateAll 
      ? agents 
      : agents.filter(a => !a.synthesized_bio);

    const totalAgents = Math.min(agentsToProcess.length, batchSize);
    
    if (totalAgents === 0) {
      toast.info('No agents to process');
      setIsProcessing(false);
      return;
    }

    const agentsBatch = agentsToProcess.slice(0, totalAgents);
    const concurrency = 5; // Process 5 agents at a time
    const allResults: SynthesisResult[] = [];

    console.log(`[Batch] Starting batch synthesis for ${agentsBatch.length} agents, concurrency: ${concurrency}`);

    // Process in concurrent batches
    for (let i = 0; i < agentsBatch.length; i += concurrency) {
      const batch = agentsBatch.slice(i, i + concurrency);
      setCurrentAgent(`Processing: ${batch.map(a => a.name).join(', ')}`);
      
      console.log(`[Batch] Processing batch ${Math.floor(i/concurrency) + 1}: ${batch.map(a => a.name).join(', ')}`);
      
      const batchResults = await Promise.allSettled(
        batch.map(agent => processAgent(agent))
      );

      const processedResults = batchResults.map((result, idx) => {
        if (result.status === 'fulfilled') {
          console.log(`[Batch] ${batch[idx].name}: Success`);
          return result.value;
        }
        console.log(`[Batch] ${batch[idx].name}: Failed - Promise rejected`);
        return {
          id: batch[idx].id,
          name: batch[idx].name,
          success: false,
          error: 'Promise rejected'
        };
      });

      allResults.push(...processedResults);
      console.log(`[Batch] Results so far: ${allResults.length}`, allResults);
      setResults([...allResults]);
      setProcessedCount(allResults.length);
    }

    console.log(`[Batch] All results:`, allResults);

    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;

    toast.success(`Completed: ${successful} successful, ${failed} failed`);
    setCurrentAgent(null);
    setCurrentStep("");
    setIsProcessing(false);
    
    // Refresh agent list
    await fetchAgents();
  }

  const unsynthesizedCount = agents.filter(a => !a.synthesized_bio).length;
  const progress = agents.length > 0 ? (processedCount / Math.min(agents.length, batchSize)) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Batch Synthesis Refresher
          </CardTitle>
          <CardDescription>
            Re-run press search + synthesis for active agents. Updates press mentions, community roles, and AI-generated bios. Automatically syncs to Pipedrive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map(city => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}, {city.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={batchSize.toString()} onValueChange={(v) => setBatchSize(parseInt(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Batch size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 agents</SelectItem>
                <SelectItem value="10">10 agents</SelectItem>
                <SelectItem value="25">25 agents</SelectItem>
                <SelectItem value="50">50 agents</SelectItem>
                <SelectItem value="100">100 agents</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchAgents}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 flex-wrap">
            <Badge variant="secondary">{agents.length} Qualified Agents</Badge>
            <Badge variant="default" className="bg-green-600">
              {agents.length - unsynthesizedCount} Synthesized
            </Badge>
            <Badge variant="destructive">{unsynthesizedCount} Missing Synthesis</Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => runBatchSynthesis(false)}
              disabled={isProcessing || unsynthesizedCount === 0}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Synthesize Missing ({Math.min(unsynthesizedCount, batchSize)})
            </Button>

            <Button
              variant="secondary"
              onClick={() => runBatchSynthesis(true)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Re-Synthesize All ({Math.min(agents.length, batchSize)})
            </Button>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Processing: {currentAgent}
                </span>
                <span className="text-muted-foreground">
                  {processedCount} / {Math.min(agents.length, batchSize)}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{currentStep}</p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Results</h4>
              <ScrollArea className="h-[300px] border rounded-md p-3">
                <div className="space-y-2">
                  {results.map((result) => (
                    <div 
                      key={result.id}
                      className={`p-3 rounded-md border ${
                        result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{result.name}</p>
                          {result.success ? (
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>
                                <span className="font-medium">Press:</span> {result.pressMentions} mentions | 
                                <span className="font-medium ml-2">Community:</span> {result.communityRoles} roles
                              </p>
                              {result.synthesisPreview && (
                                <p className="italic truncate">{result.synthesisPreview}</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-red-600">{result.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}