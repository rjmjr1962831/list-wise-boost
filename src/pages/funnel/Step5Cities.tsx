import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { BundlesPanel, type CityBundle } from '@/components/visibility/BundlesPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { REGIONAL_PACKAGES } from '@/data/arizonaPackages';
import { FunnelBreadcrumbs } from '@/components/funnel/FunnelBreadcrumbs';

type LocationState = { professionalId?: string; state_slug?: string | null; license_state?: string | null; professional?: Record<string, unknown> } | null;

const FUNNEL_SELECTION_KEY = 'funnel_selection';

export default function Step5Cities() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const passedState = location.state as LocationState;
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<CityBundle[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [professionalId, setProfessionalId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [token, passedState?.professionalId]);

  const loadData = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    let stateFilter = 'arizona';

    if (passedState?.professionalId) {
      setProfessionalId(passedState.professionalId);
      const st = passedState.license_state || passedState.state_slug;
      if (st) stateFilter = typeof st === 'string' ? st.replace(/\s+/g, '-').toLowerCase() : 'arizona';
    } else {
      try {
        const { data: prof, error: profError } = await supabase
          .from('professionals')
          .select('id, state_slug, license_state')
          .eq('verification_token', token)
          .single();

        if (profError || !prof) {
          navigate('/404');
          return;
        }

        setProfessionalId(prof.id);
        const st = prof.license_state || prof.state_slug;
        if (st) stateFilter = typeof st === 'string' ? st.replace(/\s+/g, '-').toLowerCase() : 'arizona';
      } catch {
        navigate('/404');
        return;
      }
    }

    try {
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('id, name, slug, state_slug')
        .eq('active', true)
        .eq('state_slug', stateFilter)
        .order('name');

      if (error) throw error;

      const cityOptions = citiesData || [];
      const cityBySlug = new Map(cityOptions.map((c: { slug: string; id: string }) => [c.slug, c.id]));
      const cityNameBySlug = new Map(cityOptions.map((c: { slug: string; name: string }) => [c.slug, c.name]));

      if (stateFilter === 'arizona') {
        const resolvedBundles: CityBundle[] = REGIONAL_PACKAGES.map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          category: pkg.category,
          cityIds: pkg.includedCityIds
            .map((slug: string) => cityBySlug.get(slug))
            .filter((id): id is string => !!id),
          cityNames: pkg.includedCityIds
            .map((slug: string) => cityNameBySlug.get(slug))
            .filter((name): name is string => !!name),
        }));
        setBundles(resolvedBundles);
      }

      try {
        const stored = sessionStorage.getItem(FUNNEL_SELECTION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.selectedCityIds && Array.isArray(parsed.selectedCityIds)) {
            setSelectedCityIds(new Set(parsed.selectedCityIds));
          }
        }
      } catch {
        // ignore
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load bundles');
    } finally {
      setLoading(false);
    }
  };

  const persistSelection = (next: Set<string>) => {
    try {
      const stored = sessionStorage.getItem(FUNNEL_SELECTION_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      sessionStorage.setItem(FUNNEL_SELECTION_KEY, JSON.stringify({
        ...parsed,
        selectedCityIds: Array.from(next),
        savedAt: new Date().toISOString(),
      }));
    } catch {
      // ignore
    }
  };

  const handleAddBundle = (_bundleId: string, cityIds: string[]) => {
    setSelectedCityIds(prev => {
      const next = new Set(prev);
      cityIds.forEach(id => next.add(id));
      persistSelection(next);
      return next;
    });
  };

  const handleContinue = () => {
    if (selectedCityIds.size === 0) {
      toast.error('Please add at least one bundle');
      return;
    }

    toast.success(`${selectedCityIds.size} cities selected!`);
    navigate(`/funnel/${token}/neighborhoods`, { state: passedState?.professional ? { professional: passedState.professional } : undefined });
  };

  const cityCount = selectedCityIds.size;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Select Cities | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <FunnelBreadcrumbs currentStep={6} />
          <Card className="!bg-white/5 border-white/10 mt-3">
            <CardHeader>
              <CardTitle className="text-white">Which cities do you serve?</CardTitle>
              <p className="text-sm text-slate-400">
                Add bundles to select your coverage areas. City listings are free.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <BundlesPanel
                bundles={bundles}
                selectedCities={selectedCityIds}
                onAddBundle={handleAddBundle}
              />

              {cityCount > 0 && (
                <div className="text-sm text-slate-400">
                  {cityCount} {cityCount === 1 ? 'city' : 'cities'} selected
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}/review-final`)}
                  className="gap-2 border-white/20 text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleContinue}
                  disabled={cityCount === 0}
                  className="flex-1 gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
