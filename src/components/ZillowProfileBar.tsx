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
    // Only show if we have ZUID
    if (zuid) {
      setProfileUrl(`https://www.zillow.com/profile/${zuid}`);
    } else {
      setProfileUrl(null);
    }
    setLoading(false);
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
        className="w-full justify-center"
        onClick={() =>
          trackEvent('press_mention_click', {
            agent_name: agentName,
            market: market || '',
            source: 'Zillow Profile',
          })
        }
      >
        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
          <span>Zillow Profile and Reviews</span>
          <ExternalLink className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}
