// src/pages/profile/SelectNeighborhoods.tsx
// Request Neighborhood Expert designation page

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  NeighborhoodTier, 
  NeighborhoodCatalogItem,
  NEIGHBORHOOD_TIER_PRICES,
  NEIGHBORHOOD_TIER_STYLES,
} from '@/types/neighborhoodPricing';
import { Switch } from '@/components/ui/switch';

export default function SelectNeighborhoods() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Check for preselect params (from neighborhood apply flow)
  const preselectSlug = searchParams.get('preselect');
  const preselectCity = searchParams.get('city');
  
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodCatalogItem[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [requestedNeighborhoods, setRequestedNeighborhoods] = useState<Set<string>>(new Set());
  const [filledPositions, setFilledPositions] = useState<Set<string>>(new Set());
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(true);
  const [preselectApplied, setPreselectApplied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadData();
  }, [token]);

  // Handle preselect when neighborhoods are loaded
  useEffect(() => {
    if (preselectSlug && neighborhoods.length > 0 && !preselectApplied) {
      const preselected = neighborhoods.find(
        n => n.neighborhood_slug === preselectSlug && 
             (!preselectCity || n.city_area_slug === preselectCity)
      );
      if (preselected) {
        setRequestedNeighborhoods(new Set([preselected.id]));
        setPreselectApplied(true);
      }
    }
  }, [preselectSlug, preselectCity, neighborhoods, preselectApplied]);

  const loadData = async () => {
    // Load professional's selected cities from CitySelection step
    let professionalCities: string[] = [];
    
    if (token) {
      // First get the professional ID from the token
      const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('verification_token', token)
        .single();
      
      if (professional?.id) {
        // Get city associations from the junction table
        const { data: cityAssocs } = await supabase
          .from('professional_cities')
          .select('city_id')
          .eq('professional_id', professional.id)
          .eq('active', true);
        
        if (cityAssocs && cityAssocs.length > 0) {
          const cityIds = cityAssocs.map(c => c.city_id);
          
          // Get city names from IDs
          const { data: cities } = await supabase
            .from('cities')
            .select('name')
            .in('id', cityIds);
          
          if (cities) {
            professionalCities = cities.map(c => c.name);
          }
        }
      }
    }
    
    setSelectedCities(professionalCities);
    
    // Load neighborhoods
    const { data: neighborhoodData } = await supabase
      .from('neighborhood_catalog')
      .select('*')
      .eq('is_active', true)
      .order('neighborhood', { ascending: true });
    
    if (neighborhoodData) {
      setNeighborhoods(neighborhoodData as NeighborhoodCatalogItem[]);
    }
    
    // Load filled positions (neighborhoods with active subscriptions)
    const { data: filledData } = await supabase
      .from('agent_neighborhood_subscriptions')
      .select('neighborhood_id')
      .eq('is_active', true);
    
    if (filledData) {
      setFilledPositions(new Set(filledData.map(f => f.neighborhood_id)));
    }
    
    setLoading(false);
  };

  const handleToggleRequest = (neighborhoodId: string) => {
    const newRequested = new Set(requestedNeighborhoods);
    if (newRequested.has(neighborhoodId)) {
      newRequested.delete(neighborhoodId);
    } else {
      newRequested.add(neighborhoodId);
    }
    setRequestedNeighborhoods(newRequested);
  };

  // Annual = 10 months (2 months free)
  const getAnnualPriceWithDiscount = (monthly: number) => monthly * 10;

  const getPrice = (tier: NeighborhoodTier) => {
    const monthly = NEIGHBORHOOD_TIER_PRICES[tier];
    return billingCycle === 'annual' ? getAnnualPriceWithDiscount(monthly) : monthly;
  };

  const calculateTotal = () => {
    return Array.from(requestedNeighborhoods).reduce((sum, id) => {
      const neighborhood = neighborhoods.find(n => n.id === id);
      if (neighborhood) {
        return sum + getPrice(neighborhood.tier);
      }
      return sum;
    }, 0);
  };

  // Filter neighborhoods to only show those in selected cities
  const filteredNeighborhoods = neighborhoods.filter(n => 
    selectedCities.length === 0 || selectedCities.includes(n.city_area)
  );

  // Group neighborhoods by city
  const neighborhoodsByCity = filteredNeighborhoods.reduce((acc, n) => {
    if (!acc[n.city_area]) {
      acc[n.city_area] = [];
    }
    acc[n.city_area].push(n);
    return acc;
  }, {} as Record<string, NeighborhoodCatalogItem[]>);

  const formatPrice = (amount: number) => `$${amount.toLocaleString()}`;

  const handleContinue = () => {
    if (requestedNeighborhoods.size === 0) {
      navigate('/agent/dashboard');
    } else {
      // Store selected neighborhoods for checkout
      const selectedData = Array.from(requestedNeighborhoods).map(id => {
        const n = neighborhoods.find(nb => nb.id === id);
        return n ? { id: n.id, tier: n.tier, name: n.neighborhood, city: n.city_area } : null;
      }).filter(Boolean);
      
      sessionStorage.setItem('neighborhood_expert_requests', JSON.stringify({
        neighborhoods: selectedData,
        billingCycle
      }));
      
      navigate(`/profile/${token}/checkout`);
    }
  };

  const handleSkip = () => {
    navigate('/agent/dashboard');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-48">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">10</span>
              </div>
              <span className="text-xl font-bold text-slate-900">
                Top<span className="text-primary">10</span>Lists
              </span>
            </div>
            
            {/* Billing Toggle */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  billingCycle === 'monthly' 
                    ? 'bg-white shadow text-slate-900' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                  billingCycle === 'annual' 
                    ? 'bg-white shadow text-slate-900' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Annual
                <span className="text-xs text-green-600 font-semibold">2 months free</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            Request Neighborhood Expert designation
          </h1>
          <p className="text-lg text-slate-600 mb-2">
            A Neighborhood Expert is a single, verified agent highlighted for a specific neighborhood.
          </p>
          <p className="text-sm text-muted-foreground">
            Expert positions are limited and verified.
          </p>
        </div>

        {/* Neighborhood List by City */}
        {Object.keys(neighborhoodsByCity).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-600">
              No neighborhoods available for your selected cities.  Please go back and select cities first.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(neighborhoodsByCity).sort(([a], [b]) => a.localeCompare(b)).map(([city, cityNeighborhoods]) => (
              <div key={city} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">{city}</h2>
                  <p className="text-sm text-muted-foreground">
                    {cityNeighborhoods.length} neighborhood{cityNeighborhoods.length !== 1 ? 's' : ''} available
                  </p>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {cityNeighborhoods.map(neighborhood => {
                    const isRequested = requestedNeighborhoods.has(neighborhood.id);
                    const isFilled = filledPositions.has(neighborhood.id);
                    const styles = NEIGHBORHOOD_TIER_STYLES[neighborhood.tier];
                    const monthlyPrice = NEIGHBORHOOD_TIER_PRICES[neighborhood.tier];
                    const priceDisplay = billingCycle === 'annual' 
                      ? getAnnualPriceWithDiscount(monthlyPrice) 
                      : monthlyPrice;
                    
                    return (
                      <div
                        key={neighborhood.id}
                        className={`px-6 py-4 ${isFilled ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          {/* Neighborhood Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-slate-900 truncate">
                                {neighborhood.neighborhood}
                              </h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
                                {neighborhood.tier}
                              </span>
                            </div>
                            
                            {isFilled ? (
                              <p className="text-sm text-amber-600 font-medium">
                                Neighborhood Expert position currently filled
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {formatPrice(priceDisplay)}/{billingCycle === 'annual' ? 'yr' : 'mo'}
                                {billingCycle === 'annual' && (
                                  <span className="text-green-600 ml-2">2 months free</span>
                                )}
                              </p>
                            )}
                          </div>
                          
                          {/* Request Toggle */}
                          <div className="flex items-center gap-3">
                            <span className={`text-sm ${isFilled ? 'text-slate-400' : isRequested ? 'text-primary font-medium' : 'text-slate-500'}`}>
                              {isFilled ? 'Unavailable' : 'Request Neighborhood Expert'}
                            </span>
                            <Switch
                              checked={isRequested}
                              onCheckedChange={() => handleToggleRequest(neighborhood.id)}
                              disabled={isFilled}
                              aria-label={`Request Neighborhood Expert for ${neighborhood.neighborhood}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Verification and Refund Notice */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <p className="text-sm text-blue-800">
            All Neighborhood Expert requests are verified.  If we cannot verify your expertise or the position is unavailable, you will not be charged and any payment will be refunded.
          </p>
        </div>
      </div>

      {/* Sticky Bottom CTAs */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Summary */}
          {requestedNeighborhoods.size > 0 && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {requestedNeighborhoods.size} neighborhood{requestedNeighborhoods.size !== 1 ? 's' : ''} requested
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {formatPrice(calculateTotal())}
                  </span>
                  <span className="text-slate-500 text-sm">
                    /{billingCycle === 'annual' ? 'yr' : 'mo'}
                  </span>
                  {billingCycle === 'annual' && (
                    <span className="text-xs text-green-600">(2 months free)</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cancel anytime.
              </p>
            </div>
          )}
          
          {/* Buttons */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handleSkip}
              className="px-6 py-3 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
            >
              Skip neighborhood expert selection
            </button>
            
            <button
              onClick={handleContinue}
              className="px-8 py-3 rounded-xl font-semibold text-white bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
