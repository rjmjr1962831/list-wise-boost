import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import arizonaData from '@/data/arizonaNeighborhoodCatalog.json';
import californiaData from '@/data/californiaNeighborhoodCatalog.json';

export default function IngestNeighborhoods() {
  const [loading, setLoading] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  const ingestArizona = async () => {
    setLoading('AZ');
    try {
      const { data, error } = await supabase.functions.invoke('setup-neighborhood-catalog', {
        body: {
          action: 'ingest',
          data: arizonaData.items,
          state: 'AZ',
          clearExisting: true
        }
      });
      
      if (error) throw error;
      toast.success(`Arizona: ${data.stats.inserted} neighborhoods ingested`);
      fetchStats();
    } catch (err: any) {
      toast.error(`Arizona error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const ingestCalifornia = async () => {
    setLoading('CA');
    try {
      const { data, error } = await supabase.functions.invoke('setup-neighborhood-catalog', {
        body: {
          action: 'ingest',
          data: californiaData.neighborhoods,
          state: 'CA',
          clearExisting: true
        }
      });
      
      if (error) throw error;
      toast.success(`California: ${data.stats.inserted} neighborhoods ingested`);
      fetchStats();
    } catch (err: any) {
      toast.error(`California error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('setup-neighborhood-catalog', {
        body: { action: 'stats' }
      });
      if (error) throw error;
      setStats(data.stats);
    } catch (err: any) {
      console.error('Stats error:', err);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Neighborhood Data Ingestion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={ingestArizona} 
              disabled={loading !== null}
            >
              {loading === 'AZ' ? 'Ingesting...' : `Ingest Arizona (${arizonaData.items.length})`}
            </Button>
            <Button 
              onClick={ingestCalifornia} 
              disabled={loading !== null}
            >
              {loading === 'CA' ? 'Ingesting...' : `Ingest California (${californiaData.neighborhoods.length})`}
            </Button>
          </div>
          
          <Button variant="outline" onClick={fetchStats}>
            Refresh Stats
          </Button>

          {stats && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Current Database Stats:</h3>
              {Object.entries(stats).map(([state, tiers]: [string, any]) => (
                <div key={state} className="mb-2">
                  <strong>{state}:</strong> {tiers.total} total
                  <span className="text-sm text-muted-foreground ml-2">
                    (Main: {tiers.Main}, Prime: {tiers.Prime}, Luxury: {tiers.Luxury})
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
