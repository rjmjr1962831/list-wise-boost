// src/pages/profile/SelectNeighborhoods.tsx
// New neighborhood-based selection page (replaces SelectCities.tsx)

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  NeighborhoodTier, 
  NeighborhoodCatalogItem,
  NEIGHBORHOOD_TIER_PRICES,
  NEIGHBORHOOD_TIER_STYLES,
  getAnnualPrice 
} from '@/types/neighborhoodPricing';

// ============================================
// COMPONENT
// ============================================
export default function SelectNeighborhoods() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Check for preselect param (from neighborhood apply flow)
  const preselectSlug = searchParams.get('preselect');
  
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodCatalogItem[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<NeighborhoodCatalogItem[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [preselectApplied, setPreselectApplied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadNeighborhoods();
  }, []);

  // Handle preselect when neighborhoods are loaded
  useEffect(() => {
    if (preselectSlug && neighborhoods.length > 0 && !preselectApplied) {
      const preselected = neighborhoods.find(
        n => n.neighborhood_slug === preselectSlug
      );
      if (preselected && !selectedNeighborhoods.some(n => n.id === preselected.id)) {
        setSelectedNeighborhoods([preselected]);
        setPreselectApplied(true);
      }
    }
  }, [preselectSlug, neighborhoods, preselectApplied, selectedNeighborhoods]);

  const loadNeighborhoods = async () => {
    const { data, error } = await supabase
      .from('neighborhood_catalog')
      .select('*')
      .eq('is_active', true)
      .order('score', { ascending: false });
    
    if (data) {
      setNeighborhoods(data as NeighborhoodCatalogItem[]);
    }
    setLoading(false);
  };

  const handleNeighborhoodSelect = (neighborhood: NeighborhoodCatalogItem) => {
    // If clicking on a selected neighborhood, deselect it
    if (selectedNeighborhoods.find(n => n.id === neighborhood.id)) {
      setSelectedNeighborhoods(selectedNeighborhoods.filter(n => n.id !== neighborhood.id));
      return;
    }
    
    // Add to selections
    setSelectedNeighborhoods([...selectedNeighborhoods, neighborhood]);
  };

  // Annual = 10 months (2 months free)
  const getAnnualPriceWithDiscount = (monthly: number) => monthly * 10;

  const getPrice = (tier: NeighborhoodTier) => {
    const monthly = NEIGHBORHOOD_TIER_PRICES[tier];
    return billingCycle === 'annual' ? getAnnualPriceWithDiscount(monthly) : monthly;
  };

  const calculateTotal = () => {
    return selectedNeighborhoods.reduce((sum, n) => {
      return sum + getPrice(n.tier);
    }, 0);
  };

  // Get unique cities for filter
  const uniqueCities = [...new Set(neighborhoods.map(n => n.city_area))].sort();

  // Filter neighborhoods - if preselect is set, only show that one neighborhood
  const filteredNeighborhoods = preselectSlug 
    ? neighborhoods.filter(n => n.neighborhood_slug === preselectSlug)
    : neighborhoods.filter(n => {
        const matchesTier = filterTier === 'all' || n.tier === filterTier;
        const matchesCity = filterCity === 'all' || n.city_area === filterCity;
        const matchesSearch = searchQuery === '' || 
          n.neighborhood.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.city_area.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTier && matchesCity && matchesSearch;
      });

  // Group by tier
  const groupedNeighborhoods = {
    Luxury: filteredNeighborhoods.filter(n => n.tier === 'Luxury'),
    Prime: filteredNeighborhoods.filter(n => n.tier === 'Prime'),
    Main: filteredNeighborhoods.filter(n => n.tier === 'Main')
  };

  const formatPrice = (amount: number) => `$${amount.toLocaleString()}`;

  const tierOrder: NeighborhoodTier[] = ['Luxury', 'Prime', 'Main'];

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">10</span>
              </div>
              <span className="text-xl font-bold text-slate-900">
                Top<span className="text-blue-500">10</span>Lists
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

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {preselectSlug ? 'Become a Neighborhood Expert' : 'Select Your Neighborhoods'}
          </h1>
          {preselectSlug && selectedNeighborhoods.length > 0 ? (
            <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 mb-4 inline-block">
              <p className="text-primary font-medium">
                ✓ Pre-selected: {selectedNeighborhoods[0].neighborhood}, {selectedNeighborhoods[0].city_area}
              </p>
            </div>
          ) : null}
          <p className="text-slate-600">
            Select neighborhoods where you want to be featured as a Neighborhood Expert.
          </p>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl mx-auto">
            Neighborhood Expert pricing reflects the work and risk required to stand behind neighborhood-specific recommendations. Selection and ranking cannot be purchased.
          </p>
        </div>

        {/* Search - only show if not preselecting a specific neighborhood */}
        {!preselectSlug && (
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search neighborhoods or cities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Tier filters */}
          <button
            onClick={() => setFilterTier('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filterTier === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Tiers ({neighborhoods.length})
          </button>
          {tierOrder.map(tier => {
            const count = neighborhoods.filter(n => n.tier === tier).length;
            const price = NEIGHBORHOOD_TIER_PRICES[tier];
            return (
              <button
                key={tier}
                onClick={() => setFilterTier(tier)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filterTier === tier
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tier} ({count}) · ${price}/mo
              </button>
            );
          })}
        </div>

        {/* City filter dropdown */}
        <div className="mb-6">
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="all">All Cities ({uniqueCities.length})</option>
            {uniqueCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        {/* Neighborhood Grid by Tier */}
        {tierOrder.map(tierName => {
          const tierNeighborhoods = groupedNeighborhoods[tierName];
          if (tierNeighborhoods.length === 0) return null;
          
          const styles = NEIGHBORHOOD_TIER_STYLES[tierName];
          const price = NEIGHBORHOOD_TIER_PRICES[tierName];
          const displayPrice = price;
          
          return (
            <div key={tierName} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">{tierName}</h2>
                <span className={`text-sm ${styles.color}`}>
                  {formatPrice(displayPrice)}/mo
                </span>
                <span className="text-sm text-slate-400">
                  · {tierNeighborhoods.length} {tierNeighborhoods.length === 1 ? 'neighborhood' : 'neighborhoods'}
                </span>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tierNeighborhoods.slice(0, 30).map(neighborhood => {
                  const isSelected = selectedNeighborhoods.some(n => n.id === neighborhood.id);
                  const monthlyPrice = NEIGHBORHOOD_TIER_PRICES[neighborhood.tier];
                  const priceDisplay = billingCycle === 'annual' 
                    ? getAnnualPriceWithDiscount(monthlyPrice) 
                    : monthlyPrice;
                  
                  return (
                    <div
                      key={neighborhood.id}
                      onClick={() => handleNeighborhoodSelect(neighborhood)}
                      className={`
                        relative rounded-2xl border-2 p-6 transition-all cursor-pointer hover:shadow-lg
                        ${styles.bg} ${styles.border}
                        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                      `}
                    >
                      {/* Selected badge */}
                      {isSelected && (
                        <div className="absolute -top-3 -right-3">
                          <span className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            SELECTED
                          </span>
                        </div>
                      )}
                      
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{neighborhood.neighborhood}</h3>
                          <p className="text-sm text-slate-600">{neighborhood.city_area}, {neighborhood.state}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles.badge}`}>
                          {neighborhood.tier}
                        </span>
                      </div>
                      
                      {/* Pricing */}
                      <div className="mb-3">
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-bold ${styles.text}`}>
                            {formatPrice(priceDisplay)}
                          </span>
                          <span className="text-slate-500 text-sm">
                            /{billingCycle === 'annual' ? 'yr' : 'mo'}
                          </span>
                        </div>
                        {billingCycle === 'annual' && (
                          <p className="text-xs text-green-600 mt-1">2 months free</p>
                        )}
                      </div>
                      
                      {/* Zip Codes */}
                      {neighborhood.zips && neighborhood.zips.length > 0 && (
                        <div className="pt-3 border-t border-slate-200/50">
                          <p className="text-xs text-slate-500 mb-1">
                            {neighborhood.zips.length} ZIP code{neighborhood.zips.length > 1 ? 's' : ''}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {neighborhood.zips.slice(0, 3).map(zip => (
                              <span key={zip} className="text-xs bg-white/60 px-1.5 py-0.5 rounded text-slate-500">
                                {zip}
                              </span>
                            ))}
                            {neighborhood.zips.length > 3 && (
                              <span className="text-xs text-slate-400">
                                +{neighborhood.zips.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="mt-3 flex items-center gap-2 text-blue-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Selected</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {tierNeighborhoods.length > 30 && (
                <p className="text-sm text-slate-500 mt-4 text-center">
                  Showing 30 of {tierNeighborhoods.length} neighborhoods. Use search to find specific areas.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Cart */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-1">
                {selectedNeighborhoods.length > 0 ? (
                  <span className="text-sm text-slate-600">
                    {selectedNeighborhoods.length} {selectedNeighborhoods.length === 1 ? 'neighborhood' : 'neighborhoods'} selected
                  </span>
                ) : (
                  <span className="text-sm text-slate-400">Select a neighborhood to get started</span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                {selectedNeighborhoods.length === 0 ? (
                  <span className="text-2xl font-bold text-slate-400">$0</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-slate-900">
                      {formatPrice(calculateTotal())}
                    </span>
                    <span className="text-slate-500 text-sm">
                      /{billingCycle === 'annual' ? 'yr' : 'mo'}
                    </span>
                    {billingCycle === 'annual' && (
                      <span className="text-xs text-green-600 ml-1">(2 months free)</span>
                    )}
                  </>
                )}
              </div>
            </div>
            
            <button
              onClick={() => {
                console.log('Checkout with:', { selectedNeighborhoods, billingCycle });
                navigate(`/profile/${token}/checkout`);
              }}
              disabled={selectedNeighborhoods.length === 0}
              className={`
                px-8 py-3 rounded-xl font-semibold text-white transition-all
                ${selectedNeighborhoods.length > 0
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
                  : 'bg-slate-300 cursor-not-allowed'
                }
              `}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
