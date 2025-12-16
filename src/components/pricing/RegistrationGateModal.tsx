import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Phone, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegistrationGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToCheckout: (email: string) => void;
  professionalEmail: string | null;
  professionalPhone: string | null;
  professionalName: string;
  professionalId: string;
  token: string;
}

export function RegistrationGateModal({
  isOpen,
  onClose,
  onProceedToCheckout,
  professionalEmail,
  professionalPhone,
  professionalName,
  professionalId,
  token,
}: RegistrationGateModalProps) {
  const [email, setEmail] = useState(professionalEmail || '');
  const [phone, setPhone] = useState(professionalPhone || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!phone) {
      toast.error('Please enter your phone number');
      return;
    }

    setSubmitting(true);

    try {
      // Update email and phone in database
      if (professionalId) {
        await supabase
          .from('professionals')
          .update({ email, phone })
          .eq('id', professionalId);
      }

      // Send magic link in background (don't wait for it)
      const redirectUrl = `${window.location.origin}/profile/${token}/pricing`;
      supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            professional_id: professionalId,
            funnel_token: token,
          },
        },
      }).then(() => {
        // Magic link sent in background
      }).catch((err) => {
        console.error('Magic link send error:', err);
      });

      // Immediately proceed to checkout
      onProceedToCheckout(email);
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  const firstName = professionalName?.split(' ')[0] || 'there';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Please Register Your Account</DialogTitle>
          <DialogDescription>
            Hi {firstName}! Enter your contact info to continue to checkout. 
            We'll also send you a login link for future access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              className="text-lg"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || !email || !phone}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Continue to Checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            A login link will be sent to your email for future account access.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
