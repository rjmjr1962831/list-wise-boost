import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CoverageProgress } from '@/components/visibility/CoverageProgress';
import { NeighborhoodsPanel } from '@/components/visibility/NeighborhoodsPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { TierBadge } from '@/components/visibility/TierBadge';
import type { SelectedNeighborhood } from '@/types/neighborhoodPricing';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const STORAGE_KEY = 'visibility_selection';
const STORAGE_EXPIRY_HOURS = 24;

interface StoredSelection {
  selectedCityIds: string[];
  selectedNeighborhoods: SelectedNeighborhood[];
  skippedExpertise?: boolean;
  savedAt: string;
}

export default function VisibilityExpertisePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<SelectedNeighborhood[]>([]);
  const [cityNames, setCityNames] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isCitiesExpanded, setIsCitiesExpanded] = useState(false);
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load selection from sessionStorage
  useEffect(() => {
    async function loadSelection() {
      setIsLoading(true);
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (!stored) {
          toast({
            title: 'No coverage found',
            description: 'Please start by selecting your coverage areas.',
            variant: 'destructive',
          });
          navigate('/visibility/coverage');
          return;
        }

        const parsed: StoredSelection = JSON.parse(stored);
        const savedAt = new Date(parsed.savedAt);
        const now = new Date();
        const hoursOld = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);

        if (hoursOld >= STORAGE_EXPIRY_HOURS) {
          sessionStorage.removeItem(STORAGE_KEY);
          toast({
            title: 'Session expired',
            description: 'Your selection has expired. Please start again.',
            variant: 'destructive',
          });
          navigate('/visibility/coverage');
          return;
        }

        if (!parsed.selectedCityIds || parsed.selectedCityIds.length === 0) {
          toast({
            title: 'No cities selected',
            description: 'Please select at least one city first.',
            variant: 'destructive',
          });
          navigate('/visibility/coverage');
          return;
        }

        setSelectedCityIds(parsed.selectedCityIds);
        setSelectedNeighborhoods(parsed.selectedNeighborhoods || []);

        // Load city names
        const { data: citiesData } = await supabase
          .from('cities')
          .select('id, name')
          .in('id', parsed.selectedCityIds);

        if (citiesData) {
          const map = new Map<string, string>();
          citiesData.forEach(c => map.set(c.id, c.name));
          setCityNames(map);
        }
      } catch (error) {
        console.error('Error loading selection:', error);
        navigate('/visibility/coverage');
      } finally {
        setIsLoading(false);
      }
    }

    loadSelection();
  }, [navigate, toast]);

  // Handle neighborhood add
  const handleAddNeighborhood = (neighborhood: SelectedNeighborhood) => {
    console.log('[VisibilityExpertisePage] handleAddNeighborhood called:', neighborhood);
    setSelectedNeighborhoods(prev => {
      const next = [...prev, neighborhood];
      console.log('[VisibilityExpertisePage] New selectedNeighborhoods:', next);
      return next;
    });
  };

  // Handle neighborhood remove
  const handleRemoveNeighborhood = (neighborhoodId: string) => {
    setSelectedNeighborhoods(prev => prev.filter(n => n.id !== neighborhoodId));
  };

  // Handle continue to review
  const handleContinue = () => {
    const selection: StoredSelection = {
      selectedCityIds,
      selectedNeighborhoods,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    navigate('/visibility/review');
  };

  // Handle skip
  const handleSkip = () => {
    const selection: StoredSelection = {
      selectedCityIds,
      selectedNeighborhoods: [],
      skippedExpertise: true,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    navigate('/visibility/review');
  };

  // Handle edit coverage
  const handleEditCoverage = () => {
    navigate('/visibility/coverage');
  };

  // Calculate totals
  const cityCount = selectedCityIds.length;
  const neighborhoodCount = selectedNeighborhoods.length;
  const monthlyTotal = selectedNeighborhoods.reduce((sum, n) => sum + n.price_monthly, 0);

  // City list for display
  const cityList = useMemo(() => {
    return selectedCityIds.map(id => cityNames.get(id) || id);
  }, [selectedCityIds, cityNames]);

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
        <title>Highlight Your Neighborhood Expertise | Top10Lists</title>
        <meta name="description" content="Optionally highlight specific neighborhoods where you have demonstrated experience." />
      </Helmet>

      <div className="container max-w-7xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <CoverageProgress current="expertise" />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Highlight Your Neighborhood Expertise</h1>
          <p className="text-muted-foreground mt-1">
            Optionally highlight specific neighborhoods where you have demonstrated experience. 
            Neighborhood highlights refine how your profile is presented and do not affect ranking eligibility or position.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column - Main content */}
          <div className="flex-1 space-y-6">
            {/* Coverage Summary (Collapsible) */}
            <Collapsible open={isCitiesExpanded} onOpenChange={setIsCitiesExpanded}>
              <div className="rounded-lg border bg-card">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold">Your Coverage</h3>
                        <p className="text-sm text-muted-foreground">
                          {cityCount} cities selected
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Free
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCoverage();
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      {isCitiesExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 border-t pt-4">
                    <div className="flex flex-wrap gap-1">
                      {cityList.map((name) => (
                        <span
                          key={name}
                          className="text-xs bg-muted px-2 py-1 rounded"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Neighborhood Highlights Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">Neighborhood Highlights</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Tier pricing:</span>
                  <TierBadge tier="Main" showPrice size="sm" />
                  <TierBadge tier="Prime" showPrice size="sm" />
                  <TierBadge tier="Luxury" showPrice size="sm" />
                </div>
              </div>

              {/* Value points */}
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Adds neighborhood-level context to your profile</p>
                <p>• Helps users and AI systems understand geographic specialization</p>
                <p>• Optional and cancellable at any time</p>
              </div>

              {/* Neighborhoods Panel */}
              <NeighborhoodsPanel
                state="AZ"
                selectedNeighborhoods={selectedNeighborhoods}
                onAdd={handleAddNeighborhood}
                onRemove={handleRemoveNeighborhood}
              />

              {/* Continue button - always visible */}
              <div className="mt-6 p-4 rounded-lg border bg-card flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-sm text-muted-foreground">
                    {neighborhoodCount === 0 
                      ? "No neighborhoods selected yet. You can add them later or continue with free city coverage."
                      : `${neighborhoodCount} neighborhood${neighborhoodCount !== 1 ? 's' : ''} selected · $${monthlyTotal}/mo`
                    }
                  </p>
                </div>
                <div className="w-full sm:w-auto">
                  <Button onClick={handleContinue} className="w-full sm:w-auto">
                    Continue to Review
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Summary (desktop only) */}
          {!isMobile && (
            <div className="w-80 flex-shrink-0">
              <div className="sticky top-6 rounded-lg border bg-card shadow-sm">
                <div className="p-4 border-b">
                  <h4 className="font-semibold text-sm mb-4">Your Selection</h4>
                  
                  {/* Cities */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Cities</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cityCount}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Free
                      </span>
                    </div>
                  </div>
                  
                  {/* Neighborhoods */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Neighborhoods</span>
                    <span className="text-sm font-medium">
                      {neighborhoodCount} · ${monthlyTotal}/mo
                    </span>
                  </div>

                  {/* Neighborhood list if any */}
                  {selectedNeighborhoods.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      {selectedNeighborhoods.map((n) => (
                        <div key={n.id} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{n.neighborhood}</span>
                          <span className="text-muted-foreground ml-2">${n.price_monthly}/mo</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Monthly Total</span>
                    <span className="text-lg font-bold">
                      {monthlyTotal === 0 ? 'Free' : `$${monthlyTotal}/mo`}
                    </span>
                  </div>
                </div>

                {/* CTA Section */}
                <div className="p-4 space-y-3">
                  <Button
                    className="w-full"
                    onClick={handleContinue}
                  >
                    Review & Continue
                  </Button>
                  
                  <button
                    onClick={handleSkip}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Skip for now – just use free city coverage
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile footer */}
        {isMobile && (
          <>
            {/* Overlay when expanded */}
            {isFooterExpanded && (
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setIsFooterExpanded(false)}
              />
            )}

            <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
              {/* Expanded content */}
              {isFooterExpanded && (
                <div className="max-h-[60vh] overflow-y-auto p-4 border-b">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Your Selection</h3>
                    <button
                      onClick={() => setIsFooterExpanded(false)}
                      className="text-sm text-muted-foreground"
                    >
                      Close
                    </button>
                  </div>
                  
                  {/* Cities */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">Cities</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        Free
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {cityList.slice(0, 5).map((name) => (
                        <span
                          key={name}
                          className="text-xs bg-muted px-2 py-1 rounded"
                        >
                          {name}
                        </span>
                      ))}
                      {cityList.length > 5 && (
                        <span className="text-xs text-muted-foreground px-2 py-1">
                          +{cityList.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Neighborhoods */}
                  {selectedNeighborhoods.length > 0 && (
                    <div>
                      <span className="text-sm font-medium mb-2 block">Neighborhoods</span>
                      <div className="space-y-2">
                        {selectedNeighborhoods.map((n) => (
                          <div key={n.id} className="flex items-center justify-between text-sm">
                            <span>{n.neighborhood}</span>
                            <span className="text-muted-foreground">${n.price_monthly}/mo</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsed bar */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button')) return;
                  setIsFooterExpanded(!isFooterExpanded);
                }}
              >
                <div className="text-sm">
                  <span className="font-medium">{cityCount} cities</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-medium">{neighborhoodCount} neighborhoods</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-medium">
                    {monthlyTotal === 0 ? 'Free' : `$${monthlyTotal}/mo`}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContinue();
                  }}
                >
                  Review
                </Button>
              </div>

              {/* Skip option on mobile */}
              <div className="px-4 pb-3 pt-0">
                <button
                  onClick={handleSkip}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
                >
                  Skip for now – just use free city coverage
                </button>
              </div>
            </div>
          </>
        )}
        
        {/* Spacer for mobile footer */}
        {isMobile && <div className="h-28" />}
      </div>
    </>
  );
}
