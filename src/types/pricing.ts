// src/types/pricing.ts

export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface CityPricing {
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

export interface PricingTier {
  value: number;
  name: TierName;
  priceMonthly: number;
  priceAnnual: number;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  description: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    value: 5,
    name: 'Platinum',
    priceMonthly: 499,
    priceAnnual: 4990,
    color: 'text-purple-600',
    bgColor: 'bg-gradient-to-br from-purple-50 to-indigo-50',
    borderColor: 'border-purple-300',
    badgeColor: 'bg-purple-600 text-white',
    description: 'Premium markets with highest buyer demand'
  },
  {
    value: 4,
    name: 'Gold',
    priceMonthly: 249,
    priceAnnual: 2490,
    color: 'text-amber-600',
    bgColor: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    borderColor: 'border-amber-300',
    badgeColor: 'bg-amber-500 text-white',
    description: 'Strong markets with high activity'
  },
  {
    value: 3,
    name: 'Silver',
    priceMonthly: 99,
    priceAnnual: 990,
    color: 'text-slate-600',
    bgColor: 'bg-gradient-to-br from-slate-50 to-gray-100',
    borderColor: 'border-slate-300',
    badgeColor: 'bg-slate-500 text-white',
    description: 'Moderate markets with steady demand'
  },
  {
    value: 2,
    name: 'Bronze',
    priceMonthly: 29,
    priceAnnual: 290,
    color: 'text-orange-700',
    bgColor: 'bg-gradient-to-br from-orange-50 to-amber-50',
    borderColor: 'border-orange-300',
    badgeColor: 'bg-orange-600 text-white',
    description: 'Developing markets, great value'
  }
];

export function getTierByName(name: TierName): PricingTier | undefined {
  return PRICING_TIERS.find(t => t.name === name);
}

export function getTierByValue(value: number): PricingTier {
  if (value >= 5) return PRICING_TIERS[0]; // Platinum
  if (value >= 4) return PRICING_TIERS[1]; // Gold
  if (value >= 3) return PRICING_TIERS[2]; // Silver
  return PRICING_TIERS[3]; // Bronze
}

export function formatPrice(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function getAnnualSavings(monthly: number, annual: number): number {
  return (monthly * 12) - annual;
}

export function getAnnualSavingsPercent(monthly: number, annual: number): number {
  const fullPrice = monthly * 12;
  return Math.round(((fullPrice - annual) / fullPrice) * 100);
}
