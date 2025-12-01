// src/components/CityPricingCard.tsx

import React from 'react';

// Types (inline for standalone use - can import from pricing.ts)
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

interface CityPricingCardProps {
  city: CityPricing;
  billingCycle?: 'monthly' | 'annual';
  isSelected?: boolean;
  isFreeCity?: boolean;
  onSelect?: (city: CityPricing) => void;
  showZipCodes?: boolean;
}

const tierStyles = {
  Platinum: {
    border: 'border-purple-300',
    bg: 'bg-gradient-to-br from-purple-50 to-indigo-50',
    badge: 'bg-purple-600 text-white',
    text: 'text-purple-700',
    ring: 'ring-purple-500'
  },
  Gold: {
    border: 'border-amber-300',
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    badge: 'bg-amber-500 text-white',
    text: 'text-amber-700',
    ring: 'ring-amber-500'
  },
  Silver: {
    border: 'border-slate-300',
    bg: 'bg-gradient-to-br from-slate-50 to-gray-100',
    badge: 'bg-slate-500 text-white',
    text: 'text-slate-700',
    ring: 'ring-slate-500'
  },
  Bronze: {
    border: 'border-orange-300',
    bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
    badge: 'bg-orange-600 text-white',
    text: 'text-orange-700',
    ring: 'ring-orange-500'
  }
};

export default function CityPricingCard({ 
  city, 
  billingCycle = 'annual',
  isSelected = false, 
  isFreeCity = false,
  onSelect,
  showZipCodes = false 
}: CityPricingCardProps) {
  const styles = tierStyles[city.tier_name];
  const price = billingCycle === 'annual' ? city.price_annual : city.price_monthly;
  
  return (
    <div 
      className={`
        rounded-2xl border-2 p-6 transition-all cursor-pointer hover:shadow-lg
        ${styles.bg} ${styles.border}
        ${isSelected ? `ring-2 ${styles.ring} ring-offset-2` : ''}
        ${isFreeCity ? 'ring-2 ring-green-500 ring-offset-2' : ''}
      `}
      onClick={() => onSelect?.(city)}
    >
      {/* Free badge */}
      {isFreeCity && (
        <div className="absolute -top-3 -right-3">
          <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            FREE
          </span>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">{city.city_name}</h3>
          <p className="text-sm text-slate-500">{city.state}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles.badge}`}>
          {city.tier_name}
        </span>
      </div>
      
      {/* Description */}
      {city.description && (
        <p className="text-sm text-slate-600 mb-4">{city.description}</p>
      )}
      
      {/* Pricing */}
      {!isFreeCity && (
        <div className="space-y-2 mb-4">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${styles.text}`}>
              ${price.toLocaleString()}
            </span>
            <span className="text-slate-500">
              /{billingCycle === 'annual' ? 'year' : 'month'}
            </span>
          </div>
          {billingCycle === 'annual' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                ${city.price_monthly}/mo billed annually
              </span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                Save 2 months
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Free city pricing */}
      {isFreeCity && (
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-600">FREE</span>
          </div>
          <p className="text-sm text-green-600">Your first city is on us!</p>
        </div>
      )}
      
      {/* Zip Codes */}
      {showZipCodes && city.zip_codes.length > 0 && (
        <div className="pt-4 border-t border-slate-200/50">
          <p className="text-xs font-medium text-slate-500 mb-2">
            Includes {city.zip_codes.length} ZIP code{city.zip_codes.length > 1 ? 's' : ''}:
          </p>
          <div className="flex flex-wrap gap-1">
            {city.zip_codes.slice(0, 6).map(zip => (
              <span key={zip} className="text-xs bg-white/60 px-2 py-0.5 rounded text-slate-600">
                {zip}
              </span>
            ))}
            {city.zip_codes.length > 6 && (
              <span className="text-xs text-slate-400">
                +{city.zip_codes.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Selection indicator */}
      {(isSelected || isFreeCity) && (
        <div className={`mt-4 flex items-center gap-2 ${isFreeCity ? 'text-green-600' : 'text-blue-600'}`}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">
            {isFreeCity ? 'Your Free City' : 'Selected'}
          </span>
        </div>
      )}
    </div>
  );
}
