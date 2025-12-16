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
import { Loader2, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegistrationGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  professionalEmail: string | null;
  professionalName: string;
  professionalId: string;
  token: string;
}

export function RegistrationGateModal({
  isOpen,
  onClose,
  professionalEmail,
  professionalName,
  professionalId,
  token,
}: RegistrationGateModalProps) {
  const [email, setEmail] = useState(professionalEmail || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendMagicLink = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSending(true);

    try {
      // Update email if different
      if (email !== professionalEmail && professionalId) {
        await supabase
          .from('professionals')
          .update({ email })
          .eq('id', professionalId);
      }

      // Send magic link - redirect back to pricing page after auth
      const redirectUrl = `${window.location.origin}/profile/${token}/pricing`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            professional_id: professionalId,
            funnel_token: token,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        setSending(false);
        return;
      }

      setSent(true);
      toast.success('Check your email for the login link!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send magic link');
      setSending(false);
    }
  };

  const firstName = professionalName?.split(' ')[0] || 'there';

  if (sent) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">Check Your Email</DialogTitle>
              <DialogDescription className="text-center">
                We sent a magic link to <span className="font-medium text-foreground">{email}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>Click the link in your email to continue to checkout. The link will expire in 1 hour.</p>
            </div>
            <Button variant="outline" onClick={() => { setSent(false); setSending(false); }}>
              Try a different email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Please Register Your Account</DialogTitle>
          <DialogDescription>
            Hi {firstName}! Before we proceed to checkout, we need to verify your email. 
            We'll send you a magic link — no password needed.
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

          <Button
            className="w-full"
            onClick={handleSendMagicLink}
            disabled={sending || !email}
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                Continue to Checkout
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            We use secure, passwordless authentication. Just click the link we send to your email.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}