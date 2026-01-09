import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CoverageProgress } from '@/components/visibility/CoverageProgress';
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
interface CityData {
  id: string;
  name: string;
  slug: string;
}

export default function VisibilityCoveragePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [cities, setCities] = useState<CityData[]>([]);
  const [bundles, setBundles] = useState<CityBundle[]>([]);
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);


  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
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

        const cityOptions: CityData[] = (data || []).map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
        }));

        setCities(cityOptions);

        // Build bundles from REGIONAL_PACKAGES with actual city IDs, names, and categories
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
            Choose the cities where you want to appear in the Top 10. City coverage is free.
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
            disabled={!hasSelections}
            onClick={handleContinue}
          >
            Continue to Expertise
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </>
  );
}
