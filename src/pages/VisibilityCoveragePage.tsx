import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CoverageProgress } from '@/components/visibility/CoverageProgress';
import { CitiesPanel, type CityOption } from '@/components/visibility/CitiesPanel';
import { BundlesPanel, type CityBundle } from '@/components/visibility/BundlesPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { REGIONAL_PACKAGES } from '@/data/arizonaPackages';

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

export default function VisibilityCoveragePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [cities, setCities] = useState<CityOption[]>([]);
  const [bundles, setBundles] = useState<CityBundle[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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
            
            if (hoursOld < STORAGE_EXPIRY_HOURS && parsed.selectedCityIds) {
              setSelectedCityIds(new Set(parsed.selectedCityIds));
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
  }, [toast]);

  // Build city names map for display
  const cityNames = useMemo(() => {
    const map = new Map<string, string>();
    cities.forEach(c => map.set(c.id, c.name));
    return map;
  }, [cities]);

  // Handle city selection changes
  const handleCityChange = (next: Set<string>) => {
    setSelectedCityIds(next);
  };

  // Handle bundle add
  const handleAddBundle = (_bundleId: string, cityIds: string[]) => {
    setSelectedCityIds(prev => {
      const next = new Set(prev);
      cityIds.forEach(id => next.add(id));
      return next;
    });
  };

  // Handle continue to expertise
  const handleContinue = () => {
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
      <Helmet>
        <title>Select Your Coverage Areas | Top10Lists</title>
        <meta name="description" content="Choose the cities where you actively serve clients. City coverage is free." />
      </Helmet>

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <CoverageProgress current="coverage" />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Select Your Coverage Areas</h1>
          <p className="text-muted-foreground mt-1">
            Choose the cities where you actively serve clients. Coverage defines where you may be evaluated if you qualify. City coverage is free.
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
          </div>

          {/* Right column - Summary (desktop only) */}
          {!isMobile && (
            <div className="w-80 flex-shrink-0">
              <div className="sticky top-6 rounded-lg border bg-card shadow-sm">
                {/* Cities Section */}
                <div className="p-4 border-b">
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-semibold text-sm">Cities Selected</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      Free
                    </span>
                  </div>

                  {cityCount === 0 ? (
                    <p className="text-sm text-muted-foreground">No cities selected</p>
                  ) : (
                    <p className="text-2xl font-bold">{cityCount} cities</p>
                  )}
                </div>

                {/* CTA Section */}
                <div className="p-4">
                  <Button
                    className="w-full"
                    disabled={!hasSelections}
                    onClick={handleContinue}
                  >
                    Continue to Expertise
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile footer */}
        {isMobile && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="text-sm">
                <span className="font-medium">{cityCount} cities selected</span>
                <span className="text-muted-foreground"> · </span>
                <span className="text-green-600 font-medium">Free</span>
              </div>
              <Button
                size="sm"
                disabled={!hasSelections}
                onClick={handleContinue}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Spacer for mobile footer */}
        {isMobile && <div className="h-16" />}
      </div>
    </>
  );
}
