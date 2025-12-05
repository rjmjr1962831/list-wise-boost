import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Globe, Clock, FileText, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PressMention {
  title: string;
  url: string;
  outlet: string;
  date?: string;
  credibilityScore: number;
}

interface PhaseResult {
  phase: number;
  queries: string[];
  results: { title: string; url: string; snippet: string }[];
  analysis: string;
}

interface SearchResponse {
  success: boolean;
  agentName: string;
  searchSummary: {
    totalSearches: number;
    totalResults: number;
    pressMentionsFound: number;
  };
  pressMentions: PressMention[];
  phases: PhaseResult[];
  error?: string;
}

export const GeminiSearchTester: React.FC = () => {
  const [agentName, setAgentName] = useState('Teresa Stephenson');
  const [brokerage, setBrokerage] = useState('Platinum Properties');
  const [city, setCity] = useState('Manhattan');
  const [state, setState] = useState('KS');
  const [dryRun, setDryRun] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [synthesisResult, setSynthesisResult] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [synthesisTime, setSynthesisTime] = useState<number | null>(null);

  const handleSearch = async () => {
    if (!agentName.trim()) {
      toast.error('Agent name is required');
      return;
    }

    setIsLoading(true);
    setResult(null);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke('search-agent-press-gemini', {
        body: {
          agentName: agentName.trim(),
          brokerage: brokerage.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          dryRun
        }
      });

      setResponseTime(Date.now() - startTime);

      if (error) {
        throw error;
      }

      setResult(data);
      toast.success(`Search complete: ${data.searchSummary?.totalSearches || 0} searches, ${data.searchSummary?.pressMentionsFound || 0} press mentions found`);
    } catch (error) {
      console.error('Gemini search error:', error);
      toast.error(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullSynthesis = async () => {
    if (!agentName.trim()) {
      toast.error('Agent name is required');
      return;
    }

    setIsSynthesizing(true);
    setSynthesisResult(null);
    const startTime = Date.now();

    try {
      // First, look up the agent by name
      const { data: agents, error: lookupError } = await supabase
        .from('professionals')
        .select('id, name')
        .ilike('name', `%${agentName.trim()}%`)
        .limit(1);

      if (lookupError || !agents || agents.length === 0) {
        throw new Error(`Agent "${agentName}" not found in database`);
      }

      const agent = agents[0];
      toast.info(`Found agent: ${agent.name} (${agent.id})`);

      // Run full synthesis pipeline
      const { data, error } = await supabase.functions.invoke('synthesize-agent-profile', {
        body: { professionalId: agent.id }
      });

      setSynthesisTime(Date.now() - startTime);

      if (error) {
        throw error;
      }

      const bio = data?.data?.synthesized_bio || data?.synthesized_bio;
      setSynthesisResult(bio || 'No synthesis generated');
      toast.success('Full synthesis complete!');
    } catch (error) {
      console.error('Synthesis error:', error);
      toast.error(error instanceof Error ? error.message : 'Synthesis failed');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Gemini Flash Iterative Search Tester
        </CardTitle>
        <CardDescription>
          Test the 3-phase/10-search iterative approach using Gemini Flash for agent research
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="agentName">Agent Name *</Label>
            <Input
              id="agentName"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g. Teresa Stephenson"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brokerage">Brokerage</Label>
            <Input
              id="brokerage"
              value={brokerage}
              onChange={(e) => setBrokerage(e.target.value)}
              placeholder="e.g. Platinum Properties"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Manhattan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. KS"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="dryRun"
              checked={dryRun}
              onCheckedChange={(checked) => setDryRun(checked === true)}
            />
            <Label htmlFor="dryRun" className="text-sm">
              Dry Run (don't save to database)
            </Label>
          </div>
          <Button onClick={handleSearch} disabled={isLoading || isSynthesizing}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Run Gemini Search
              </>
            )}
          </Button>
          <Button onClick={handleFullSynthesis} disabled={isLoading || isSynthesizing} variant="secondary">
            {isSynthesizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Synthesizing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run Full Synthesis (Gemini + Sonnet)
              </>
            )}
          </Button>
        </div>

        {(responseTime !== null || synthesisTime !== null) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {responseTime !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Search: {(responseTime / 1000).toFixed(2)}s
              </span>
            )}
            {synthesisTime !== null && (
              <span className="flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                Synthesis: {(synthesisTime / 1000).toFixed(2)}s
              </span>
            )}
          </div>
        )}

        {/* Synthesis Result */}
        {synthesisResult && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Claude Sonnet Synthesis (~300 words)
            </h3>
            <p className="whitespace-pre-line text-sm">{synthesisResult}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Search Summary</h3>
              <div className="flex gap-4 text-sm">
                <span>Total Searches: <strong>{result.searchSummary?.totalSearches || 0}</strong></span>
                <span>Total Results: <strong>{result.searchSummary?.totalResults || 0}</strong></span>
                <span>Press Mentions: <strong>{result.searchSummary?.pressMentionsFound || 0}</strong></span>
              </div>
            </div>

            {/* Press Mentions */}
            {result.pressMentions && result.pressMentions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Press Mentions Found ({result.pressMentions.length})
                </h3>
                <div className="space-y-2">
                  {result.pressMentions.map((mention, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <a 
                            href={mention.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-medium"
                          >
                            {mention.title}
                          </a>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>{mention.outlet}</span>
                            {mention.date && <span>• {mention.date}</span>}
                          </div>
                        </div>
                        <Badge variant={mention.credibilityScore >= 8 ? 'default' : mention.credibilityScore >= 5 ? 'secondary' : 'outline'}>
                          Score: {mention.credibilityScore}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phase Details */}
            {result.phases && result.phases.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Search Phases
                </h3>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {result.phases.map((phase, idx) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Phase {phase.phase}</h4>
                        <div className="space-y-2">
                          <div>
                            <span className="text-sm text-muted-foreground">Queries:</span>
                            <ul className="list-disc list-inside text-sm mt-1">
                              {phase.queries.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">Results: {phase.results.length}</span>
                            {phase.results.slice(0, 3).map((r, i) => (
                              <div key={i} className="text-xs mt-1 p-2 bg-muted/50 rounded">
                                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {r.title}
                                </a>
                                <p className="text-muted-foreground mt-1 line-clamp-2">{r.snippet}</p>
                              </div>
                            ))}
                          </div>
                          {phase.analysis && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Analysis:</span>
                              <p className="mt-1">{phase.analysis}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Raw JSON */}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View Raw Response
              </summary>
              <pre className="mt-2 p-4 bg-muted rounded-lg overflow-auto max-h-[300px] text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GeminiSearchTester;
