import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCoverageSelection } from '@/hooks/useCoverageSelection';
import { CoverageProgress } from '@/components/visibility/CoverageProgress';
import { CitiesPanel, type CityOption } from '@/components/visibility/CitiesPanel';
import { BundlesPanel, type CityBundle } from '@/components/visibility/BundlesPanel';
import { NeighborhoodsPanel } from '@/components/visibility/NeighborhoodsPanel';
import { CoverageSummaryCard } from '@/components/visibility/CoverageSummaryCard';
import { CoverageSummaryFooter } from '@/components/visibility/CoverageSummaryFooter';
import { useToast } from '@/hooks/use-toast';
import { REGIONAL_PACKAGES } from '@/data/arizonaPackages';

const STORAGE_KEY = 'visibility_selection';
const STORAGE_EXPIRY_HOURS = 24;

interface StoredSelection {
  selectedCityIds: string[];
  selectedNeighborhoods: ReturnType<typeof useCoverageSelection>['selectedNeighborhoods'];
  pricingConfigVersion?: string;
  savedAt: string;
}

export default function VisibilitySetupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [cities, setCities] = useState<CityOption[]>([]);
  const [bundles, setBundles] = useState<CityBundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const {
    selectedCityIds,
    addCity,
    removeCity,
    addCities,
    clearCities,
    selectedNeighborhoods,
    addNeighborhood,
    removeNeighborhood,
    subtotalMonthly,
    loadSelection,
  } = useCoverageSelection();

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load cities from database
  useEffect(() => {
    async function loadCities() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('cities')
          .select('id, name, slug, state, state_slug')
          .eq('active', true)
          .eq('state_slug', 'arizona')
          .order('name');

        if (error) throw error;

        const cityOptions: CityOption[] = (data || []).map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        }));

        setCities(cityOptions);

        // Build bundles from REGIONAL_PACKAGES with actual city IDs and names
        const cityBySlug = new Map(cityOptions.map(c => [c.slug, c.id]));
        const cityNameBySlug = new Map(cityOptions.map(c => [c.slug, c.name]));
        const resolvedBundles: CityBundle[] = REGIONAL_PACKAGES.map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          description: pkg.description,
          cityIds: pkg.includedCityIds
            .map(slug => cityBySlug.get(slug))
            .filter((id): id is string => !!id),
          cityNames: pkg.includedCityIds
            .map(slug => cityNameBySlug.get(slug))
            .filter((name): name is string => !!name),
        }));
        setBundles(resolvedBundles);

        // Load saved selection from sessionStorage
        try {
          const stored = sessionStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed: StoredSelection = JSON.parse(stored);
            const savedAt = new Date(parsed.savedAt);
            const now = new Date();
            const hoursOld = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
            
            if (hoursOld < STORAGE_EXPIRY_HOURS) {
              loadSelection({
                selectedCityIds: parsed.selectedCityIds,
                selectedNeighborhoods: parsed.selectedNeighborhoods,
                pricingConfigVersion: parsed.pricingConfigVersion,
              });
            } else {
              sessionStorage.removeItem(STORAGE_KEY);
            }
          }
        } catch (e) {
          console.error('Error loading saved selection:', e);
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

    loadCities();
  }, [loadSelection, toast]);

  // Build city names map for display
  const cityNames = useMemo(() => {
    const map = new Map<string, string>();
    cities.forEach(c => map.set(c.id, c.name));
    return map;
  }, [cities]);

  // Handle city selection changes
  const handleCityChange = (next: Set<string>) => {
    // Find what changed
    const added = [...next].filter(id => !selectedCityIds.has(id));
    const removed = [...selectedCityIds].filter(id => !next.has(id));
    
    added.forEach(id => addCity(id));
    removed.forEach(id => removeCity(id));
  };

  // Handle bundle add
  const handleAddBundle = (_bundleId: string, cityIds: string[]) => {
    addCities(cityIds);
  };

  // Handle continue to review
  const handleContinue = () => {
    // Save selection to sessionStorage
    const selection: StoredSelection = {
      selectedCityIds: Array.from(selectedCityIds),
      selectedNeighborhoods,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    
    navigate('/visibility/review');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Set Up Your Coverage | Top10Lists</title>
        <meta name="description" content="Choose your cities and neighborhoods for guaranteed Top 10 placement." />
      </Helmet>

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <CoverageProgress current="setup" />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Set Up Your Coverage</h1>
          <p className="text-muted-foreground mt-1">
            Select the cities and neighborhoods where you want to appear in the Top 10.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column - Selection panels */}
          <div className="flex-1 space-y-6">
            {/* City Bundles */}
            <BundlesPanel
              bundles={bundles}
              selectedCities={selectedCityIds}
              onAddBundle={handleAddBundle}
            />

            {/* Individual Cities */}
            <CitiesPanel
              allCities={cities}
              selected={selectedCityIds}
              onChange={handleCityChange}
            />

            {/* Premium Neighborhoods */}
            <NeighborhoodsPanel
              state="AZ"
              selectedNeighborhoods={selectedNeighborhoods}
              onAdd={addNeighborhood}
              onRemove={removeNeighborhood}
            />
          </div>

          {/* Right column - Summary (desktop only) */}
          {!isMobile && (
            <div className="w-80 flex-shrink-0">
              <CoverageSummaryCard
                selectedCities={selectedCityIds}
                cityNames={cityNames}
                selectedNeighborhoods={selectedNeighborhoods}
                subtotalMonthly={subtotalMonthly}
                onContinue={handleContinue}
              />
            </div>
          )}
        </div>

        {/* Mobile footer */}
        {isMobile && (
          <CoverageSummaryFooter
            selectedCities={selectedCityIds}
            cityNames={cityNames}
            selectedNeighborhoods={selectedNeighborhoods}
            subtotalMonthly={subtotalMonthly}
            onContinue={handleContinue}
          />
        )}
      </div>
    </>
  );
}
