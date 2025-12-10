// src/pages/SelectCities.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================
type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

interface CityPricing {
  id: string;
  city_name: string;
  city_slug: string;
  state: string;
  state_abbr: string;
  value_tier: number;
  tier_name: TierName;
  price_monthly: number;
  price_annual: number;
  zip_codes: string[];
  description: string | null;
  is_active: boolean;
  display_order: number;
}

interface PricingTier {
  name: TierName;
  priceMonthly: number;
  priceAnnual: number;
  color: string;
}

const PRICING_TIERS: PricingTier[] = [
  { name: 'Platinum', priceMonthly: 499, priceAnnual: 4990, color: 'text-purple-600' },
  { name: 'Gold', priceMonthly: 249, priceAnnual: 2490, color: 'text-amber-600' },
  { name: 'Silver', priceMonthly: 99, priceAnnual: 990, color: 'text-slate-600' },
  { name: 'Bronze', priceMonthly: 29, priceAnnual: 290, color: 'text-orange-600' }
];

// ============================================
// TIER STYLES
// ============================================
const tierStyles = {
  Platinum: {
    border: 'border-purple-300',
    bg: 'bg-gradient-to-br from-purple-50 to-indigo-50',
    badge: 'bg-purple-600 text-white',
    text: 'text-purple-700'
  },
  Gold: {
    border: 'border-amber-300',
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    badge: 'bg-amber-500 text-white',
    text: 'text-amber-700'
  },
  Silver: {
    border: 'border-slate-300',
    bg: 'bg-gradient-to-br from-slate-50 to-gray-100',
    badge: 'bg-slate-500 text-white',
    text: 'text-slate-700'
  },
  Bronze: {
    border: 'border-orange-300',
    bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
    badge: 'bg-orange-600 text-white',
    text: 'text-orange-700'
  }
};

