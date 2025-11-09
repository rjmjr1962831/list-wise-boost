import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitResponse {
  allowed: boolean;
  requestCount?: number;
  limit?: number;
  remaining?: number;
  resetInDays?: number;
  message?: string;
  error?: string;
}

export const useRateLimitCheck = () => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitResponse | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkRateLimit = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-rate-limit', {
          method: 'POST',
        });

        if (error) {
          console.error('Rate limit check error:', error);
          // Fail open - allow access if check fails
          setIsBlocked(false);
          setIsChecking(false);
          return;
        }

        setRateLimitInfo(data);
        setIsBlocked(!data.allowed);
        setIsChecking(false);

        // Log rate limit info for debugging
        if (data.remaining !== undefined) {
          console.log(`Rate limit: ${data.requestCount}/${data.limit} requests used. ${data.remaining} remaining.`);
        }
      } catch (err) {
        console.error('Rate limit check failed:', err);
        // Fail open - allow access if check fails
        setIsBlocked(false);
        setIsChecking(false);
      }
    };

    checkRateLimit();
  }, []);

  return { isBlocked, rateLimitInfo, isChecking };
};