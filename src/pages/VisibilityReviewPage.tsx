import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
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
  pricingConfigVersion?: string;
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
        navigate('/visibility');
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
        navigate('/visibility');
        return;
      }

      setSelection(parsed);
    } catch (e) {
      console.error('Error loading selection:', e);
      navigate('/visibility');
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
    if (!selection) return;

    // For now, we'll create a test checkout - in production this would use real professional ID
    setIsCreatingCheckout(true);

    try {
      // Build checkout request matching create-agent-checkout interface
      const checkoutRequest = {
        professionalId: 'test-professional-id', // TODO: Get from auth context
        email: 'test@example.com', // TODO: Get from auth context
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

  // Handle edit coverage (go back)
  const handleEditCoverage = () => {
    navigate('/visibility');
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

  if (!selection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasNeighborhoods = selection.selectedNeighborhoods.length > 0;
  const hasCities = selection.selectedCityIds.length > 0;

  return (
    <>
      <Helmet>
        <title>Review Your Coverage | Top10Lists</title>
        <meta name="description" content="Review your selected coverage before checkout." />
      </Helmet>

      <div className="container max-w-3xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <CoverageProgress current="review" />
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Review Your Coverage</h1>
          <p className="text-muted-foreground mt-1">
            Confirm your selection before proceeding to payment.
          </p>
        </div>

        {/* Review Summary Card */}
        <ReviewSummaryCard
          selectedCities={new Set(selection.selectedCityIds)}
          cityNames={cityNames}
          selectedNeighborhoods={selection.selectedNeighborhoods}
          serverQuote={serverQuote ?? undefined}
          isLoadingQuote={isLoadingQuote}
          quoteError={quoteError}
          onRetry={handleRetryQuote}
        />

        {/* No selections message */}
        {!hasNeighborhoods && !hasCities && (
          <div className="mt-6 p-4 rounded-lg border border-dashed flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <p className="text-muted-foreground">
              You haven't selected any coverage. Go back to add cities or neighborhoods.
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
              onClick={() => {
                // Just cities (free) - no payment needed
                toast({
                  title: 'Free Coverage Confirmed',
                  description: 'Your city coverage has been set up.',
                });
                sessionStorage.removeItem(STORAGE_KEY);
                navigate('/visibility/success');
              }}
              className="sm:order-2 flex-1 sm:flex-none"
            >
              Confirm Free Cities
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
