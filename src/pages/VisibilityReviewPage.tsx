import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CoverageProgress } from '@/components/visibility/CoverageProgress';
import { ReviewSummaryCard } from '@/components/visibility/ReviewSummaryCard';
import { useToast } from '@/hooks/use-toast';
import type { SelectedNeighborhood, QuoteCartResponse } from '@/types/neighborhoodPricing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STORAGE_KEY = 'visibility_selection';
const STORAGE_EXPIRY_HOURS = 24;

interface StoredSelection {
  selectedCityIds: string[];
  selectedNeighborhoods: SelectedNeighborhood[];
  skippedExpertise?: boolean;
  savedAt: string;
}

export default function VisibilityReviewPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selection, setSelection] = useState<StoredSelection | null>(null);
  const [serverQuote, setServerQuote] = useState<QuoteCartResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [quoteError, setQuoteError] = useState<string | undefined>();
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [cityNames, setCityNames] = useState<Map<string, string>>(new Map());
  const [showPriceMismatchModal, setShowPriceMismatchModal] = useState(false);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get authenticated user and their professional ID
  useEffect(() => {
    async function loadAuth() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          toast({
            title: 'Authentication required',
            description: 'Please sign in to continue.',
            variant: 'destructive',
          });
          // Store return URL for post-login redirect
          sessionStorage.setItem('visibility_return_url', '/visibility/review');
          navigate('/agent/login');
          return;
        }

        setUserEmail(user.email ?? null);

        // Look up professional by email
        const { data: professional } = await supabase
          .from('professionals')
          .select('id')
          .eq('email', user.email)
          .eq('active', true)
          .single();

        if (professional) {
          setProfessionalId(professional.id);
        } else {
          toast({
            title: 'Profile not found',
            description: 'No active professional profile found for your account.',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }
      } catch (e) {
        console.error('Error loading auth:', e);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    loadAuth();
  }, [navigate, toast]);

  // Load selection from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) {
        toast({
          title: 'No selection found',
          description: 'Please start by selecting your coverage.',
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

      setSelection(parsed);
    } catch (e) {
      console.error('Error loading selection:', e);
      navigate('/visibility/coverage');
    }
  }, [navigate, toast]);

  // Load city names for display
  useEffect(() => {
    async function loadCityNames() {
      if (!selection?.selectedCityIds.length) return;

      const { data } = await supabase
        .from('cities')
        .select('id, name')
        .in('id', selection.selectedCityIds);

      if (data) {
        const map = new Map<string, string>();
        data.forEach(c => map.set(c.id, c.name));
        setCityNames(map);
      }
    }

    loadCityNames();
  }, [selection]);

  // Fetch server quote
  const fetchQuote = useCallback(async () => {
    if (!selection?.selectedNeighborhoods.length) {
      setIsLoadingQuote(false);
      return;
    }

    setIsLoadingQuote(true);
    setQuoteError(undefined);

    try {
      const { data, error } = await supabase.functions.invoke('quote-neighborhood-cart', {
        body: {
          neighborhood_ids: selection.selectedNeighborhoods.map(n => n.id),
        },
      });

      if (error) throw error;
      setServerQuote(data);
    } catch (error) {
      console.error('Error fetching quote:', error);
      setQuoteError('Failed to get current pricing. Please try again.');
    } finally {
      setIsLoadingQuote(false);
    }
  }, [selection]);

  useEffect(() => {
    if (selection) {
      fetchQuote();
    }
  }, [selection, fetchQuote]);

  // Handle proceed to payment
  const handleProceedToPayment = async () => {
    if (!selection || !professionalId || !userEmail) {
      toast({
        title: 'Not ready',
        description: 'Please wait while we load your profile.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingCheckout(true);

    try {
      // Build checkout request matching create-agent-checkout interface
      const checkoutRequest = {
        professionalId,
        email: userEmail,
        selectedNeighborhoods: selection.selectedNeighborhoods.map(n => ({
          neighborhoodId: n.id,
          neighborhoodName: n.neighborhood,
          cityArea: n.city_area,
          tier: n.tier_at_selection,
          price: serverQuote?.items.find(i => i.neighborhood_id === n.id)?.final_price_monthly ?? n.price_monthly,
        })),
        allNeighborhoodIds: selection.selectedNeighborhoods.map(n => n.id),
        allCityIds: selection.selectedCityIds,
        billingPeriod: 'monthly' as const,
        configVersion: serverQuote?.config_version_used,
        monthlyTotal: serverQuote?.total_monthly ?? selection.selectedNeighborhoods.reduce((sum, n) => sum + n.price_monthly, 0),
        successUrl: `${window.location.origin}/visibility/success`,
        cancelUrl: `${window.location.origin}/visibility/review`,
      };

      const { data, error } = await supabase.functions.invoke('create-agent-checkout', {
        body: checkoutRequest,
      });

      if (error) {
        // Check for price mismatch error
        if (data?.error === 'price_mismatch') {
          setShowPriceMismatchModal(true);
          return;
        }
        throw error;
      }

      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: 'Checkout Error',
        description: 'Failed to create checkout session. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  // Handle confirm free coverage (cities only)
  const handleConfirmFreeCoverage = () => {
    // For now, just show success and clear storage
    // In production, this would save the city coverage to the database
    toast({
      title: 'Coverage Confirmed',
      description: 'Your city coverage has been set up successfully.',
    });
    sessionStorage.removeItem(STORAGE_KEY);
    navigate('/visibility/success?type=free');
  };

  // Handle edit coverage (go back to coverage step)
  const handleEditCoverage = () => {
    navigate('/visibility/coverage');
  };

  // Handle edit expertise (go back to expertise step)
  const handleEditExpertise = () => {
    navigate('/visibility/expertise');
  };

  // Handle retry quote
  const handleRetryQuote = () => {
    fetchQuote();
  };

  // Handle price mismatch - refresh and continue
  const handlePriceMismatchContinue = () => {
    setShowPriceMismatchModal(false);
    fetchQuote();
  };

  if (!selection || isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasNeighborhoods = selection.selectedNeighborhoods.length > 0;
  const hasCities = selection.selectedCityIds.length > 0;
  const cityCount = selection.selectedCityIds.length;
  const neighborhoodCount = selection.selectedNeighborhoods.length;

  return (
    <>
      <Helmet>
        <title>Review Your Coverage | Top10Lists</title>
        <meta name="description" content="Review your selected coverage before confirming." />
      </Helmet>

      <div className="container max-w-3xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <CoverageProgress current="review" />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Review Your Coverage</h1>
          <p className="text-muted-foreground mt-1">
            {hasNeighborhoods 
              ? 'Confirm your selection before proceeding to payment.'
              : 'Review your free city coverage before confirming.'
            }
          </p>
        </div>

        {/* Cities Summary */}
        <div className="rounded-lg border bg-card mb-4">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <h3 className="font-semibold">City Coverage</h3>
                <p className="text-sm text-muted-foreground">
                  {cityCount} cities selected
                </p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                Free
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleEditCoverage}>
              Edit
            </Button>
          </div>
          <div className="px-4 pb-4">
            <div className="flex flex-wrap gap-1">
              {Array.from(cityNames.values()).map((name) => (
                <span
                  key={name}
                  className="text-xs bg-muted px-2 py-1 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Neighborhoods Summary (if any) */}
        {hasNeighborhoods && (
          <div className="rounded-lg border bg-card mb-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-semibold">Verified Neighborhood Expertise</h3>
                  <p className="text-sm text-muted-foreground">
                    {neighborhoodCount} neighborhood{neighborhoodCount !== 1 ? 's' : ''} · adds geographic context without affecting ranking
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleEditExpertise}>
                Edit
              </Button>
            </div>
            <ReviewSummaryCard
              selectedCities={new Set([])}
              cityNames={new Map()}
              selectedNeighborhoods={selection.selectedNeighborhoods}
              serverQuote={serverQuote ?? undefined}
              isLoadingQuote={isLoadingQuote}
              quoteError={quoteError}
              onRetry={handleRetryQuote}
            />
          </div>
        )}

        {/* No neighborhoods message */}
        {!hasNeighborhoods && hasCities && (
          <div className="rounded-lg border bg-card p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <span className="text-lg">🏘️</span>
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  No neighborhood highlights selected. You can add them later from your dashboard.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleEditExpertise}>
                Add Neighborhoods
              </Button>
            </div>
          </div>
        )}

        {/* No selections message */}
        {!hasNeighborhoods && !hasCities && (
          <div className="mt-6 p-4 rounded-lg border border-dashed flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <p className="text-muted-foreground">
              You haven't selected any coverage. Go back to add cities.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <Button
            variant="outline"
            onClick={handleEditCoverage}
            className="sm:order-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Edit Coverage
          </Button>

          {hasNeighborhoods && (
            <Button
              onClick={handleProceedToPayment}
              disabled={isLoadingQuote || isCreatingCheckout || !!quoteError}
              className="sm:order-2 flex-1 sm:flex-none"
            >
              {isCreatingCheckout ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Checkout...
                </>
              ) : (
                'Proceed to Payment'
              )}
            </Button>
          )}

          {!hasNeighborhoods && hasCities && (
            <Button
              onClick={handleConfirmFreeCoverage}
              className="sm:order-2 flex-1 sm:flex-none"
            >
              Confirm Free Coverage
            </Button>
          )}
        </div>
      </div>

      {/* Price Mismatch Modal */}
      <Dialog open={showPriceMismatchModal} onOpenChange={setShowPriceMismatchModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prices Have Changed</DialogTitle>
            <DialogDescription>
              Some neighborhood prices have been updated since you started. We've refreshed your quote with the latest prices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPriceMismatchModal(false)}>
              Cancel
            </Button>
            <Button onClick={handlePriceMismatchContinue}>
              View Updated Prices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
