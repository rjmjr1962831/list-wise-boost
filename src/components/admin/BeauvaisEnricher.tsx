import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function BeauvaisEnricher() {
  const [isEnriching, setIsEnriching] = useState(false);
  const [beauvaisInfo, setBeauvaisInfo] = useState<any>(null);

  const handleEnrich = async () => {
    setIsEnriching(true);
    
    try {
      // Find Beauvais Real Estate in Scottsdale
      const { data: scottsdale } = await supabase
        .from('cities')
        .select('id')
        .eq('name', 'Scottsdale')
        .maybeSingle();

      if (!scottsdale) {
        toast.error('Scottsdale city not found');
        setIsEnriching(false);
        return;
      }

      const { data: beauvais, error: findError } = await supabase
        .from('professionals')
        .select('id, name, rank, zillow_profile_url')
        .eq('zillow_profile_url', 'https://www.zillow.com/profile/Beauvais-Real-Estate')
        .eq('city_id', scottsdale.id)
        .maybeSingle();

      if (findError) {
        console.error('Find error:', findError);
        toast.error('Error finding Beauvais profile');
        setIsEnriching(false);
        return;
      }

      if (!beauvais) {
        toast.error('Beauvais Real Estate not found in Scottsdale');
        setIsEnriching(false);
        return;
      }

      setBeauvaisInfo(beauvais);

      // Ensure Beauvais is always rank 1 for Scottsdale
      if (beauvais.rank !== 1) {
        const { error: updateError } = await supabase
          .from('professionals')
          .update({ rank: 1 })
          .eq('id', beauvais.id);

        if (updateError) {
          console.error('Rank update error:', updateError);
          toast.error('Failed to set rank to 1');
        } else {
          toast.success('Updated Beauvais to rank #1');
        }
      }

      toast.info('Starting enrichment...');

      const { data, error } = await supabase.functions.invoke('fetch-single-memo23-agent', {
        body: { professionalId: beauvais.id }
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
      <h3 className="text-lg font-semibold mb-2">Dina and Mark Beauvais Enrichment</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Fetch full profile data from Zillow for Dina and Mark Beauvais / Beauvais Real Estate (Scottsdale - Always Rank #1)
      </p>
      {beauvaisInfo && (
        <div className="text-xs text-muted-foreground mb-2">
          ID: {beauvaisInfo.id} | Rank: {beauvaisInfo.rank}
        </div>
      )}
      <Button 
        onClick={handleEnrich} 
        disabled={isEnriching}
      >
        {isEnriching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isEnriching ? 'Enriching...' : 'Enrich Dina & Mark Beauvais Profile'}
      </Button>
    </div>
  );
}
