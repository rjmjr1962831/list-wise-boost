import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { supabase } from '@/integrations/supabase/client';
import { BundlesPanel, type CityBundle } from '@/components/visibility/BundlesPanel';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { REGIONAL_PACKAGES } from '@/data/arizonaPackages';
import { CALIFORNIA_PACKAGES, CA_CATEGORY_LABELS, CA_CATEGORY_ORDER } from '@/data/californiaPackages';
import { SandboxNugget } from './SandboxNugget';
import { SandboxProgress } from './SandboxProgress';
import { validateToken, getStateFromProfessional } from './utils';

export default function SandboxStep3Cities() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [bundles, setBundles] = useState<CityBundle[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [catLabels, setCatLabels] = useState<Record<string, string> | undefined>(undefined);
  const [catOrder, setCatOrder] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [token]);

  const loadData = async () => {
    if (!token) return;
    const result = await validateToken(token);
    if (result.status !== 'valid' || !result.professional) {
      navigate(`/sandbox/${token}`);
      return;
    }
    const prof = result.professional;
    setProfessional(prof);

    const { stateSlug } = getStateFromProfessional(prof);

    // Pre-select agent's current city
    if (prof.city_id) {
      setSelectedCityIds(new Set([prof.city_id]));
    }

    try {
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('id, name, slug, state_slug')
        .eq('active', true)
        .eq('state_slug', stateSlug)
        .order('name');

      if (error) throw error;

      const cityOptions = citiesData || [];
      const cityBySlug = new Map(cityOptions.map((c: any) => [c.slug, c.id]));
      const cityNameBySlug = new Map(cityOptions.map((c: any) => [c.slug, c.name]));

      if (stateSlug === 'arizona') {
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
      } else if (stateSlug === 'california') {
        const resolvedBundles: CityBundle[] = CALIFORNIA_PACKAGES.map(pkg => ({
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
        setCatLabels(CA_CATEGORY_LABELS as Record<string, string>);
        setCatOrder(CA_CATEGORY_ORDER as string[]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load city bundles');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBundle = (_bundleId: string, cityIds: string[]) => {
    setSelectedCityIds(prev => {
      const next = new Set(prev);
      cityIds.forEach(id => next.add(id));
      return next;
    });
  };

  const handleContinue = async () => {
    if (selectedCityIds.size === 0) {
      toast.error('Please select at least one city area.');
      return;
    }

    trackEvent('sandbox_step3_cities_selected', {
      professional_id: professional?.id,
      city_count: selectedCityIds.size,
    });

    // Save primary city
    const primaryCityId = (professional?.city_id && selectedCityIds.has(professional.city_id))
      ? professional.city_id
      : Array.from(selectedCityIds)[0];

    await supabase.functions.invoke('save-free-city-selection', {
      body: { professionalId: professional.id, cityId: primaryCityId },
    }).catch(() => { /* best effort */ });

    navigate(`/sandbox/${token}/neighborhoods`, {
      state: {
        selectedCityIds: Array.from(selectedCityIds),
        professionalId: professional.id,
        professional,
      },
    });
  };

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
      </SafeHead>

      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <SandboxProgress currentStep={3} />

          <SandboxNugget>
            AI recommendations are geographic. It won't name you in a city unless it can verify you work there. Please list locations where you have verified recent transactions. When selecting a bundle, just have recent transactions in at least one of them.
          </SandboxNugget>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Where do you work?</h1>
            <p className="text-muted-foreground text-sm">
              Add as many cities as you like. We need to be able to confirm two transactions in the last 12 months in at least one of the cities in the group. There is no charge for this.
            </p>
          </div>

          <BundlesPanel
            bundles={bundles}
            selectedCities={selectedCityIds}
            onAddBundle={handleAddBundle}
            categoryLabels={catLabels}
            categoryOrder={catOrder}
          />

          <p className="text-sm text-muted-foreground">
            {selectedCityIds.size} {selectedCityIds.size === 1 ? 'city' : 'cities'} selected
          </p>
          <p className="text-xs text-muted-foreground">
            You can change your city selections anytime from your dashboard.
          </p>

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => navigate(`/sandbox/${token}/contact`)}>
              Back
            </Button>
            <Button onClick={handleContinue} disabled={selectedCityIds.size === 0}>
              Continue
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
