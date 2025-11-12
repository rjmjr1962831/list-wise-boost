import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ZillowStats {
  forSale: number;
  sold: number;
  forRent: number;
  reviews: number;
  currentListings: number;
  totalSales: number;
  yearsExperience: number;
}

export const useZillowStats = (
  professionalId: string | undefined, 
  profileUrl: string | null, 
  agentName: string,
  zipCode: string | null
) => {
  const [stats, setStats] = useState<ZillowStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Live stats fetching disabled - using database values only
    // This avoids Apify API issues and uses manually entered or previously fetched data
    setLoading(false);
  }, [professionalId, profileUrl, agentName, zipCode]);

  return { stats, loading };
};
