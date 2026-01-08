// src/pages/profile/SelectNeighborhoods.tsx
// New neighborhood-based selection page (replaces SelectCities.tsx)

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const navigate = useNavigate();
  
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodCatalogItem[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<NeighborhoodCatalogItem[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [freeNeighborhood, setFreeNeighborhood] = useState<NeighborhoodCatalogItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadNeighborhoods();
  }, []);

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
    // If clicking on the current free neighborhood, deselect it
    if (freeNeighborhood?.id === neighborhood.id) {
      setFreeNeighborhood(null);
      return;
    }
    
    // If clicking on a selected paid neighborhood, deselect it
    if (selectedNeighborhoods.find(n => n.id === neighborhood.id)) {
      setSelectedNeighborhoods(selectedNeighborhoods.filter(n => n.id !== neighborhood.id));
      return;
    }
    
    // First selection is free
    if (!freeNeighborhood) {
      setFreeNeighborhood(neighborhood);
      return;
    }
    
    // Add to paid selections
    setSelectedNeighborhoods([...selectedNeighborhoods, neighborhood]);
  };

  const getPrice = (tier: NeighborhoodTier) => {
    const monthly = NEIGHBORHOOD_TIER_PRICES[tier];
    return billingCycle === 'annual' ? getAnnualPrice(monthly) : monthly;
  };

  const calculateTotal = () => {
    return selectedNeighborhoods.reduce((sum, n) => {
      return sum + getPrice(n.tier);
    }, 0);
  };

  // Get unique cities for filter
  const uniqueCities = [...new Set(neighborhoods.map(n => n.city_area))].sort();

  // Filter neighborhoods
  const filteredNeighborhoods = neighborhoods.filter(n => {
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
                <span className="text-xs text-green-600 font-semibold">Save 17%</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Select Your Neighborhoods</h1>
          <p className="text-slate-600">
            Your first neighborhood is <span className="font-semibold text-green-600">FREE</span>. 
            Add more to expand your reach.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Cities are free — pay only for neighborhood specialization
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search neighborhoods or cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Free Neighborhood Prompt or Selection */}
        {!freeNeighborhood ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-900">Your Free Neighborhood</h2>
                <p className="text-green-700">Select your primary neighborhood below — it's on us!</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-green-900">{freeNeighborhood.neighborhood}</p>
                  <p className="text-sm text-green-700">{freeNeighborhood.city_area} · Your FREE neighborhood</p>
                </div>
              </div>
              <button 
                onClick={() => setFreeNeighborhood(null)}
                className="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                Change
              </button>
            </div>
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
          const displayPrice = billingCycle === 'annual' ? getAnnualPrice(price) : price;
          
          return (
            <div key={tierName} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">{tierName}</h2>
                <span className={`text-sm ${styles.color}`}>
                  {formatPrice(displayPrice)}
                  /{billingCycle === 'annual' ? 'year' : 'month'}
                </span>
                <span className="text-sm text-slate-400">
                  · {tierNeighborhoods.length} {tierNeighborhoods.length === 1 ? 'neighborhood' : 'neighborhoods'}
                </span>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tierNeighborhoods.slice(0, 30).map(neighborhood => {
                  const isFreeSelected = freeNeighborhood?.id === neighborhood.id;
                  const isPaidSelected = selectedNeighborhoods.some(n => n.id === neighborhood.id);
                  const priceDisplay = billingCycle === 'annual' ? getAnnualPrice(NEIGHBORHOOD_TIER_PRICES[neighborhood.tier]) : NEIGHBORHOOD_TIER_PRICES[neighborhood.tier];
                  
                  return (
                    <div
                      key={neighborhood.id}
                      onClick={() => handleNeighborhoodSelect(neighborhood)}
                      className={`
                        relative rounded-2xl border-2 p-6 transition-all cursor-pointer hover:shadow-lg
                        ${styles.bg} ${styles.border}
                        ${isFreeSelected ? 'ring-2 ring-green-500 ring-offset-2' : ''}
                        ${isPaidSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                      `}
                    >
                      {/* Free badge */}
                      {isFreeSelected && (
                        <div className="absolute -top-3 -right-3">
                          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            FREE
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
                      {!isFreeSelected ? (
                        <div className="mb-3">
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold ${styles.text}`}>
                              {formatPrice(priceDisplay)}
                            </span>
                            <span className="text-slate-500 text-sm">
                              /{billingCycle === 'annual' ? 'yr' : 'mo'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-3">
                          <span className="text-2xl font-bold text-green-600">FREE</span>
                        </div>
                      )}
                      
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
                      {(isFreeSelected || isPaidSelected) && (
                        <div className={`mt-3 flex items-center gap-2 ${isFreeSelected ? 'text-green-600' : 'text-blue-600'}`}>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">
                            {isFreeSelected ? 'Your Free Neighborhood' : 'Selected'}
                          </span>
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
                {freeNeighborhood && (
                  <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    1 free neighborhood
                  </span>
                )}
                {selectedNeighborhoods.length > 0 && (
                  <span className="text-sm text-slate-600">
                    + {selectedNeighborhoods.length} paid {selectedNeighborhoods.length === 1 ? 'neighborhood' : 'neighborhoods'}
                  </span>
                )}
                {!freeNeighborhood && selectedNeighborhoods.length === 0 && (
                  <span className="text-sm text-slate-400">Select a neighborhood to get started</span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                {selectedNeighborhoods.length === 0 ? (
                  <span className="text-2xl font-bold text-green-600">
                    {freeNeighborhood ? 'FREE' : '$0'}
                  </span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-slate-900">
                      {formatPrice(calculateTotal())}
                    </span>
                    <span className="text-slate-500 text-sm">
                      /{billingCycle === 'annual' ? 'year' : 'month'}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <button
              onClick={() => {
                // TODO: Navigate to checkout with selections
                console.log('Checkout with:', { freeNeighborhood, selectedNeighborhoods, billingCycle });
                navigate(`/profile/${token}/checkout`);
              }}
              disabled={!freeNeighborhood && selectedNeighborhoods.length === 0}
              className={`
                px-8 py-3 rounded-xl font-semibold text-white transition-all
                ${freeNeighborhood || selectedNeighborhoods.length > 0
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
