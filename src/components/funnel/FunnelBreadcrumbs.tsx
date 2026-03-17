import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

const STEPS = [
  { step: 1, label: 'Intro', segment: '' },
  { step: 2, label: 'Basic Info', segment: 'review-1' },
  { step: 3, label: 'Credentials', segment: 'review-credentials' },
  { step: 4, label: 'Details', segment: 'review-2' },
  { step: 5, label: 'Final Review', segment: 'review-final' },
  { step: 6, label: 'Cities', segment: 'cities' },
  { step: 7, label: 'Neighborhoods', segment: 'neighborhoods' },
  { step: 8, label: 'Pricing', segment: 'pricing' },
];

interface FunnelBreadcrumbsProps {
  currentStep: number;
}

export function FunnelBreadcrumbs({ currentStep }: FunnelBreadcrumbsProps) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="flex items-center gap-1 min-w-max">
        {STEPS.map((s, i) => {
          const isCompleted = s.step < currentStep;
          const isCurrent = s.step === currentStep;
          const isFuture = s.step > currentStep;
          const path = s.segment ? `/funnel/${token}/${s.segment}` : `/funnel/${token}`;

          return (
            <div key={s.step} className="flex items-center">
              {i > 0 && (
                <div className={`w-4 h-px mx-0.5 ${isCompleted ? 'bg-primary' : 'bg-border'}`} />
              )}
              <button
                onClick={() => isCompleted && navigate(path)}
                disabled={isFuture || isCurrent}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                      ? 'text-primary hover:bg-primary/10 cursor-pointer'
                      : 'text-muted-foreground/50 cursor-default'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                ) : (
                  <span className={`flex items-center justify-center h-3.5 w-3.5 rounded-full text-[9px] font-black shrink-0 ${
                    isCurrent
                      ? 'bg-primary-foreground text-primary'
                      : 'border border-muted-foreground/30 text-muted-foreground/50'
                  }`}>
                    {s.step}
                  </span>
                )}
                {s.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
