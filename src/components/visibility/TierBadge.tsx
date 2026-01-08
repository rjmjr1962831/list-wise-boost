import { cn } from '@/lib/utils';

export type NeighborhoodTier = 'Main' | 'Prime' | 'Luxury';

interface TierBadgeProps {
  tier: NeighborhoodTier;
  showPrice?: boolean;
  size?: 'sm' | 'md';
}

const tierConfig: Record<NeighborhoodTier, { bg: string; text: string; price: number }> = {
  Main: { bg: 'bg-blue-500', text: 'text-white', price: 39 },
  Prime: { bg: 'bg-purple-500', text: 'text-white', price: 69 },
  Luxury: { bg: 'bg-amber-500', text: 'text-black', price: 99 },
};

export function TierBadge({ tier, showPrice = false, size = 'sm' }: TierBadgeProps) {
  const config = tierConfig[tier];
  
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        config.bg,
        config.text,
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
      )}
    >
      {tier}
      {showPrice && <span className="ml-1">${config.price}</span>}
    </span>
  );
}

export function getTierPrice(tier: NeighborhoodTier): number {
  return tierConfig[tier].price;
}
