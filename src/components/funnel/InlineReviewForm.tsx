import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InlineReviewFormProps {
  fieldName: string;
  currentValue: string;
  professionalId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function InlineReviewForm({
  fieldName,
  currentValue,
  professionalId,
  onClose,
  onSubmitted,
}: InlineReviewFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [proposedValue, setProposedValue] = useState('');
  const [confirmationSource, setConfirmationSource] = useState('');

  const handleSubmit = async () => {
    if (!proposedValue.trim()) {
      toast.error('Please enter what this field should say.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('field_change_requests')
        .insert({
          professional_id: professionalId,
          field_name: fieldName,
          current_value: currentValue || null,
          proposed_value: proposedValue.trim(),
          change_request: confirmationSource.trim() || null,
          status: 'pending',
        });

      if (error) throw error;

      setSubmitted(true);
      toast.success('Review request submitted. We will get back to you soon.');
      onSubmitted?.();
      setTimeout(() => onClose(), 2000);
    } catch (err: any) {
      console.error('Error submitting review request:', err);
      toast.error(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        Request submitted. We will review and get back to you.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Request a change to {fieldName}</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <Label htmlFor={`review-value-${fieldName}`} className="text-xs">What should it be? *</Label>
        <Input
          id={`review-value-${fieldName}`}
          value={proposedValue}
          onChange={(e) => setProposedValue(e.target.value)}
          placeholder="Enter the correct value..."
          className="mt-1 bg-background"
        />
      </div>

      <div>
        <Label htmlFor={`review-source-${fieldName}`} className="text-xs">Where can we confirm this?</Label>
        <Input
          id={`review-source-${fieldName}`}
          value={confirmationSource}
          onChange={(e) => setConfirmationSource(e.target.value)}
          placeholder="Link to license record, website, etc."
          className="mt-1 bg-background"
        />
        <p className="text-xs text-muted-foreground mt-1">A link or reference helps us verify faster.</p>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !proposedValue.trim()}
          className="gap-1"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-3 w-3" />
              Submit Request
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
