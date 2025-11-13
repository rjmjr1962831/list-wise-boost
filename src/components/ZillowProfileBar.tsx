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
}: {
  agentName: string;
  market?: string | null;
  zuid?: string | null;
}) {
  const { trackEvent } = useGA4Tracking();
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        // If we already have ZUID, use it directly
        if (zuid) {
          setProfileUrl(`https://www.zillow.com/profile/${zuid}`);
          return;
        }
        // Try Zillow agent search first (more reliable for direct profile link)
        if (agentName && market) {
          const parts = (market || '').split(',');
          const city = parts[0]?.trim() || '';
          const state = parts[1]?.trim() || '';
          const { data: agentList, error } = await supabase.functions.invoke('fetch-zillow-agents', {
            body: { city, state },
          });
          if (!error && Array.isArray(agentList) && agentList.length) {
            const lower = agentName.toLowerCase();
            const match = agentList.find((a: any) => (a.fullName || a.name || '').toLowerCase().includes(lower)) || agentList[0];
            if (match?.profileLink) {
              const url = match.profileLink.startsWith('http') ? match.profileLink : `https://www.zillow.com${match.profileLink}`;
              if (!cancelled) setProfileUrl(url);
              return;
            }
            if (match?.zuid && !cancelled) {
              setProfileUrl(`https://www.zillow.com/profile/${match.zuid}`);
              return;
            }
          }
        }
        // Fallback to Apify discovery
        const { data } = await supabase.functions.invoke('fetch-apify-zillow-reviews', {
          body: { agentName, location: market },
        });
        let url: string | null = data?.profileUrl || null;
        if (!cancelled) {
          if (!url) {
            const searchName = agentName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            url = `https://www.zillow.com/professionals/real-estate-agent-reviews/${searchName}/`;
          }
          setProfileUrl(url);
        }
      } catch (e) {
        console.error('Error fetching Zillow profile:', e);
        // Fallback to generic Zillow search URL on error
        if (!cancelled && !profileUrl) {
          const searchName = agentName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          setProfileUrl(`https://www.zillow.com/professionals/real-estate-agent-reviews/${searchName}/`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [agentName, market, zuid]);

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
