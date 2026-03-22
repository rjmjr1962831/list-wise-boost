import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from '@/components/SafeHead';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';
import { SandboxNugget } from './SandboxNugget';
import { SandboxProgress } from './SandboxProgress';
import { validateToken } from './utils';

/** Format a phone string to US standard: (xxx) xxx-xxxx */
function formatUSPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  // Strip leading 1 if 11 digits
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (d.length !== 10) return raw; // Only format valid 10-digit numbers
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Toggle switch shared by all fields */
function PublishToggle({ publish, onToggle }: { publish: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Public</span>
      <button
        type="button"
        role="switch"
        aria-checked={publish}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${publish ? 'bg-primary' : 'bg-muted-foreground/30'}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${publish ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <span className={`text-xs font-medium w-6 ${publish ? 'text-primary' : 'text-muted-foreground'}`}>
        {publish ? 'Yes' : 'No'}
      </span>
    </div>
  );
}

/** Brief "Saved" flash next to a field */
function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 animate-in fade-in duration-300">
      <Check className="h-3 w-3" /> Saved
    </span>
  );
}

export default function SandboxStep2() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useGA4Tracking();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    email_publish: true,
    phone_mobile: '',
    phone_mobile_publish: true,
    phone_business: '',
    phone_business_publish: true,
    phone_other: '',
    phone_other_publish: false,
    website: '',
    website_publish: true,
  });
  const [consent, setConsent] = useState(false);
  const [showConsentAlert, setShowConsentAlert] = useState(false);

  // Track which fields just saved (for flash indicator)
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Snapshot of DB values to detect changes
  const dbSnapshot = useRef<typeof formData | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!token) { navigate(`/sandbox/${token}`); return; }
    validateToken(token).then((result) => {
      if (result.status !== 'valid' || !result.professional) {
        navigate(`/sandbox/${token}`);
        return;
      }
      const p = result.professional;
      setProfessional(p);

      // Parse phone_numbers JSONB
      const pn = p.phone_numbers as any;
      let mobile = '', mobilePub = true;
      let business = '', businessPub = true;
      let other = '', otherPub = false;

      if (pn) {
        if (pn.mobile?.number !== undefined) {
          mobile = pn.mobile?.number || '';
          mobilePub = pn.mobile?.publish !== false;
          business = pn.business?.number || '';
          businessPub = pn.business?.publish !== false;
          other = pn.other?.number || '';
          otherPub = pn.other?.publish === true;
        } else {
          mobile = pn.cell || '';
          business = pn.business || pn.brokerage || '';
        }
      }
      if (!mobile && p.phone && p.phone !== 'N/A') {
        mobile = p.phone;
      }

      const initial = {
        email: p.email || '',
        email_publish: p.email_visible ?? true,
        phone_mobile: mobile,
        phone_mobile_publish: mobilePub,
        phone_business: business,
        phone_business_publish: businessPub,
        phone_other: other,
        phone_other_publish: otherPub,
        website: p.website || '',
        website_publish: p.website_visible ?? true,
      };
      setFormData(initial);
      dbSnapshot.current = { ...initial };
      setLoading(false);
    });
  }, [token]);

  /** Send a single field update via edge function */
  const updateField = async (field: string, value: any) => {
    if (!token) return false;
    const { error } = await supabase.functions.invoke('update-professional-field', {
      body: { token, field, value },
    });
    return !error;
  };

  /** Save a single field (or group) to the DB via edge function */
  const saveField = useCallback(async (fieldKey: string, data: typeof formData) => {
    if (!professional || !token) return;

    const calls: Promise<boolean>[] = [];

    if (fieldKey === 'email' || fieldKey === 'email_publish') {
      calls.push(updateField('email', data.email));
      calls.push(updateField('email_visible', data.email_publish));
    } else if (fieldKey.startsWith('phone_')) {
      const primaryPhone = data.phone_mobile || data.phone_business || data.phone_other || '';
      const phoneNumbers = {
        mobile: { number: data.phone_mobile, publish: data.phone_mobile_publish },
        business: { number: data.phone_business, publish: data.phone_business_publish },
        other: { number: data.phone_other, publish: data.phone_other_publish },
      };
      calls.push(updateField('phone', primaryPhone));
      calls.push(updateField('phone_numbers', phoneNumbers));
    } else if (fieldKey === 'website' || fieldKey === 'website_publish') {
      calls.push(updateField('website', data.website));
      calls.push(updateField('website_visible', data.website_publish));
    }

    if (calls.length === 0) return;

    const results = await Promise.all(calls);
    if (results.some((ok) => !ok)) {
      toast.error(`Failed to save ${fieldKey}`);
      return;
    }

    // Update snapshot
    if (dbSnapshot.current) {
      dbSnapshot.current = { ...dbSnapshot.current, ...data };
    }

    // Flash "Saved" indicator
    setSavedFields((prev) => new Set(prev).add(fieldKey));
    if (savedTimers.current[fieldKey]) clearTimeout(savedTimers.current[fieldKey]);
    savedTimers.current[fieldKey] = setTimeout(() => {
      setSavedFields((prev) => {
        const next = new Set(prev);
        next.delete(fieldKey);
        return next;
      });
    }, 2000);
  }, [professional]);

  /** Called on input blur — saves if the value actually changed */
  const handleBlur = useCallback((fieldKey: string) => {
    if (!dbSnapshot.current) return;
    const snap = dbSnapshot.current as any;
    const current = formData as any;

    // For phone fields, check if any phone value changed
    if (fieldKey.startsWith('phone_')) {
      const phoneKeys = ['phone_mobile', 'phone_mobile_publish', 'phone_business', 'phone_business_publish', 'phone_other', 'phone_other_publish'];
      const changed = phoneKeys.some((k) => snap[k] !== current[k]);
      if (changed) saveField(fieldKey, formData);
    } else {
      if (snap[fieldKey] !== current[fieldKey]) {
        saveField(fieldKey, formData);
      }
    }
  }, [formData, saveField]);

  /** Toggle handler — saves immediately since there's no blur event for toggles */
  const handleToggle = useCallback((fieldKey: string) => {
    setFormData((prev) => {
      const next = { ...prev, [fieldKey]: !(prev as any)[fieldKey] };
      // Save after state update via setTimeout so we get the new value
      setTimeout(() => saveField(fieldKey, next), 0);
      return next;
    });
  }, [saveField]);

  const handleContinue = async () => {
    if (!consent) {
      setShowConsentAlert(true);
      return;
    }
    if (!professional || !token) return;

    setSaving(true);
    try {
      // Final save of everything in case blur didn't fire
      const primaryPhone = formData.phone_mobile || formData.phone_business || formData.phone_other || '';
      const phoneNumbers = {
        mobile: { number: formData.phone_mobile, publish: formData.phone_mobile_publish },
        business: { number: formData.phone_business, publish: formData.phone_business_publish },
        other: { number: formData.phone_other, publish: formData.phone_other_publish },
      };

      const results = await Promise.all([
        updateField('email', formData.email),
        updateField('email_visible', formData.email_publish),
        updateField('phone', primaryPhone),
        updateField('phone_numbers', phoneNumbers),
        updateField('website', formData.website),
        updateField('website_visible', formData.website_publish),
      ]);

      if (results.some((ok) => !ok)) throw new Error('One or more fields failed to save');

      // Fire funnel notification
      await supabase.functions.invoke('send-funnel-notification', {
        body: {
          event_type: 'sandbox_contact_submitted',
          agent_name: professional.name,
          agent_email: formData.email,
          agent_id: professional.id,
        },
      }).catch(() => { /* best effort */ });

      trackEvent('sandbox_step2_complete', {
        professional_id: professional.id,
      });

      navigate(`/sandbox/${token}/cities`);
    } catch (err: any) {
      toast.error('Something went wrong: ' + (err.message || 'Please try again.'));
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Contact Info | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-xl mx-auto space-y-6">
          <SandboxProgress currentStep={2} />

          <SandboxNugget>
            <p className="mb-2">
              AI doesn't recommend whoever is LOUDEST, like SEO and Google search do. It names whoever is SAFEST. The strategies that worked last year don't work today.
            </p>
            <p className="mb-2">
              We were built to make AI feel safe naming the professionals on our list. We are not a directory or lead generator.
            </p>
            <p>
              Think of us as the credit bureau for AI recommendations.
            </p>
          </SandboxNugget>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">How should people reach you?</h1>
          </div>

          <div className="space-y-5">
            {/* Email with publish toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email">Email Address</Label>
                <SavedIndicator show={savedFields.has('email') || savedFields.has('email_publish')} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onBlur={() => handleBlur('email')}
                    required
                  />
                </div>
                <PublishToggle
                  publish={formData.email_publish}
                  onToggle={() => handleToggle('email_publish')}
                />
              </div>
            </div>

            {/* Phone Numbers with publish sliders */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Phone Numbers</Label>
                <SavedIndicator show={
                  savedFields.has('phone_mobile') || savedFields.has('phone_mobile_publish') ||
                  savedFields.has('phone_business') || savedFields.has('phone_business_publish') ||
                  savedFields.has('phone_other') || savedFields.has('phone_other_publish')
                } />
              </div>
              <p className="text-xs text-muted-foreground">Use the Public toggle to control whether each number is shown on your profile.</p>

              {[
                { label: 'Mobile', id: 'phone_mobile' as const, publishKey: 'phone_mobile_publish' as const },
                { label: 'Business', id: 'phone_business' as const, publishKey: 'phone_business_publish' as const },
                { label: 'Other', id: 'phone_other' as const, publishKey: 'phone_other_publish' as const },
              ].map((ph) => (
                <div key={ph.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label htmlFor={ph.id} className="text-xs text-muted-foreground">{ph.label}</Label>
                    <Input
                      id={ph.id}
                      type="tel"
                      value={(formData as any)[ph.id]}
                      onChange={(e) => setFormData({ ...formData, [ph.id]: e.target.value })}
                      onBlur={() => {
                        const formatted = formatUSPhone((formData as any)[ph.id]);
                        if (formatted !== (formData as any)[ph.id]) {
                          setFormData((prev) => ({ ...prev, [ph.id]: formatted }));
                        }
                        handleBlur(ph.id);
                      }}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="mt-5">
                    <PublishToggle
                      publish={(formData as any)[ph.publishKey]}
                      onToggle={() => handleToggle(ph.publishKey)}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Tip: If a number is your Zillow tracking number, consider using your direct line instead.
              </p>
            </div>

            {/* Website with publish toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="website">Website</Label>
                <SavedIndicator show={savedFields.has('website') || savedFields.has('website_publish')} />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    onBlur={() => handleBlur('website')}
                  />
                </div>
                <PublishToggle
                  publish={formData.website_publish}
                  onToggle={() => handleToggle('website_publish')}
                />
              </div>
            </div>

          </div>

          {/* Consent */}
          <div className="border-t pt-5 space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(c) => setConsent(!!c)}
              />
              <Label htmlFor="consent" className="text-sm font-normal leading-snug cursor-pointer">
                I confirm that I have read and agree to the{' '}
                <a href="/terms" target="_blank" className="underline text-primary">Terms and Conditions</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="underline text-primary">Privacy Policy</a>
                , and agree to receive marketing, account status, and two-factor authentication communications from Top10Lists.us. I can opt out any time.
              </Label>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => navigate(`/sandbox/${token}`)}
            >
              Back
            </Button>
            <Button
              onClick={handleContinue}
              disabled={saving || !consent}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : 'Continue'}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={showConsentAlert} onOpenChange={setShowConsentAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Please accept the terms to continue.</AlertDialogTitle>
            <AlertDialogDescription>
              You must agree to the Terms and Conditions and Privacy Policy before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
