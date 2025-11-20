import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Play, Loader2 } from 'lucide-react';

export function BulkPhoenixImporter() {
  const [isStarting, setIsStarting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const handleStartImport = async () => {
    setIsStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-import-phoenix-agents');
      
      if (error) throw error;
      
      setIsRunning(true);
      toast.success(
        `Background import started for ${data.totalCities} Phoenix-area cities! The process will continue in the background - you can keep working.`,
        { duration: 5000 }
      );
      
      console.log('Cities being processed:', data.cities);
      
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to start bulk import');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Phoenix Agent Import</CardTitle>
        <CardDescription>
          Automatically import 300 agents (4.9+ rating) for all Phoenix-area cities. 
          This process runs in the background and may take 30-60 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>What this does:</strong>
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Processes all active Arizona cities</li>
            <li>Imports up to 300 agents per city</li>
            <li>Filters for agents with 4.9+ star ratings</li>
            <li>Uses agenscrape → memo23 enrichment pipeline</li>
            <li>Runs completely in the background</li>
          </ul>
        </div>

        <Button 
          onClick={handleStartImport} 
          disabled={isStarting || isRunning}
          className="w-full"
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Starting...
            </>
          ) : isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running in Background
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Start Bulk Import
            </>
          )}
        </Button>

        {isRunning && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-400">
              ✓ Import is running in the background. Check the edge function logs in Cloud → Functions to monitor progress.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
