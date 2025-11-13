import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { ExternalLink } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';

export function ZillowProfileBar({
  agentName,
  market,
  zuid,
  professionalId,
}: {
  agentName: string;
  market?: string | null;
  zuid?: string | null;
  professionalId?: string;
}) {
  const { trackEvent } = useGA4Tracking();
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProfileUrl = async () => {
      setLoading(true);
      
      // If we have ZUID, use it directly
      if (zuid) {
        const url = `https://www.zillow.com/profile/${zuid}`;
        setProfileUrl(url);
        
        // Cache in DB if we have professionalId
        if (professionalId) {
          await supabase
            .from('professionals')
            .update({ 
              zillow_profile_url: url,
              zillow_data_fetched_at: new Date().toISOString()
            })
            .eq('id', professionalId);
        }
        
        setLoading(false);
        return;
      }
      
      // Check database cache first (valid for 7 days)
      if (professionalId) {
        const { data: professional } = await supabase
          .from('professionals')
          .select('zillow_profile_url, zillow_data_fetched_at')
          .eq('id', professionalId)
          .single();
        
        if (professional?.zillow_profile_url && professional?.zillow_data_fetched_at) {
          const cacheAge = Date.now() - new Date(professional.zillow_data_fetched_at).getTime();
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          
          if (cacheAge < sevenDays) {
            setProfileUrl(professional.zillow_profile_url);
            setLoading(false);
            return;
          }
        }
      }
      
      // Construct fallback URL (no API calls to avoid rate limits)
      const searchName = agentName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fallbackUrl = `https://www.zillow.com/professionals/real-estate-agent-reviews/${searchName}/`;
      setProfileUrl(fallbackUrl);
      
      // Save fallback to cache
      if (professionalId) {
        await supabase
          .from('professionals')
          .update({ 
            zillow_profile_url: fallbackUrl,
            zillow_data_fetched_at: new Date().toISOString()
          })
          .eq('id', professionalId);
      }
      
      setLoading(false);
    };
    
    loadProfileUrl();
  }, [agentName, market, zuid, professionalId]);

  if (loading) {
    return (
      <div className="mt-4">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!profileUrl) return null;

  return (
    <div className="mt-4">
      <Button
        asChild
        variant="secondary"
        className="w-full justify-between"
        onClick={() =>
          trackEvent('press_mention_click', {
            agent_name: agentName,
            market: market || '',
            source: 'Zillow Profile',
          })
        }
      >
        <a href={profileUrl} target="_blank" rel="noopener noreferrer">
          <span>Zillow Profile and Reviews</span>
          <ExternalLink className="h-4 w-4 ml-2" />
        </a>
      </Button>
    </div>
  );
}
