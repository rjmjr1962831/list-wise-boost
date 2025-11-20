import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function BeauvaisEnricher() {
  const [isEnriching, setIsEnriching] = useState(false);

  const handleEnrich = async () => {
    setIsEnriching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
        body: { professionalId: '48c8a6b6-4798-4d7b-9e47-e76f679f81c9' }
      });

      if (error) {
        console.error('Enrichment error:', error);
        toast.error('Failed to enrich Beauvais profile');
      } else {
        console.log('Enrichment result:', data);
        toast.success('Beauvais profile enriched successfully!', {
          description: 'The profile has been updated with full Zillow data'
        });
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('An error occurred during enrichment');
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Beauvais Real Estate Enrichment</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Fetch full profile data from Zillow for Beauvais Real Estate
      </p>
      <Button 
        onClick={handleEnrich} 
        disabled={isEnriching}
      >
        {isEnriching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEnriching ? 'Enriching...' : 'Enrich Beauvais Profile'}
      </Button>
    </div>
  );
}
