import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VerifiedFieldRowProps {
  label: string;
  value: string | null | undefined;
  onRequestCorrection: () => void;
  isLink?: boolean;
  source?: string;
  note?: string;
}

export function VerifiedFieldRow({ 
  label, 
  value, 
  onRequestCorrection,
  isLink = false,
  source,
  note
}: VerifiedFieldRowProps) {
  const displayValue = value || 'Not listed';
  const hasValue = !!value;

  return (
    <div className="flex items-start justify-between py-4 border-b border-border last:border-b-0">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {isLink && hasValue ? (
            <a 
              href={value.startsWith('http') ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base text-primary hover:underline break-all"
            >
              {value}
            </a>
          ) : (
            <p className={`text-base ${hasValue ? 'text-foreground' : 'text-muted-foreground italic'}`}>
              {displayValue}
            </p>
          )}
          {source && (
            <p className="text-xs text-muted-foreground mt-1">Source: {source}</p>
          )}
          {note && (
            <p className="text-xs text-muted-foreground italic mt-0.5">{note}</p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRequestCorrection}
        className="text-muted-foreground hover:text-foreground ml-4 flex-shrink-0"
      >
        Request correction
      </Button>
    </div>
  );
}
