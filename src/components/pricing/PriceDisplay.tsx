import { cn } from '@/lib/utils';

interface PriceDisplayProps {
  retailPrice: number;
  earlyAdopterPrice: number;
  showMonthly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PriceDisplay({ 
  retailPrice, 
  earlyAdopterPrice, 
  showMonthly = true,
  size = 'md',
  className 
}: PriceDisplayProps) {
  const sizeClasses = {
    sm: { retail: 'text-sm', price: 'text-lg', suffix: 'text-xs' },
    md: { retail: 'text-base', price: 'text-2xl', suffix: 'text-sm' },
    lg: { retail: 'text-lg', price: 'text-4xl', suffix: 'text-base' },
  };

  const classes = sizeClasses[size];

  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className={cn('line-through text-destructive/70', classes.retail)}>
        ${retailPrice}
      </span>
      <span className={cn('font-bold text-primary', classes.price)}>
        ${earlyAdopterPrice}
      </span>
      {showMonthly && (
        <span className={cn('text-muted-foreground', classes.suffix)}>/mo</span>
      )}
    </div>
  );
}