// ============================================
// COMPONENT
// ============================================
export default function SelectCities() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [cities, setCities] = useState<CityPricing[]>([]);
  const [selectedCities, setSelectedCities] = useState<CityPricing[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [freeCity, setFreeCity] = useState<CityPricing | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    loadCities();
  }, []);

  const loadCities = async () => {
    const { data, error } = await supabase
      .from('arizona_city_pricing')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    
    if (data) {
      setCities(data as CityPricing[]);
    }
    setLoading(false);
  };

  const handleCitySelect = (city: CityPricing) => {
    // If clicking on the current free city, deselect it
    if (freeCity?.id === city.id) {
      setFreeCity(null);
      return;
    }
    
    // If clicking on a selected paid city, deselect it
    if (selectedCities.find(c => c.id === city.id)) {
      setSelectedCities(selectedCities.filter(c => c.id !== city.id));
      return;
    }
    
    // First selection is free
    if (!freeCity) {
      setFreeCity(city);
      return;
    }
    
    // Add to paid selections
    setSelectedCities([...selectedCities, city]);
  };

  const calculateTotal = () => {
    return selectedCities.reduce((sum, city) => {
      return sum + (billingCycle === 'annual' ? city.price_annual : city.price_monthly);
    }, 0);
  };

  const filteredCities = cities.filter(city => {
    if (filterTier === 'all') return true;
    return city.tier_name === filterTier;
  });

  const groupedCities = {
    Platinum: filteredCities.filter(c => c.tier_name === 'Platinum'),
    Gold: filteredCities.filter(c => c.tier_name === 'Gold'),
    Silver: filteredCities.filter(c => c.tier_name === 'Silver'),
    Bronze: filteredCities.filter(c => c.tier_name === 'Bronze')
  };

  const formatPrice = (amount: number) => `$${amount.toLocaleString()}`;

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
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Select Your Cities</h1>
          <p className="text-slate-600">
            Your first city is <span className="font-semibold text-green-600">FREE</span>. 
            Add more cities to expand your reach.
          </p>
        </div>

        {/* Free City Prompt or Selection */}
        {!freeCity ? (
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-900">Your Free City</h2>
                <p className="text-green-700">Select your primary market below — it's on us!</p>
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
                  <p className="font-bold text-green-900">{freeCity.city_name}</p>
                  <p className="text-sm text-green-700">Your FREE city listing</p>
                </div>
              </div>
              <button 
                onClick={() => setFreeCity(null)}
                className="text-green-600 hover:text-green-800 text-sm font-medium"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterTier('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filterTier === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Cities ({cities.length})
          </button>
          {PRICING_TIERS.map(tier => {
            const count = cities.filter(c => c.tier_name === tier.name).length;
            return (
              <button
                key={tier.name}
                onClick={() => setFilterTier(tier.name)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filterTier === tier.name
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tier.name} ({count}) · {formatPrice(billingCycle === 'annual' ? tier.priceAnnual : tier.priceMonthly)}
              </button>
            );
          })}
        </div>

        {/* City Grid by Tier */}
        {Object.entries(groupedCities).map(([tierName, tierCities]) => {
          if (tierCities.length === 0) return null;
          
          const tier = PRICING_TIERS.find(t => t.name === tierName);
          const styles = tierStyles[tierName as TierName];
          
          return (
            <div key={tierName} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-xl font-bold text-slate-900">{tierName}</h2>
                <span className={`text-sm ${tier?.color}`}>
                  {formatPrice(billingCycle === 'annual' ? tier?.priceAnnual || 0 : tier?.priceMonthly || 0)}
                  /{billingCycle === 'annual' ? 'year' : 'month'}
                </span>
                <span className="text-sm text-slate-400">
                  · {tierCities.length} {tierCities.length === 1 ? 'city' : 'cities'}
                </span>
              </div>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tierCities.map(city => {
                  const isFreeCitySelected = freeCity?.id === city.id;
                  const isPaidSelected = selectedCities.some(c => c.id === city.id);
                  const price = billingCycle === 'annual' ? city.price_annual : city.price_monthly;
                  
                  return (
                    <div
                      key={city.id}
                      onClick={() => handleCitySelect(city)}
                      className={`
                        relative rounded-2xl border-2 p-6 transition-all cursor-pointer hover:shadow-lg
                        ${styles.bg} ${styles.border}
                        ${isFreeCitySelected ? 'ring-2 ring-green-500 ring-offset-2' : ''}
                        ${isPaidSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                      `}
                    >
                      {/* Free badge */}
                      {isFreeCitySelected && (
                        <div className="absolute -top-3 -right-3">
                          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            FREE
                          </span>
                        </div>
                      )}
                      
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{city.city_name}</h3>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles.badge}`}>
                          {city.tier_name}
                        </span>
                      </div>
                      
                      {/* Description */}
                      {city.description && (
                        <p className="text-sm text-slate-600 mb-3">{city.description}</p>
                      )}
                      
                      {/* Pricing */}
                      {!isFreeCitySelected ? (
                        <div className="mb-3">
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold ${styles.text}`}>
                              {formatPrice(price)}
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
                      <div className="pt-3 border-t border-slate-200/50">
                        <p className="text-xs text-slate-500 mb-1">
                          {city.zip_codes.length} ZIP code{city.zip_codes.length > 1 ? 's' : ''} included
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {city.zip_codes.slice(0, 4).map(zip => (
                            <span key={zip} className="text-xs bg-white/60 px-1.5 py-0.5 rounded text-slate-500">
                              {zip}
                            </span>
                          ))}
                          {city.zip_codes.length > 4 && (
                            <span className="text-xs text-slate-400">
                              +{city.zip_codes.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Selection indicator */}
                      {(isFreeCitySelected || isPaidSelected) && (
                        <div className={`mt-3 flex items-center gap-2 ${isFreeCitySelected ? 'text-green-600' : 'text-blue-600'}`}>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">
                            {isFreeCitySelected ? 'Your Free City' : 'Selected'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
                {freeCity && (
                  <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    1 free city
                  </span>
                )}
                {selectedCities.length > 0 && (
                  <span className="text-sm text-slate-600">
                    + {selectedCities.length} paid {selectedCities.length === 1 ? 'city' : 'cities'}
                  </span>
                )}
                {!freeCity && selectedCities.length === 0 && (
                  <span className="text-sm text-slate-400">Select a city to get started</span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                {selectedCities.length === 0 ? (
                  <span className="text-2xl font-bold text-green-600">
                    {freeCity ? 'FREE' : '$0'}
                  </span>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-slate-900">
                      {formatPrice(calculateTotal())}
                    </span>
                    <span className="text-sm text-slate-500">
                      /{billingCycle === 'annual' ? 'year' : 'month'}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <button
              onClick={() => {
                // Navigate to checkout or next step
                if (token) {
                  navigate(`/profile/${token}/checkout`, {
                    state: {
                      freeCity,
                      selectedCities,
                      billingCycle,
                      total: calculateTotal()
                    }
                  });
                }
              }}
              disabled={!freeCity}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {freeCity ? 'Continue' : 'Select a City'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
