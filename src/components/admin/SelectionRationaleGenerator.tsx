import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Sparkles, RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface City {
  id: string;
  name: string;
  state: string;
}

interface RationaleResult {
  id: string;
  name: string;
  success: boolean;
  rationale?: string;
  error?: string;
}

interface AgentPreview {
  id: string;
  name: string;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  selection_rationale: string | null;
  selection_rationale_generated_at: string | null;
}

export function SelectionRationaleGenerator() {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [agents, setAgents] = useState<AgentPreview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<RationaleResult[]>([]);
  const [stats, setStats] = useState({ total: 0, withRationale: 0, missing: 0 });

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
      .select('id, name, review_stars_rating, num_total_reviews, selection_rationale, selection_rationale_generated_at')
      .eq('active', true)
      .gte('review_stars_rating', 4.8)
      .gte('num_total_reviews', 20)
      .order('review_stars_rating', { ascending: false });

    if (selectedCity !== 'all') {
      query = query.eq('city_id', selectedCity);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      toast.error('Failed to load agents');
      setIsLoading(false);
      return;
    }

    setAgents(data || []);

    const total = data?.length || 0;
    const withRationale = data?.filter(a => a.selection_rationale).length || 0;
    setStats({ total, withRationale, missing: total - withRationale });

    setIsLoading(false);
  }

  async function generateRationales(regenerateExisting: boolean) {
    setIsGenerating(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('generate-selection-rationales', {
        body: {
          cityId: selectedCity !== 'all' ? selectedCity : undefined,
          regenerateExisting
        }
      });

      if (error) throw error;

      setResults(data.results || []);
      toast.success(`Generated ${data.successful} rationales (${data.failed} failed)`);
      
      // Refresh agent list
      await fetchAgents();

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Generation failed';
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  }

  async function regenerateSingle(professionalId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-selection-rationales', {
        body: {
          professionalIds: [professionalId],
          regenerateExisting: true
        }
      });

      if (error) throw error;

      const result = data.results?.[0];
      if (result?.success) {
        toast.success(`Regenerated rationale for ${result.name}`);
        await fetchAgents();
      } else {
        toast.error(result?.error || 'Failed to regenerate');
      }

    } catch (error) {
      toast.error('Failed to regenerate rationale');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Selection Rationale Generator
          </CardTitle>
          <CardDescription>
            Generate AI-powered selection rationales explaining why each agent was chosen for the Top 10 list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* City Filter */}
          <div className="flex items-center gap-4">
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
          <div className="flex gap-4">
            <Badge variant="secondary">{stats.total} Qualified Agents</Badge>
            <Badge variant="default" className="bg-green-600">{stats.withRationale} Have Rationale</Badge>
            <Badge variant="destructive">{stats.missing} Missing</Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => generateRationales(false)}
              disabled={isGenerating || stats.missing === 0}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Missing Only ({stats.missing})
            </Button>
            <Button
              variant="outline"
              onClick={() => generateRationales(true)}
              disabled={isGenerating || stats.total === 0}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Regenerate All ({stats.total})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Panel */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generation Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {results.map(result => (
                <div 
                  key={result.id} 
                  className={`p-3 rounded-lg border ${result.success ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">{result.name}</span>
                  </div>
                  {result.success && result.rationale && (
                    <p className="text-sm text-muted-foreground ml-6">{result.rationale}</p>
                  )}
                  {!result.success && result.error && (
                    <p className="text-sm text-red-600 ml-6">{result.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Preview List */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Rationales</CardTitle>
          <CardDescription>Preview and regenerate individual agent rationales</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No qualified agents found</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {agents.map(agent => (
                <div key={agent.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      <Badge variant="outline">
                        {agent.review_stars_rating}★ • {agent.num_total_reviews} reviews
                      </Badge>
                      {agent.selection_rationale ? (
                        <Badge className="bg-green-600">Has Rationale</Badge>
                      ) : (
                        <Badge variant="destructive">Missing</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateSingle(agent.id)}
                      disabled={isGenerating}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {agent.selection_rationale ? (
                    <p className="text-sm text-muted-foreground">{agent.selection_rationale}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No rationale generated yet</p>
                  )}
                  {agent.selection_rationale_generated_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Generated: {new Date(agent.selection_rationale_generated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
