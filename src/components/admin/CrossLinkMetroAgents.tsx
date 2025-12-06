import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link2, Loader2, MapPin } from 'lucide-react';

interface CrossLinkResult {
  city: string;
  linked: number;
  metro: string;
}

export function CrossLinkMetroAgents() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CrossLinkResult[] | null>(null);
  const [totalLinked, setTotalLinked] = useState(0);

  const handleCrossLink = async () => {
    setIsRunning(true);
    setResults(null);
    setTotalLinked(0);

    try {
      const { data, error } = await supabase.functions.invoke('cross-link-metro-agents');

      if (error) {
        throw error;
      }

      if (data.success) {
        setResults(data.results);
        setTotalLinked(data.total_linked);
        toast.success(`Cross-linked ${data.total_linked} agents across ${data.cities_processed} cities`);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Cross-link error:', error);
      toast.error(`Failed to cross-link: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Cross-Link Small Towns to Metro Cities
        </CardTitle>
        <CardDescription>
          Populate small towns (Fountain Hills, Carefree, etc.) with agents from their nearest major metro cities.
          This links existing agents to additional cities without creating duplicates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleCrossLink} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cross-Linking Cities...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Run Cross-Link
            </>
          )}
        </Button>

        {results && results.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="font-semibold text-green-600">
              Successfully linked {totalLinked} agents across {results.length} cities:
            </p>
            <div className="max-h-60 overflow-y-auto border rounded p-2 space-y-1">
              {results.map((r, i) => (
                <div key={i} className="text-sm flex justify-between">
                  <span>{r.city} → {r.metro}</span>
                  <span className="text-muted-foreground">{r.linked} agents</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {results && results.length === 0 && (
          <p className="text-muted-foreground text-sm">
            All cities already have agents linked. No changes made.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
