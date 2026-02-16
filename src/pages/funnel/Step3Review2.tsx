import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowRight, ArrowLeft, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

const REVIEW_REQUEST_FIELDS = ['license_number', 'years_experience', 'total_sales'] as const;

interface Professional {
  id: string;
  name: string;
  title: string | null;
  headline: string | null;
  company: string | null;
  business_name: string | null;
  website: string | null;
  license_number: string | null;
  years_experience: number | null;
  total_sales: number | null;
  address: string | null;
  zip_code: string | null;
  specialty: string[] | null;
  zillow_profile_url: string | null;
  sidebar_video_url: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_linkedin: string | null;
  social_twitter: string | null;
  social_tiktok: string | null;
  image_url: string | null;
  agent_sales_stats?: { volumeAllTime?: number } | null;
  average_value_3yr?: number | null;
}

export default function Step3Review2() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [formData, setFormData] = useState({
    website: '',
    title: '',
    headline: '',
    address: '',
    zip_code: '',
    specialty: '' as string,
    zillow_profile_url: '',
    sidebar_video_url: '',
    social_facebook: '',
    social_instagram: '',
    social_linkedin: '',
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
        .select('id, name, title, headline, company, business_name, website, license_number, years_experience, total_sales, address, zip_code, specialty, zillow_profile_url, sidebar_video_url, review_stars_rating, num_total_reviews, social_facebook, social_instagram, social_linkedin, social_twitter, social_tiktok, image_url, agent_sales_stats, average_value_3yr')
        .eq('verification_token', token)
        .single();

      if (error || !data) {
        navigate('/404');
        return;
      }

      setProfessional(data);
      setFormData({
        website: data.website || '',
        title: data.title || '',
        headline: data.headline || '',
        address: data.address || '',
        zip_code: data.zip_code || '',
        specialty: Array.isArray(data.specialty) ? data.specialty.join(', ') : (data.specialty || ''),
        zillow_profile_url: data.zillow_profile_url || '',
        sidebar_video_url: data.sidebar_video_url || '',
        social_facebook: data.social_facebook || '',
        social_instagram: data.social_instagram || '',
        social_linkedin: data.social_linkedin || '',
        social_twitter: data.social_twitter || '',
        social_tiktok: data.social_tiktok || '',
        business_name: data.business_name || '',
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
      const specialtyArr = formData.specialty
        ? formData.specialty.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const { error } = await supabase
        .from('professionals')
        .update({
          website: formData.website || null,
          title: formData.title || null,
          headline: formData.headline || null,
          address: formData.address || null,
          zip_code: formData.zip_code || null,
          specialty: specialtyArr.length ? specialtyArr : null,
          zillow_profile_url: formData.zillow_profile_url || null,
          sidebar_video_url: formData.sidebar_video_url || null,
          social_facebook: formData.social_facebook || null,
          social_instagram: formData.social_instagram || null,
          social_linkedin: formData.social_linkedin || null,
          social_twitter: formData.social_twitter || null,
          social_tiktok: formData.social_tiktok || null,
          business_name: formData.business_name || null,
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

  const handleRequestReview = (field: string) => {
    toast.info(`Review request for ${field} will be sent to our team. Call (602) 758-9600 to discuss.`);
  };

  const getTotalSales = () => {
    if (!professional) return null;
    const stats = professional.agent_sales_stats as { countAllTime?: number; countLastYear?: number } | undefined;
    return (
      professional.total_sales ??
      stats?.countAllTime ??
      stats?.countLastYear ??
      null
    );
  };

  const getVolume = () => {
    if (!professional) return null;
    const stats = professional.agent_sales_stats as { volumeAllTime?: number } | undefined;
    const v = stats?.volumeAllTime ?? professional.average_value_3yr;
    if (v == null || v <= 0) return null;
    if (v >= 1000000000) return `$${(v / 1000000000).toFixed(1)}B`;
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
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
        <title>Professional Details | Top10Lists.us</title>
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 2 of 7</span>
                <span className="text-sm font-medium">Professional Details</span>
              </div>
              <CardTitle>Review your profile fields</CardTitle>
              <p className="text-sm text-muted-foreground">
                Some fields require a review request to change. Editable fields save directly.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {/* Read-only: License Number */}
                <div className="flex flex-col gap-2">
                  <Label>License Number</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono">
                      {professional?.license_number || 'Not provided'}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRequestReview('license number')}
                      className="shrink-0"
                    >
                      <HelpCircle className="h-4 w-4 mr-1" />
                      Request review
                    </Button>
                  </div>
                </div>

                {/* Read-only: Years of Experience */}
                <div className="flex flex-col gap-2">
                  <Label>Years of Experience</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                      {professional?.years_experience ?? 'Not provided'}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRequestReview('years of experience')}
                      className="shrink-0"
                    >
                      <HelpCircle className="h-4 w-4 mr-1" />
                      Request review
                    </Button>
                  </div>
                </div>

                {/* Read-only: Total Sales */}
                <div className="flex flex-col gap-2">
                  <Label>Total Sales</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                      {getTotalSales()?.toLocaleString() ?? 'Not provided'}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRequestReview('total sales')}
                      className="shrink-0"
                    >
                      <HelpCircle className="h-4 w-4 mr-1" />
                      Request review
                    </Button>
                  </div>
                </div>

                {/* Volume (read-only, display only) */}
                {getVolume() && (
                  <div>
                    <Label>Volume (3yr)</Label>
                    <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">{getVolume()}</div>
                  </div>
                )}

                {/* Editable fields */}
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
                  <Label htmlFor="title">Title (e.g. DDS, DMD)</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Your professional title"
                  />
                </div>

                <div>
                  <Label htmlFor="headline">Headline</Label>
                  <Input
                    id="headline"
                    value={formData.headline}
                    onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                    placeholder="Short professional headline"
                  />
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Business address"
                  />
                </div>

                <div>
                  <Label htmlFor="zip_code">ZIP Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    placeholder="ZIP"
                  />
                </div>

                <div>
                  <Label htmlFor="specialty">Specialties (comma-separated)</Label>
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    placeholder="First-time buyers, Luxury, etc."
                  />
                </div>

                <div>
                  <Label htmlFor="zillow">Zillow Profile URL</Label>
                  <Input
                    id="zillow"
                    type="url"
                    value={formData.zillow_profile_url}
                    onChange={(e) => setFormData({ ...formData, zillow_profile_url: e.target.value })}
                    placeholder="https://www.zillow.com/profile/..."
                  />
                </div>

                <div>
                  <Label htmlFor="video">YouTube Video URL</Label>
                  <Input
                    id="video"
                    type="url"
                    value={formData.sidebar_video_url}
                    onChange={(e) => setFormData({ ...formData, sidebar_video_url: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>

                <div>
                  <Label htmlFor="business_name">Business Name</Label>
                  <Input
                    id="business_name"
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                    placeholder="Business name (if different from company)"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="social_fb">Facebook</Label>
                    <Input
                      id="social_fb"
                      type="url"
                      value={formData.social_facebook}
                      onChange={(e) => setFormData({ ...formData, social_facebook: e.target.value })}
                      placeholder="URL"
                    />
                  </div>
                  <div>
                    <Label htmlFor="social_ig">Instagram</Label>
                    <Input
                      id="social_ig"
                      type="url"
                      value={formData.social_instagram}
                      onChange={(e) => setFormData({ ...formData, social_instagram: e.target.value })}
                      placeholder="URL"
                    />
                  </div>
                  <div>
                    <Label htmlFor="social_li">LinkedIn</Label>
                    <Input
                      id="social_li"
                      type="url"
                      value={formData.social_linkedin}
                      onChange={(e) => setFormData({ ...formData, social_linkedin: e.target.value })}
                      placeholder="URL"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="social_tw">Twitter/X</Label>
                    <Input
                      id="social_tw"
                      type="url"
                      value={formData.social_twitter}
                      onChange={(e) => setFormData({ ...formData, social_twitter: e.target.value })}
                      placeholder="URL"
                    />
                  </div>
                  <div>
                    <Label htmlFor="social_tt">TikTok</Label>
                    <Input
                      id="social_tt"
                      type="url"
                      value={formData.social_tiktok}
                      onChange={(e) => setFormData({ ...formData, social_tiktok: e.target.value })}
                      placeholder="URL"
                    />
                  </div>
                </div>

                {/* Read-only display: Rating & Reviews */}
                {(professional?.review_stars_rating ?? professional?.num_total_reviews) && (
                  <div className="rounded-md border p-3 bg-muted/30">
                    <Label className="text-muted-foreground">Reviews (from source)</Label>
                    <p className="text-sm mt-1">
                      {professional?.review_stars_rating ?? '—'} stars · {professional?.num_total_reviews?.toLocaleString() ?? 0} reviews
                    </p>
                  </div>
                )}
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
