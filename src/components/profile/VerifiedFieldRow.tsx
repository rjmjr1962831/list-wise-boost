import { useState } from 'react';
import { CheckCircle2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface VerifiedFieldRowProps {
  label: string;
  value: string | null | undefined;
  onRequestCorrection: () => void;
  isLink?: boolean;
  source?: string;
  note?: string;
  editable?: boolean;
  onSave?: (newValue: string) => Promise<void>;
}

export function VerifiedFieldRow({ 
  label, 
  value, 
  onRequestCorrection,
  isLink = false,
  source,
  note,
  editable = false,
  onSave
}: VerifiedFieldRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [currentSource, setCurrentSource] = useState(source);

  const displayValue = value || 'Not listed';
  const hasValue = !!value;

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(editValue);
      setCurrentSource('Self Reported');
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  return (
    <div className="flex items-start justify-between py-4 border-b border-border last:border-b-0">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-8 text-base"
                placeholder="Enter value..."
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-8 w-8 p-0 text-primary hover:text-primary/80"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={saving}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : isLink && hasValue ? (
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
          {currentSource && !isEditing && (
            <p className="text-xs text-muted-foreground mt-1">Source: {currentSource}</p>
          )}
          {note && !isEditing && (
            <p className="text-xs text-muted-foreground italic mt-0.5">{note}</p>
          )}
        </div>
      </div>
      {editable ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="text-muted-foreground hover:text-foreground ml-4 flex-shrink-0"
          disabled={isEditing}
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRequestCorrection}
          className="text-muted-foreground hover:text-foreground ml-4 flex-shrink-0"
        >
          Request correction
        </Button>
      )}
    </div>
  );
}
