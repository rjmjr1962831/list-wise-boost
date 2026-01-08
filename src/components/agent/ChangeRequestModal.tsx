import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChangeRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldName: string;
  fieldLabel: string;
  currentValue: string;
  sessionToken: string;
  onSuccess?: () => void;
}

export function ChangeRequestModal({
  isOpen,
  onClose,
  fieldName,
  fieldLabel,
  currentValue,
  sessionToken,
  onSuccess,
}: ChangeRequestModalProps) {
  const [proposedValue, setProposedValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!proposedValue.trim()) {
      toast.error("Please enter the proposed new value");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-change-request", {
        body: {
          sessionToken,
          fieldName,
          currentValue,
          proposedValue: proposedValue.trim(),
          reason: reason.trim() || undefined,
        },
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success("Change request submitted successfully");
      onSuccess?.();
    } catch (error: any) {
      console.error("Error submitting change request:", error);
      toast.error(error.message || "Failed to submit change request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setProposedValue("");
    setReason("");
    setSubmitted(false);
    onClose();
  };

  if (submitted) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <DialogTitle className="text-xl mb-2">Request Submitted</DialogTitle>
            <DialogDescription>
              Your change request for <strong>{fieldLabel}</strong> has been submitted for review.
              We'll notify you once it's been processed.
            </DialogDescription>
          </div>
          <DialogFooter>
            <Button onClick={handleClose} className="w-full">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Change: {fieldLabel}</DialogTitle>
          <DialogDescription>
            Submit a request to change this field. Our team will review and process your request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Current Value</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              {currentValue || <em className="text-muted-foreground">Not set</em>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposedValue">Proposed New Value *</Label>
            <Input
              id="proposedValue"
              value={proposedValue}
              onChange={(e) => setProposedValue(e.target.value)}
              placeholder={`Enter new ${fieldLabel.toLowerCase()}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason / Supporting Information (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this change is needed..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
