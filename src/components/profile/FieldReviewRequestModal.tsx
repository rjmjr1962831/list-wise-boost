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
  professionalEmail?: string;
  pipedrivePersonId?: number;
}

export default function FieldReviewRequestModal({
  open,
  onOpenChange,
  fieldName,
  profileLink,
  professionalName,
  professionalEmail,
  pipedrivePersonId
}: FieldReviewRequestModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [changeRequest, setChangeRequest] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!changeRequest.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please describe what you want to change and why.',
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
          professionalEmail,
          pipedrivePersonId,
          changeRequest: changeRequest.trim()
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
      <DialogContent className="sm:max-w-[500px]">
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

          <div>
            <Label>Magic Link</Label>
            <Input value={profileLink} disabled className="bg-muted text-xs" />
          </div>

          <div>
            <Label htmlFor="changeRequest">
              What do you want to change and why? *
            </Label>
            <Textarea
              id="changeRequest"
              value={changeRequest}
              onChange={(e) => setChangeRequest(e.target.value)}
              placeholder="Please describe the change you'd like to make. Include details and links to supporting documentation if possible (e.g., updated license records, official certificates, etc.)"
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Please add as much detail as possible, including links to supporting documentation.
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
