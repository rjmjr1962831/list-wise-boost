import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditableFieldRowProps {
  label: string;
  value: string;
  placeholder?: string;
  note?: string;
  isLink?: boolean;
  onSave: (value: string) => void;
}

export function EditableFieldRow({ 
  label, 
  value, 
  placeholder,
  note,
  isLink = false,
  onSave
}: EditableFieldRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const displayValue = value || 'Not listed';
  const hasValue = !!value;

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setEditValue(value);
    setIsEditing(true);
  };

  return (
    <div className="flex items-start justify-between py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 text-base"
              placeholder={placeholder}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className="h-8 w-8 p-0 text-primary hover:text-primary/80"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
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
        {note && !isEditing && (
          <p className="text-xs text-muted-foreground italic mt-0.5">{note}</p>
        )}
      </div>
      {!isEditing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStartEdit}
          className="text-muted-foreground hover:text-foreground ml-4 flex-shrink-0"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
      )}
    </div>
  );
}
