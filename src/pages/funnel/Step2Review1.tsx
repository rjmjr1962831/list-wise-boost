import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, ArrowLeft, HelpCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { trackFunnelEvent } from '@/lib/funnel-track';
import InlineReviewForm from '@/components/funnel/InlineReviewForm';
import { FunnelBreadcrumbs } from '@/components/funnel/FunnelBreadcrumbs';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_numbers: { mobile?: { number?: string; publish?: boolean }; business?: { number?: string; publish?: boolean }; other?: { number?: string; publish?: boolean }; cell?: string; brokerage?: string; [key: string]: any } | null;
  company: string | null;
  website: string | null;
  license_number: string | null;
  years_experience: number | null;
  profile_link: string | null;
  address: string | null;
  business_address: { address?: string; name?: string; phone?: string } | null;
  business_city: string | null;
  business_state: string | null;
  business_zip: string | null;
  zip_code: string | null;
}

export default function Step2Review1() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [reviewField, setReviewField] = useState<string | null>(null);
  const [submittedReviews, setSubmittedReviews] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    email: '',
    phone_mobile: '',
    phone_mobile_publish: true,
    phone_business: '',
    phone_business_publish: true,
    phone_other: '',
    phone_other_publish: false,
    company: '',
    street: '',
    city: '',
    state: '',
    zip: '',
  });

  useEffect(() => {
    loadProfessional();
  }, [token]);

  const loadProfessional = async () => {
    if (!token) {
      navigate('/404');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, email, phone, phone_numbers, company, website, license_number, years_experience, profile_link, address, business_address, business_city, business_state, business_zip, zip_code')
        .eq('verification_token', token)
        .single();

      if (error || !data) {
        navigate('/404');
        return;
      }

      setProfessional(data);
      trackFunnelEvent('funnel_step_review1', data);

      const pn = data.phone_numbers as any;
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

      if (!mobile && data.phone && data.phone !== 'N/A') {
        mobile = data.phone;
      }

      // Parse address fields
      let street = data.address || '';
      let city = data.business_city || '';
      let state = data.business_state || '';
      let zip = data.business_zip || data.zip_code || '';

      // If individual fields are empty, try to parse from business_address JSONB
      const ba = data.business_address as any;
      if (ba?.address && (!street || !city)) {
        const parts = ba.address.split(',').map((s: string) => s.trim());
        if (parts.length >= 3) {
          // Format: "street, city, state zip" or "street, city, state, zip"
          if (!street) street = parts[0];
          if (!city) city = parts[1];
          // The remaining parts contain state and zip
          const remainder = parts.slice(2).join(',').trim();
          // Try to extract state code and zip
          const stateZipMatch = remainder.match(/^([A-Z]{2})\s*,?\s*(\d{5}(?:-\d{4})?)$/);
          if (stateZipMatch) {
            if (!state) state = stateZipMatch[1];
            if (!zip) zip = stateZipMatch[2];
          } else {
            // Maybe "CA,90210" or "CA 90210" or just "CA"
            const altMatch = remainder.match(/^([A-Z]{2})\s*,?\s*(\d{5})?/);
            if (altMatch) {
              if (!state) state = altMatch[1];
              if (!zip && altMatch[2]) zip = altMatch[2];
            }
          }
        }
      }

      setFormData({
        email: data.email || '',
        phone_mobile: mobile,
        phone_mobile_publish: mobilePub,
        phone_business: business,
        phone_business_publish: businessPub,
        phone_other: other,
        phone_other_publish: otherPub,
        company: data.company || '',
        street,
        city,
        state,
        zip,
      });
    } catch (err) {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!professional) return;
    trackFunnelEvent('funnel_data_saved', professional);

    setSaving(true);
    try {
      const primaryPhone = formData.phone_mobile || formData.phone_business || formData.phone_other || '';
      const phoneNumbers = {
        mobile: { number: formData.phone_mobile, publish: formData.phone_mobile_publish },
        business: { number: formData.phone_business, publish: formData.phone_business_publish },
        other: { number: formData.phone_other, publish: formData.phone_other_publish },
      };

      const { error } = await supabase
        .from('professionals')
        .update({
          email: formData.email,
          phone: primaryPhone,
          phone_numbers: phoneNumbers,
          company: formData.company,
          address: formData.street || null,
          business_city: formData.city || null,
          business_state: formData.state || null,
          business_zip: formData.zip || null,
          zip_code: formData.zip || null,
        })
        .eq('id', professional.id);

      if (error) throw error;

      toast.success('Contact information saved!');
      navigate(`/funnel/${token}/review-credentials`);
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
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
        <title>Review Your Information | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <FunnelBreadcrumbs currentStep={2} />
          <Card className="!bg-white/5 border-white/10 mt-3">
            <CardHeader>
              <CardTitle className="text-white">Let's verify your contact information</CardTitle>
              <p className="text-sm text-slate-400">
                Make sure everything is correct. This is how clients will reach you.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Name: read-only, request review */}
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-300">Full Name</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                      {professional?.name || 'Not provided'}
                    </div>
                    {submittedReviews.has('name') ? (
                      <div className="flex items-center gap-1 text-xs text-green-700 font-medium px-3 py-2 bg-green-50 border border-green-200 rounded-md shrink-0">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Review requested
                      </div>
                    ) : reviewField !== 'name' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewField('name')}
                        className="shrink-0"
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Request review
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">To change your name, request a review.</p>
                  {reviewField === 'name' && professional && (
                    <InlineReviewForm
                      fieldName="Full Name"
                      currentValue={professional.name || ''}
                      professionalId={professional.id}
                      professionalName={professional.name}
                      professionalEmail={professional.email || undefined}
                      profileLink={professional.profile_link || undefined}
                      onClose={() => setReviewField(null)}
                      onSubmitted={() => { setSubmittedReviews(prev => new Set(prev).add('name')); setReviewField(null); }}
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="email" className="text-slate-300">Email Address *</Label>
                  <p className="text-xs text-slate-500 mb-1">You can edit this field directly.</p>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>

                {/* Phone Numbers with publish sliders */}
                <div className="space-y-3">
                  <Label className="text-slate-300">Phone Numbers</Label>
                  <p className="text-xs text-slate-500">You can edit these fields directly. Use the Public toggle to control whether each number is shown on your profile.</p>

                  {[
                    { label: "Mobile", id: "phone_mobile", value: formData.phone_mobile, publish: formData.phone_mobile_publish, onChange: (v: string) => setFormData({ ...formData, phone_mobile: v }), onToggle: () => setFormData({ ...formData, phone_mobile_publish: !formData.phone_mobile_publish }) },
                    { label: "Business", id: "phone_business", value: formData.phone_business, publish: formData.phone_business_publish, onChange: (v: string) => setFormData({ ...formData, phone_business: v }), onToggle: () => setFormData({ ...formData, phone_business_publish: !formData.phone_business_publish }) },
                    { label: "Other", id: "phone_other", value: formData.phone_other, publish: formData.phone_other_publish, onChange: (v: string) => setFormData({ ...formData, phone_other: v }), onToggle: () => setFormData({ ...formData, phone_other_publish: !formData.phone_other_publish }) },
                  ].map((ph) => (
                    <div key={ph.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <Label htmlFor={ph.id} className="text-xs text-slate-400">{ph.label}</Label>
                        <Input
                          id={ph.id}
                          type="tel"
                          value={ph.value}
                          onChange={(e) => ph.onChange(e.target.value)}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                      <div className="mt-5 flex items-center gap-2">
                        <span className="text-xs text-slate-400">Public</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={ph.publish}
                          onClick={ph.onToggle}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ph.publish ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${ph.publish ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-xs font-medium w-6 ${ph.publish ? 'text-primary' : 'text-muted-foreground'}`}>
                          {ph.publish ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <Label htmlFor="company" className="text-slate-300">Company/Brokerage *</Label>
                  <p className="text-xs text-slate-500 mb-1">You can edit this field directly.</p>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Your company name"
                  />
                </div>

                {/* Business Address */}
                <div className="space-y-3">
                  <Label className="text-slate-300">Business Address</Label>
                  <p className="text-xs text-slate-500">You can edit these fields directly.</p>

                  <div>
                    <Label htmlFor="street" className="text-xs text-slate-400">Street Address</Label>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      placeholder="123 Main St, Suite 100"
                    />
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    <div className="col-span-2">
                      <Label htmlFor="city" className="text-xs text-slate-400">City</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Phoenix"
                      />
                    </div>
                    <div className="col-span-1">
                      <Label htmlFor="state" className="text-xs text-slate-400">State</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })}
                        placeholder="AZ"
                        maxLength={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="zip" className="text-xs text-slate-400">ZIP Code</Label>
                      <Input
                        id="zip"
                        value={formData.zip}
                        onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                        placeholder="85001"
                        maxLength={10}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}`)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formData.email}
                  className="flex-1 gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
