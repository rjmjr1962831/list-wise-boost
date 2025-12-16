import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface FieldEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (newValue: string) => Promise<void>;
  fieldLabel: string;
  fieldKey: string;
  currentValue: string;
  isTextarea?: boolean;
  placeholder?: string;
}

export default function FieldEditModal({
  open,
  onClose,
  onSave,
  fieldLabel,
  fieldKey,
  currentValue,
  isTextarea = false,
  placeholder
}: FieldEditModalProps) {
  // Strip HTML tags from value for editing
  const stripHtml = (html: string) => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  };
  
  const [value, setValue] = useState(stripHtml(currentValue));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setValue(stripHtml(currentValue)); // Reset on close
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {fieldLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={fieldKey}>{fieldLabel}</Label>
            {isTextarea ? (
              <Textarea
                id={fieldKey}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                rows={6}
                className="whitespace-pre-line"
              />
            ) : (
              <Input
                id={fieldKey}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
