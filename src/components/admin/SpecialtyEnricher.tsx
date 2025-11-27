import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles } from 'lucide-react';

export const SpecialtyEnricher = () => {
  const { toast } = useToast();
  const [isEnriching, setIsEnriching] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [results, setResults] = useState<any>(null);

  const handleEnrich = async () => {
    if (!zipCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a zip code",
        variant: "destructive",
      });
      return;
    }

    setIsEnriching(true);
    setResults(null);

    try {
      console.log('Starting specialty enrichment for zip:', zipCode);

      const { data, error } = await supabase.functions.invoke('enrich-agent-specialties', {
        body: { zipCode: zipCode.trim() }
      });

      if (error) throw error;

      if (data?.success) {
        setResults(data);
        toast({
          title: "Enrichment Complete",
          description: `Updated ${data.enrichedCount} agents with specialty data from ${data.totalProcessed} profiles`,
        });
      } else {
        throw new Error(data?.error || 'Enrichment failed');
      }
    } catch (error) {
      console.error('Enrichment error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to enrich specialties",
        variant: "destructive",
      });
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Enrich Agent Specialties
          </h3>
          <p className="text-sm text-muted-foreground">
            Use rigelbytes/zillow-agents to extract detailed specialties that memo23 may have missed.
            This includes buyer/seller focus, luxury homes, languages, and more.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input
              id="zipCode"
              type="text"
              placeholder="e.g., 85260"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              disabled={isEnriching}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter a zip code to enrich all agents in that area
            </p>
          </div>

          <Button
            onClick={handleEnrich}
            disabled={isEnriching || !zipCode.trim()}
            className="w-full"
          >
            {isEnriching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enriching Specialties...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Enrich Specialties
              </>
            )}
          </Button>
        </div>

        {results && (
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">Enrichment Results</h4>
              <div className="space-y-2 text-sm">
                <p>✅ Enriched: {results.enrichedCount} agents</p>
                <p>📊 Processed: {results.totalProcessed} profiles</p>
              </div>
            </div>

            {results.results && results.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Updated Agents:</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {results.results.map((result: any, idx: number) => (
                    <div key={idx} className="p-3 bg-muted rounded text-sm">
                      <p className="font-medium">{result.name}</p>
                      <p className="text-muted-foreground text-xs">
                        Added: {result.addedSpecialties.join(', ')}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Total specialties: {result.totalSpecialties}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
