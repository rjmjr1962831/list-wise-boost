import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';

interface ContactProfessionalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalName: string;
  professionalId: string;
  listingUrl: string;
  citySlug?: string;
  categorySlug?: string;
  cityName?: string;
  categoryName?: string;
  professionalWebsite?: string;
}

export function ContactProfessionalModal({ 
  open, 
  onOpenChange, 
  professionalName,
  professionalId,
  listingUrl,
  citySlug,
  categorySlug,
  cityName,
  categoryName,
  professionalWebsite
}: ContactProfessionalModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { trackEvent } = useGA4Tracking();

  // Pre-populate from quiz data if available
  useEffect(() => {
    if (open && citySlug && categorySlug) {
      const storageKey = `quiz_completed_${citySlug}_${categorySlug}`;
      const quizData = localStorage.getItem(storageKey);
      
      if (quizData) {
        try {
          const preferences = JSON.parse(quizData);
          // Store preferences in the message for context
          const prefText = Object.entries(preferences)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          setMessage(`My preferences: ${prefText}\n\n`);
        } catch (e) {
          console.error('Error parsing quiz data:', e);
        }
      }
    }
  }, [open, citySlug, categorySlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || !email || !phone) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      trackEvent('contact_form_submit', {
        agent_name: professionalName,
        professional_id: professionalId,
      });

      const { error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          professionalName,
          professionalId,
          listingUrl,
          contactName: fullName,
          contactEmail: email,
          contactPhone: phone,
          message: message || 'No additional message provided.',
          cityName: cityName || 'Unknown City',
          categoryName: categoryName || 'Professional',
          professionalWebsite: professionalWebsite || '',
        },
      });

      if (error) throw error;

      toast({
        title: "Message sent!",
        description: "We'll forward your information to the professional.",
      });

      trackEvent('contact_form_success', {
        agent_name: professionalName,
      });

      // Reset form
      setFullName('');
      setEmail('');
      setPhone('');
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending contact form:', error);
      toast({
        title: "Error",
        description: "Failed to send your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact {professionalName}</DialogTitle>
          <DialogDescription>
            Fill out the form below and we'll forward your information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Additional Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell them more about what you're looking for..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
