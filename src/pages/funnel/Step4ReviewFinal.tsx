import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowRight, ArrowLeft, CheckCircle, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_numbers: { mobile?: { number?: string; publish?: boolean }; business?: { number?: string; publish?: boolean }; other?: { number?: string; publish?: boolean }; [key: string]: any } | null;
  company: string | null;
  business_name?: string | null;
  website: string | null;
  license_number: string | null;
  years_experience: number | null;
  total_sales: number | null;
  title?: string | null;
  headline?: string | null;
  address?: string | null;
  business_city?: string | null;
  business_state?: string | null;
  business_zip?: string | null;
  zip_code?: string | null;
  specialty?: string[] | null;
  zillow_profile_url?: string | null;
  sidebar_video_url?: string | null;
  social_facebook?: string | null;
  social_instagram?: string | null;
  social_linkedin?: string | null;
  social_twitter?: string | null;
  social_tiktok?: string | null;
  image_url?: string | null;
  profile_link?: string | null;
  short_code?: string | null;
  badges?: string[] | null;
  review_stars_rating?: number | null;
  num_total_reviews?: number | null;
  agent_sales_stats?: { volumeAllTime?: number } | null;
  average_value_3yr?: number | null;
}

export default function Step4ReviewFinal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);

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
        .select('*')
        .eq('verification_token', token)
        .single();

      if (error || !data) {
        navigate('/404');
        return;
      }

      setProfessional(data);
    } catch (err) {
      navigate('/404');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    toast.success('Profile confirmed!');
    window.location.assign(`/funnel/${token}/cities`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) return null;

  return (
    <>
      <SafeHead>
        <title>Review Your Profile | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 3 of 7</span>
                <span className="text-sm font-medium">Final Review</span>
              </div>
              <CardTitle>Does everything look correct?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review your information one last time before we move forward.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Information */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Contact Information</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/funnel/${token}/review-1`)}
                    className="gap-2"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </Button>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-medium w-24">Name:</dt>
                    <dd><span className="text-muted-foreground">(Request review to change)</span> {professional.name}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-24">Email:</dt>
                    <dd>{professional.email || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-24">Phone:</dt>
                    <dd>
                      {(() => {
                        const pn = professional.phone_numbers as any;
                        if (pn?.mobile?.number || pn?.business?.number || pn?.other?.number) {
                          const parts = [];
                          if (pn.mobile?.number) parts.push(`Mobile: ${pn.mobile.number}${pn.mobile.publish ? '' : ' (hidden)'}`);
                          if (pn.business?.number) parts.push(`Business: ${pn.business.number}${pn.business.publish ? '' : ' (hidden)'}`);
                          if (pn.other?.number) parts.push(`Other: ${pn.other.number}${pn.other.publish ? '' : ' (hidden)'}`);
                          return parts.join(' · ');
                        }
                        return professional.phone || 'Not provided';
                      })()}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-24">Company:</dt>
                    <dd>{professional.company || 'Not provided'}</dd>
                  </div>
                </dl>
              </div>

              {/* Professional Details */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Professional Details</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/funnel/${token}/review-2`)}
                    className="gap-2"
                  >
                    <Edit className="h-3 w-3" />
                    Edit
                  </Button>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">License:</dt>
                    <dd><span className="text-muted-foreground">(Request review to change)</span> {professional.license_number || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Experience:</dt>
                    <dd><span className="text-muted-foreground">(Request review to change)</span> {professional.years_experience ? `${professional.years_experience} years` : 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Total Sales:</dt>
                    <dd><span className="text-muted-foreground">(Request review to change)</span> {professional.total_sales ? `>${professional.total_sales.toLocaleString()}` : 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Website:</dt>
                    <dd>{professional.website || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Title:</dt>
                    <dd>{professional.title || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Headline:</dt>
                    <dd>{professional.headline || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Address:</dt>
                    <dd>
                      {professional.address || professional.business_city
                        ? [
                            professional.address,
                            [professional.business_city, professional.business_state, professional.business_zip || professional.zip_code].filter(Boolean).join(', ')
                          ].filter(Boolean).join(', ')
                        : 'Not provided'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Specialties:</dt>
                    <dd>{Array.isArray(professional.specialty) ? professional.specialty.join(', ') : 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Zillow URL:</dt>
                    <dd>{professional.zillow_profile_url || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">YouTube Video:</dt>
                    <dd>{professional.sidebar_video_url || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Social (FB/IG/LI):</dt>
                    <dd>
                      {[professional.social_facebook, professional.social_instagram, professional.social_linkedin].filter(Boolean).join(' · ') || 'Not provided'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Twitter/X:</dt>
                    <dd>{professional.social_twitter || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">TikTok:</dt>
                    <dd>{professional.social_tiktok || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Business Name:</dt>
                    <dd>{professional.business_name || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Profile Image:</dt>
                    <dd>Deprecated (no longer displayed)</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Profile Link:</dt>
                    <dd>{professional.profile_link || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Short Code:</dt>
                    <dd>{professional.short_code || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Badges:</dt>
                    <dd>{Array.isArray(professional.badges) ? professional.badges.join(', ') : 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Rating:</dt>
                    <dd>{professional.review_stars_rating ?? 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Review Count:</dt>
                    <dd>{professional.num_total_reviews?.toLocaleString() ?? 'Not provided'}</dd>
                  </div>
                  {(professional.agent_sales_stats?.volumeAllTime ?? professional.average_value_3yr) && (
                    <div className="flex gap-2">
                      <dt className="font-medium w-32">Volume (3yr):</dt>
                      <dd>
                        {(() => {
                          const v = professional.agent_sales_stats?.volumeAllTime ?? professional.average_value_3yr ?? 0;
                          if (v >= 1000000000) return `$${(v / 1000000000).toFixed(1)}B`;
                          if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
                          if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
                          return `$${v?.toLocaleString()}`;
                        })()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/funnel/${token}/review-2`)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleAccept}
                  className="flex-1 gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Looks Good - Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
