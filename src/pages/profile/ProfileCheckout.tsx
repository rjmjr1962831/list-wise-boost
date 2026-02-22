import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  NEIGHBORHOOD_TIER_PRICES,
  type NeighborhoodTier,
} from '@/types/neighborhoodPricing';
import { toast } from 'sonner';

const STORAGE_KEY = 'neighborhood_expert_requests';

interface StoredNeighborhood {
  id: string;
  tier: NeighborhoodTier;
  name: string;
  city: string;
}

interface StoredSelection {
  neighborhoods: StoredNeighborhood[];
  billingCycle: 'monthly' | 'annual';
}

export default function ProfileCheckout() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runCheckout();
  }, [token]);

  const runCheckout = async () => {
    if (!token) {
      setError('Missing token');
      setLoading(false);
      return;
    }

    try {
      // 1. Get professional
      const isUuid = /^[0-9a-f-]{36}$/i.test(token);
      let professional: { id: string; email: string | null } | null = null;

      if (isUuid) {
        const { data } = await supabase
          .from('professionals')
          .select('id, email')
          .eq('id', token)
          .maybeSingle();
        professional = data;
      }
      if (!professional) {
        const { data } = await supabase
          .from('professionals')
          .select('id, email')
          .eq('verification_token', token)
          .maybeSingle();
        professional = data;
      }

      if (!professional?.email) {
        setError('Could not find your profile or email.');
        setLoading(false);
        return;
      }

      // 2. Get selection from sessionStorage or location.state
      const stored = sessionStorage.getItem(STORAGE_KEY);
      const stateData = (location.state as { selectedCities?: { id: string; city_name: string; price_monthly: number }[]; freeCity?: { id: string; city_name: string; price_monthly: number }; billingCycle?: 'monthly' | 'annual'; total?: number } | null);

      let selectedNeighborhoods: { neighborhoodId: string; neighborhoodName: string; cityArea: string; tier: 'Main' | 'Prime' | 'Luxury'; price: number }[] = [];
      let billingPeriod: 'monthly' | 'annual' = 'monthly';
      let monthlyTotal = 0;

      if (stored) {
        const parsed: StoredSelection = JSON.parse(stored);
        const items = parsed.neighborhoods
          .map((n) => ({
            ...n,
            monthlyPrice: NEIGHBORHOOD_TIER_PRICES[n.tier] ?? 25,
          }))
          .sort((a, b) => a.monthlyPrice - b.monthlyPrice);

        // Buy 2 Get 1 Free: every 3rd (indices 2, 5, 8...) is free
        const paid = items.filter((_, i) => (i + 1) % 3 !== 0);
        selectedNeighborhoods = paid.map((n) => ({
          neighborhoodId: n.id,
          neighborhoodName: n.name,
          cityArea: n.city,
          tier: n.tier,
          price: n.monthlyPrice,
        }));
        billingPeriod = parsed.billingCycle ?? 'monthly';
        monthlyTotal = paid.reduce((s, n) => s + n.monthlyPrice, 0);
      } else if (stateData?.selectedCities && stateData.selectedCities.length > 0) {
        const cities = stateData.selectedCities;
        selectedNeighborhoods = cities.map((c) => ({
          neighborhoodId: c.id,
          neighborhoodName: c.city_name,
          cityArea: c.city_name,
          tier: 'Main' as const,
          price: c.price_monthly,
        }));
        billingPeriod = stateData.billingCycle ?? 'monthly';
        monthlyTotal = cities.reduce((s, c) => s + c.price_monthly, 0);
      } else if (stateData?.freeCity) {
        const c = stateData.freeCity;
        selectedNeighborhoods = [{
          neighborhoodId: c.id,
          neighborhoodName: c.city_name,
          cityArea: c.city_name,
          tier: 'Main' as const,
          price: c.price_monthly,
        }];
        billingPeriod = stateData.billingCycle ?? 'monthly';
        monthlyTotal = c.price_monthly;
      }

      if (selectedNeighborhoods.length === 0) {
        setError('No items selected. Please go back and select neighborhoods or cities.');
        setLoading(false);
        return;
      }

      const baseUrl = window.location.origin;
      const { data, err } = await supabase.functions.invoke('create-agent-checkout', {
        body: {
          professionalId: professional.id,
          email: professional.email,
          selectedNeighborhoods,
          allNeighborhoodIds: selectedNeighborhoods.map((n) => n.neighborhoodId),
          billingPeriod,
          monthlyTotal,
          successUrl: `${baseUrl}/profile/${token}/success`,
          cancelUrl: `${baseUrl}/profile/${token}/select-neighborhoods`,
        },
      });

      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        sessionStorage.removeItem(STORAGE_KEY);
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Checkout failed';
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Redirecting to checkout...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h1 className="text-xl font-semibold">Checkout Error</h1>
      <p className="text-muted-foreground text-center max-w-md">{error}</p>
      <Button onClick={() => navigate(token ? `/profile/${token}/select-neighborhoods` : '/')}>
        Go Back
      </Button>
    </div>
  );
}
