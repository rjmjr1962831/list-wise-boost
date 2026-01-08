import { Check, MapPin, FileText, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

type Step = 'setup' | 'review' | 'payment';

interface CoverageProgressProps {
  current: Step;
  labels?: {
    setup?: string;
    review?: string;
    payment?: string;
  };
}

const steps: { key: Step; icon: React.ElementType; defaultLabel: string }[] = [
  { key: 'setup', icon: MapPin, defaultLabel: 'Edit Coverage' },
  { key: 'review', icon: FileText, defaultLabel: 'Review' },
  { key: 'payment', icon: CreditCard, defaultLabel: 'Payment' },
];

export function CoverageProgress({ current, labels = {} }: CoverageProgressProps) {
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className="w-full">
      {/* Desktop */}
      <div className="hidden sm:flex items-center justify-center gap-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;
          const label = labels[step.key] || step.defaultLabel;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2',
                    isFuture && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent && 'text-foreground',
                    isFuture && 'text-muted-foreground',
                    isCompleted && 'text-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-12 h-0.5 mx-4',
                    index < currentIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: icons only with current step label */}
      <div className="flex sm:hidden flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          {steps.map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isFuture = index > currentIndex;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2',
                    isFuture && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5 ml-2',
                      index < currentIndex ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <span className="text-sm font-medium text-foreground">
          {labels[current] || steps.find((s) => s.key === current)?.defaultLabel}
        </span>
      </div>
    </div>
  );
}
