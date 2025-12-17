import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FieldReviewRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  profileLink: string;
  professionalName: string;
  professionalId: string;
  professionalEmail?: string;
  pipedrivePersonId?: number;
  currentValue?: string;
  proposedValue?: string;
}

export default function FieldReviewRequestModal({
  open,
  onOpenChange,
  fieldName,
  profileLink,
  professionalName,
  professionalId,
  professionalEmail,
  pipedrivePersonId,
  currentValue,
  proposedValue
}: FieldReviewRequestModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [changeRequest, setChangeRequest] = useState('');
  const [newProposedValue, setNewProposedValue] = useState(proposedValue || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newProposedValue.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please enter what you want this field to say.',
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-pipedrive-task', {
        body: {
          fieldName,
          profileLink,
          professionalName,
          professionalId,
          professionalEmail,
          pipedrivePersonId,
          changeRequest: changeRequest.trim(),
          currentValue: currentValue || null,
          proposedValue: newProposedValue.trim() || null
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to submit request');
      }

      toast({
        title: 'Request Submitted',
        description: 'Your change request has been submitted for review. We\'ll get back to you soon.'
      });

      setChangeRequest('');
      setNewProposedValue('');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error submitting review request:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit request. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Field Change</DialogTitle>
          <DialogDescription>
            This field is synced from external sources. To make changes, please submit a review request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label>Field to Change</Label>
            <Input value={fieldName} disabled className="bg-muted" />
          </div>

          {/* Current Value */}
          {currentValue && (
            <div>
              <Label className="text-muted-foreground">Current Value</Label>
              <div className="mt-1 p-3 bg-muted rounded-md text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
                <div dangerouslySetInnerHTML={{ __html: currentValue }} />
              </div>
            </div>
          )}

          {/* Proposed New Value */}
          <div>
            <Label htmlFor="proposedValue">
              What should this field say instead? *
            </Label>
            <Textarea
              id="proposedValue"
              value={newProposedValue}
              onChange={(e) => setNewProposedValue(e.target.value)}
              placeholder="Enter the exact text you want this field to display..."
              rows={4}
              className="mt-1"
              required
            />
          </div>

          {/* Reason for Change */}
          <div>
            <Label htmlFor="changeRequest">
              Why should we make this change?
            </Label>
            <Textarea
              id="changeRequest"
              value={changeRequest}
              onChange={(e) => setChangeRequest(e.target.value)}
              placeholder="Please explain why this change is needed. Include links to supporting documentation if possible (e.g., updated license records, official certificates, etc.)"
              rows={3}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Optional: Add supporting documentation or links to verify the change.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
