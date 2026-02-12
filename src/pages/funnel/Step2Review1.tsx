import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  license_number: string | null;
  years_experience: number | null;
}

export default function Step2Review1() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
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
        .select('id, name, email, phone, company, website, license_number, years_experience')
        .eq('verification_token', token)
        .single();

      if (error || !data) {
        navigate('/404');
        return;
      }

      setProfessional(data);
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        company: data.company || '',
      });
    } catch (err) {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!professional) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('professionals')
        .update({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
        })
        .eq('id', professional.id);

      if (error) throw error;

      toast.success('Basic information saved!');
      navigate(`/funnel/${token}/review-2`);
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
      <Helmet>
        <title>Review Your Information | Top10Lists.us</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 1 of 7</span>
                <span className="text-sm font-medium">Basic Information</span>
              </div>
              <CardTitle>Let's verify your contact information</CardTitle>
              <p className="text-sm text-muted-foreground">
                Make sure everything is correct. This is how clients will reach you.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <Label htmlFor="company">Company/Brokerage *</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Your company name"
                  />
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
                  disabled={saving || !formData.name || !formData.email}
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
