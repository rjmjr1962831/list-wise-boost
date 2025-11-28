import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export function MesaDataFixer() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleFixMesaData = async () => {
    setLoading(true);
    setResults(null);
    
    try {
      toast.info('Starting Mesa data fixes...');
      
      const { data, error } = await supabase.functions.invoke('fix-mesa-data', {
        body: {}
      });

      if (error) throw error;

      setResults(data.results);
      toast.success('Mesa data fixes completed!');
      
    } catch (error) {
      console.error('Error fixing Mesa data:', error);
      toast.error('Failed to fix Mesa data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Mesa Data Fixer
        </CardTitle>
        <CardDescription>
          Fix Mesa agents: extract specialties from professional_information and queue review refreshes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleFixMesaData} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Fix Mesa Data
            </>
          )}
        </Button>

        {results && (
          <div className="space-y-3 pt-4 border-t">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Specialties Extracted
              </h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>✅ Updated: {results.specialties.updated}</div>
                <div>⏭️ Skipped: {results.specialties.skipped}</div>
                {results.specialties.errors > 0 && (
                  <div className="text-destructive">❌ Errors: {results.specialties.errors}</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                Review Refreshes Queued
              </h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>✅ Queued: {results.reviews.queued}</div>
                <div>⏭️ Already queued: {results.reviews.skipped}</div>
                {results.reviews.errors > 0 && (
                  <div className="text-destructive">❌ Errors: {results.reviews.errors}</div>
                )}
              </div>
            </div>

            <div className="pt-2 text-xs text-muted-foreground">
              💡 Review data will be refreshed in the background by the enrichment queue processor
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
