import { useState, useEffect } from 'react';
import { Pencil, Check, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface PhoneNumbers {
  zillow: string;
  mobile: string;
  business: string;
  publish_zillow: boolean;
  publish_mobile: boolean;
  publish_business: boolean;
}

interface PhoneFieldsEditorProps {
  phoneNumbers: PhoneNumbers;
  onSave: (phoneNumbers: PhoneNumbers) => void;
}

interface PhoneRowProps {
  label: string;
  value: string;
  isPublished: boolean;
  onValueChange: (value: string) => void;
  onPublishChange: (checked: boolean) => void;
  placeholder?: string;
}

function PhoneRow({ 
  label, 
  value, 
  isPublished, 
  onValueChange, 
  onPublishChange,
  placeholder = "(555) 123-4567"
}: PhoneRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    onValueChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const displayValue = value || 'Not listed';
  const hasValue = !!value;

  return (
    <div className="flex items-start justify-between py-3 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 text-base"
              placeholder={placeholder}
              type="tel"
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
        ) : (
          <p className={`text-base ${hasValue ? 'text-foreground' : 'text-muted-foreground italic'}`}>
            {displayValue}
          </p>
        )}
      </div>
      
      {/* Publish checkbox */}
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id={`publish-${label.toLowerCase().replace(' ', '-')}`}
          checked={isPublished}
          onCheckedChange={(checked) => onPublishChange(checked === true)}
          disabled={!hasValue}
        />
        <Label 
          htmlFor={`publish-${label.toLowerCase().replace(' ', '-')}`}
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Publish
        </Label>
      </div>

      {/* Edit button */}
      {!isEditing && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
      )}
    </div>
  );
}

export function PhoneFieldsEditor({ phoneNumbers, onSave }: PhoneFieldsEditorProps) {
  const [localData, setLocalData] = useState<PhoneNumbers>(phoneNumbers);

  useEffect(() => {
    setLocalData(phoneNumbers);
  }, [phoneNumbers]);

  const handleFieldChange = (field: keyof PhoneNumbers, value: string | boolean) => {
    const updated = { ...localData, [field]: value };
    setLocalData(updated);
    onSave(updated);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Phone Numbers</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Add your phone numbers and select which ones to display publicly.
      </p>
      
      <div className="divide-y divide-border/50">
        <PhoneRow
          label="Zillow"
          value={localData.zillow}
          isPublished={localData.publish_zillow}
          onValueChange={(val) => handleFieldChange('zillow', val)}
          onPublishChange={(checked) => handleFieldChange('publish_zillow', checked)}
          placeholder="Phone from Zillow profile"
        />
        <PhoneRow
          label="Mobile"
          value={localData.mobile}
          isPublished={localData.publish_mobile}
          onValueChange={(val) => handleFieldChange('mobile', val)}
          onPublishChange={(checked) => handleFieldChange('publish_mobile', checked)}
          placeholder="Your mobile number"
        />
        <PhoneRow
          label="Business"
          value={localData.business}
          isPublished={localData.publish_business}
          onValueChange={(val) => handleFieldChange('business', val)}
          onPublishChange={(checked) => handleFieldChange('publish_business', checked)}
          placeholder="Office or business line"
        />
      </div>
    </div>
  );
}
