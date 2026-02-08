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
  website: string | null;
  license_number: string | null;
  years_experience: number | null;
  total_sales: number | null;
  description: string | null;
}

export default function Step3Review2() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [formData, setFormData] = useState({
    website: '',
    license_number: '',
    years_experience: '',
    total_sales: '',
    description: '',
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
        .select('id, name, website, license_number, years_experience, total_sales, description')
        .eq('verification_token', token)
        .single();

      if (error || !data) {
        navigate('/404');
        return;
      }

      setProfessional(data);
      setFormData({
        website: data.website || '',
        license_number: data.license_number || '',
        years_experience: data.years_experience?.toString() || '',
        total_sales: data.total_sales?.toString() || '',
        description: data.description || '',
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
          website: formData.website || null,
          license_number: formData.license_number || null,
          years_experience: formData.years_experience ? parseInt(formData.years_experience) : null,
          total_sales: formData.total_sales ? parseInt(formData.total_sales) : null,
          description: formData.description || null,
        })
        .eq('id', professional.id);

      if (error) throw error;

      toast.success('Professional details saved!');
      navigate(`/funnel/${token}/review-final`);
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
        <title>Professional Details | Top10Lists.us</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 2 of 7</span>
                <span className="text-sm font-medium">Professional Details</span>
              </div>
              <CardTitle>Tell us about your experience</CardTitle>
              <p className="text-sm text-muted-foreground">
                This helps potential clients understand your expertise.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="website">Website URL</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div>
                  <Label htmlFor="license">License Number</Label>
                  <Input
                    id="license"
                    value={formData.license_number}
                    onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                    placeholder="Your license number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="years">Years of Experience</Label>
                    <Input
                      id="years"
                      type="number"
                      value={formData.years_experience}
                      onChange={(e) => setFormData({ ...formData, years_experience: e.target.value })}
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sales">Total Sales</Label>
                    <Input
                      id="sales"
                      type="number"
                      value={formData.total_sales}
                      onChange={(e) => setFormData({ ...formData, total_sales: e.target.value })}
                      placeholder="250"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">About You</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Tell potential clients about yourself, your specialties, and what makes you unique..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will appear on your profile. Make it compelling!
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}/review-1`)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
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
