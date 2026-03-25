import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { Loader2, ArrowRight, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CoverageProgress } from '@/components/visibility/CoverageProgress';
import { BundlesPanel, type CityBundle } from '@/components/visibility/BundlesPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { REGIONAL_PACKAGES } from '@/data/arizonaPackages';
import { useFunnelTracking, FUNNEL_EVENTS } from '@/hooks/useFunnelTracking';
import { FunnelPhoneSupport } from '@/components/funnel/FunnelPhoneSupport';

const STORAGE_KEY = 'visibility_selection';
const STORAGE_EXPIRY_HOURS = 24;

interface StoredSelection {
  selectedCityIds: string[];
  selectedNeighborhoods: Array<{
    id: string;
    neighborhood: string;
    city_area: string;
    state: string;
    tier_at_selection: string;
    price_monthly: number;
    price_source: string;
  }>;
  skippedExpertise?: boolean;
  savedAt: string;
}
interface CityData {
  id: string;
  name: string;
  slug: string;
}

export default function VisibilityCoveragePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const isDashboardEdit = returnTo === 'dashboard';
  const { toast } = useToast();
  
  const [cities, setCities] = useState<CityData[]>([]);
  const [bundles, setBundles] = useState<CityBundle[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [agentStateSlug, setAgentStateSlug] = useState<string | null>(null);

  // Get professional token for tracking
  const professionalToken = sessionStorage.getItem('visibility_professional_token') || undefined;
  const { trackEvent } = useFunnelTracking(professionalToken);

  // Gate: require professional context (from funnel or dashboard)
  useEffect(() => {
    if (isDashboardEdit) {
      // Dashboard mode: use professional ID from sessionStorage (set by dashboard edit button)
      // or fall back to agent session token
      const storedProfId = sessionStorage.getItem('visibility_professional_id');
      if (storedProfId) {
        setProfessionalId(storedProfId);
        return;
      }
      const sessionToken = localStorage.getItem('agent_session_token');
      if (!sessionToken) {
        navigate('/agent/login');
        return;
      }
      (async () => {
        const { data } = await supabase.functions.invoke('validate-agent-session', {
          body: { sessionToken },
        });
        if (!data?.valid) {
          navigate('/agent/login');
          return;
        }
        setProfessionalId(data.professionalId);
        sessionStorage.setItem('visibility_professional_id', data.professionalId);
      })();
      return;
    }

    const storedProfId = sessionStorage.getItem('visibility_professional_id');
    const storedProfToken = sessionStorage.getItem('visibility_professional_token');
    
    if (!storedProfId && !storedProfToken) {
      toast({
        title: 'Complete your profile first',
        description: 'Please complete your profile review before selecting coverage areas.',
        variant: 'destructive',
      });
      navigate('/');
      return;
    }
    if (storedProfId) setProfessionalId(storedProfId);
  }, [navigate, toast, isDashboardEdit]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Load cities from database
  useEffect(() => {
    async function loadCities() {
      setIsLoading(true);
      try {
        // Determine state to filter by
        let stateFilter = 'arizona'; // default for funnel
        
        if (isDashboardEdit && professionalId) {
          const { data: prof } = await supabase
            .from('professionals')
            .select('state_slug, service_areas')
            .eq('id', professionalId)
            .single();
          
          if (prof?.state_slug) {
            stateFilter = prof.state_slug;
            setAgentStateSlug(prof.state_slug);
          }

          // Pre-select existing service_areas
          if (prof?.service_areas && Array.isArray(prof.service_areas)) {
            // Will match after cities load below
            var existingServiceAreas = prof.service_areas;
          }
        }

        const { data, error } = await supabase
          .from('cities')
          .select('id, name, slug, state, state_slug')
          .eq('active', true)
          .eq('state_slug', stateFilter)
          .order('name');

        if (error) throw error;

        const cityOptions: CityData[] = (data || []).map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        }));

        setCities(cityOptions);

        // Build bundles from REGIONAL_PACKAGES with actual city IDs
        if (stateFilter === 'arizona') {
          const cityBySlug = new Map(cityOptions.map(c => [c.slug, c.id]));
          const cityNameBySlug = new Map(cityOptions.map(c => [c.slug, c.name]));
          const resolvedBundles: CityBundle[] = REGIONAL_PACKAGES.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            category: pkg.category,
            cityIds: pkg.includedCityIds
              .map(slug => cityBySlug.get(slug))
              .filter((id): id is string => !!id),
            cityNames: pkg.includedCityIds
              .map(slug => cityNameBySlug.get(slug))
              .filter((name): name is string => !!name),
          }));
          setBundles(resolvedBundles);
        }

        // Pre-select existing service_areas (dashboard edit mode)
        if (isDashboardEdit && existingServiceAreas) {
          const existingNames = new Set(
            existingServiceAreas.map((a: string) => a.replace(/,\s*[A-Z]{2}$/, '').trim())
          );
          const preSelected = new Set<string>();
          cityOptions.forEach((city) => {
            if (existingNames.has(city.name)) {
              preSelected.add(city.id);
            }
          });
          if (preSelected.size > 0) {
            setSelectedCityIds(preSelected);
          }
        } else {
          // Load saved selection from sessionStorage (funnel mode)
          try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
              const parsed: StoredSelection = JSON.parse(stored);
              const savedAt = new Date(parsed.savedAt);
              const now = new Date();
              const hoursOld = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
              
              if (hoursOld < STORAGE_EXPIRY_HOURS && parsed.selectedCityIds) {
                setSelectedCityIds(new Set(parsed.selectedCityIds));
              } else {
                sessionStorage.removeItem(STORAGE_KEY);
              }
            }
          } catch (e) {
            console.error('Error loading saved selection:', e);
          }
        }
      } catch (error) {
        console.error('Error loading cities:', error);
        toast({
          title: 'Error',
          description: 'Failed to load cities. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    if (!isDashboardEdit || professionalId) {
      loadCities();
    }
  }, [toast, isDashboardEdit, professionalId]);

  const persistSelection = (nextCityIds: Set<string>) => {
    // Preserve any neighborhoods already selected in later steps
    let existingNeighborhoods: StoredSelection['selectedNeighborhoods'] = [];
    let skippedExpertise: StoredSelection['skippedExpertise'] = undefined;

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredSelection = JSON.parse(stored);
        existingNeighborhoods = parsed.selectedNeighborhoods || [];
        skippedExpertise = parsed.skippedExpertise;
      }
    } catch (e) {
      console.error('Error loading existing selection:', e);
    }

    const selection: StoredSelection = {
      selectedCityIds: Array.from(nextCityIds),
      selectedNeighborhoods: existingNeighborhoods,
      ...(skippedExpertise ? { skippedExpertise } : {}),
      savedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  };

  // Handle bundle add (persist immediately so selections survive refresh/back)
  const handleAddBundle = (_bundleId: string, cityIds: string[]) => {
    setSelectedCityIds(prev => {
      const next = new Set(prev);
      cityIds.forEach(id => next.add(id));
      persistSelection(next);
      return next;
    });
  };

  // Handle continue to expertise or save and return to dashboard
  const handleContinue = async () => {
    if (isDashboardEdit) {
      // Save directly via edge function and return to dashboard
      setSaving(true);
      try {
        const selectedCityObjects = cities.filter(c => selectedCityIds.has(c.id));
        const { data: stateData } = await supabase
          .from('cities')
          .select('state')
          .eq('id', selectedCityObjects[0]?.id)
          .single();
        const stateName = stateData?.state || '';
        const serviceAreas = selectedCityObjects.map(c => `${c.name}, ${stateName}`);

        // Use update-professional-field (bypasses RLS with service role)
        const profId = professionalId || sessionStorage.getItem('visibility_professional_id');
        if (!profId) throw new Error('No professional ID');

        // Save display names (service_areas) and slugs (served_cities)
        const servedCitySlugs = selectedCityObjects.map(c => c.slug || c.name.toLowerCase().replace(/\s+/g, '-'));

        const [r1, r2] = await Promise.all([
          supabase.functions.invoke('update-professional-field', {
            body: { professional_id: profId, field: 'service_areas', value: serviceAreas },
          }),
          supabase.functions.invoke('update-professional-field', {
            body: { professional_id: profId, field: 'served_cities', value: servedCitySlugs },
          }),
        ]);

        if (r1.error) throw r1.error;
        if (r2.error) throw r2.error;

        toast({
          title: 'Cities updated',
          description: `${selectedCityIds.size} cities saved to your profile.`,
        });
        navigate('/agent/dashboard');
      } catch (err) {
        console.error('Error saving cities:', err);
        toast({
          title: 'Error',
          description: 'Failed to save cities. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    // Normal funnel flow
    // Load existing selection to preserve neighborhoods if any
    let existingNeighborhoods: StoredSelection['selectedNeighborhoods'] = [];
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredSelection = JSON.parse(stored);
        existingNeighborhoods = parsed.selectedNeighborhoods || [];
      }
    } catch (e) {
      console.error('Error loading existing neighborhoods:', e);
    }

    // Save selection to sessionStorage
    const selection: StoredSelection = {
      selectedCityIds: Array.from(selectedCityIds),
      selectedNeighborhoods: existingNeighborhoods,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));

    // Track cities selected event for Pipedrive
    const selectedCityNames = Array.from(selectedCityIds)
      .map(id => cities.find(c => c.id === id)?.name)
      .filter((name): name is string => !!name);
    
    trackEvent(FUNNEL_EVENTS.CITIES_SELECTED, {
      city_count: selectedCityIds.size,
      city_names: selectedCityNames.join(', '),
    });
    
    navigate('/visibility/expertise');
  };

  const cityCount = selectedCityIds.size;
  const hasSelections = cityCount > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Select Your Coverage Areas | Top10Lists</title>
        <meta name="description" content="Choose the cities where you actively serve clients. City listings are free for all qualified agents." />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>

      <div className="container max-w-7xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Select Your Coverage Areas</h1>
          <p className="text-muted-foreground mt-1">
            Choose the cities where you want to appear. City listings are free for all qualified agents.
          </p>
        </div>

        {/* City Bundles */}
        <div className="max-w-4xl">
          <BundlesPanel
            bundles={bundles}
            selectedCities={selectedCityIds}
            onAddBundle={handleAddBundle}
          />
        </div>

        {/* Summary and CTA */}
        <div className="max-w-4xl mt-6 p-4 rounded-lg border bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">{cityCount} cities selected</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              Free
            </span>
          </div>
          <Button
            disabled={!hasSelections || saving}
            onClick={handleContinue}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : isDashboardEdit ? (
              <Save className="w-4 h-4 mr-2" />
            ) : null}
            {isDashboardEdit ? 'Save & Return to Dashboard' : 'Select Neighborhoods'}
            {!isDashboardEdit && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      </div>

      <FunnelPhoneSupport />
    </>
  );
}
