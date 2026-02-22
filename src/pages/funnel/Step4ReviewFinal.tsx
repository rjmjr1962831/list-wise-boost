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
  phone_numbers: any;
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
  profile_link?: string | null;
  review_stars_rating?: number | null;
  num_total_reviews?: number | null;
  agent_sales_stats?: { volumeAllTime?: number } | null;
  average_value_3yr?: number | null;
  awards_verified?: any[];
  notable_achievements?: any[];
  press_mentions?: any[];
  community_roles?: any[];
  state_slug?: string | null;
  license_state?: string | null;
}

function ReviewRequested() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium px-2 py-0.5 bg-green-50 border border-green-200 rounded-md ml-2">
      <CheckCircle className="h-3 w-3" />
      Review requested
    </span>
  );
}

function formatCredentialList(items: any[], field: string): string {
  if (!items || items.length === 0) return 'None on file';
  switch (field) {
    case 'awards_verified':
      return items.map(a => a.title || a.name || String(a)).join(', ');
    case 'notable_achievements':
      return items.map(a => a.title || String(a)).join('; ');
    case 'press_mentions':
      return items.map(p => {
        const hasTitle = p.title && !p.title.startsWith('Source ');
        return hasTitle ? p.title + ' (' + (p.source || '') + ')' : (p.source || p.url || '');
      }).join(', ');
    case 'community_roles':
      return items.map(r => typeof r === 'string' ? r : r.role || r.title || String(r)).join(', ');
    default:
      return String(items);
  }
}

export default function Step4ReviewFinal() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [reviewedFields, setReviewedFields] = useState<Set<string>>(new Set());

  useEffect(() => { loadData(); }, [token]);

  const loadData = async () => {
    if (!token) { navigate('/404'); return; }
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('verification_token', token)
        .single();
      if (error || !data) { navigate('/404'); return; }
      setProfessional(data);

      // Load any pending review requests for this professional
      const { data: requests } = await supabase
        .from('field_change_requests')
        .select('field_name')
        .eq('professional_id', data.id)
        .eq('status', 'pending');

      if (requests) {
        setReviewedFields(new Set(requests.map((r: any) => r.field_name)));
      }
    } catch { navigate('/404'); }
    finally { setLoading(false); }
  };

  const reviewed = (fieldName: string) => reviewedFields.has(fieldName);

  const handleAccept = () => {
    toast.success('Profile confirmed!');
    const prof = professional as Record<string, unknown>;
    navigate(`/funnel/${token}/cities`, {
      state: {
        professionalId: prof.id,
        state_slug: prof.state_slug,
        license_state: prof.license_state,
        professional: {
          id: prof.id, name: prof.name,
          years_experience: prof.years_experience,
          total_sales: prof.total_sales,
          num_total_reviews: prof.num_total_reviews,
          review_stars_rating: prof.review_stars_rating,
          license_number: prof.license_number,
          license_state: prof.license_state,
          state_slug: prof.state_slug,
          community_roles: prof.community_roles,
          agent_sales_stats: prof.agent_sales_stats,
        },
      },
    });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!professional) return null;

  const phoneDisplay = (() => {
    const pn = professional.phone_numbers as any;
    if (pn?.mobile?.number || pn?.business?.number || pn?.other?.number) {
      const parts: string[] = [];
      if (pn.mobile?.number) parts.push(`Mobile: ${pn.mobile.number}${pn.mobile.publish ? '' : ' (hidden)'}`);
      if (pn.business?.number) parts.push(`Business: ${pn.business.number}${pn.business.publish ? '' : ' (hidden)'}`);
      if (pn.other?.number) parts.push(`Other: ${pn.other.number}${pn.other.publish ? '' : ' (hidden)'}`);
      return parts.join(' · ');
    }
    return professional.phone || 'Not provided';
  })();

  const addressDisplay = professional.address || professional.business_city
    ? [professional.address, [professional.business_city, professional.business_state, professional.business_zip || professional.zip_code].filter(Boolean).join(', ')].filter(Boolean).join(', ')
    : 'Not provided';

  const volumeDisplay = (() => {
    const v = professional.agent_sales_stats?.volumeAllTime ?? professional.average_value_3yr;
    if (!v) return null;
    if (v >= 1000000000) return `$${(v / 1000000000).toFixed(1)}B`;
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  })();

  const Row = ({ label, value, fieldName, width = 'w-32' }: { label: string; value: string | null | undefined; fieldName?: string; width?: string }) => (
    <div className="flex gap-2 items-start">
      <dt className={`font-medium ${width} shrink-0`}>{label}:</dt>
      <dd className="flex-1 flex items-center flex-wrap gap-1">
        {value || 'Not provided'}
        {fieldName && reviewed(fieldName) && <ReviewRequested />}
      </dd>
    </div>
  );

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
                <span className="text-sm text-muted-foreground">Step 5 of 8</span>
                <span className="text-sm font-medium">Final Review</span>
              </div>
              <CardTitle>Does everything look correct?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review your information before we move forward. Fields marked with a green badge have a pending review request.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Contact Information */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Contact Information</h3>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/funnel/${token}/review-1`)} className="gap-2">
                    <Edit className="h-3 w-3" />Edit
                  </Button>
                </div>
                <dl className="space-y-2 text-sm">
                  <Row label="Name"    value={professional.name}    fieldName="Full Name" width="w-24" />
                  <Row label="Email"   value={professional.email}                         width="w-24" />
                  <Row label="Phone"   value={phoneDisplay}                                width="w-24" />
                  <Row label="Company" value={professional.company}                        width="w-24" />
                </dl>
              </div>

              {/* Credentials & Background */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Credentials {"&"} Background</h3>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/funnel/${token}/review-credentials`)} className="gap-2">
                    <Edit className="h-3 w-3" />Edit
                  </Button>
                </div>
                <dl className="space-y-2 text-sm">
                  <Row label="Awards"               value={formatCredentialList(professional.awards_verified || [], 'awards_verified')}           fieldName="Awards" />
                  <Row label="Achievements"          value={formatCredentialList(professional.notable_achievements || [], 'notable_achievements')} fieldName="Notable Achievements" />
                  <Row label="Press Mentions"        value={formatCredentialList(professional.press_mentions || [], 'press_mentions')}            fieldName="Press Mentions" />
                  <Row label="Community Involvement" value={formatCredentialList(professional.community_roles || [], 'community_roles')}          fieldName="Community Involvement" />
                </dl>
              </div>

              {/* Professional Details */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Professional Details</h3>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/funnel/${token}/review-2`)} className="gap-2">
                    <Edit className="h-3 w-3" />Edit
                  </Button>
                </div>
                <dl className="space-y-2 text-sm">
                  <Row label="License"     value={professional.license_number}                                                                      fieldName="License Number" />
                  <Row label="Experience"  value={professional.years_experience ? `${professional.years_experience} years` : null}                  fieldName="Years of Experience" />
                  <Row label="Total Sales" value={professional.total_sales ? `${professional.total_sales.toLocaleString()}+` : null}                fieldName="Total Sales" />
                  <Row label="Rating"      value={professional.review_stars_rating ? `${professional.review_stars_rating} stars` : null}            fieldName="Reviews" />
                  <Row label="Reviews"     value={professional.num_total_reviews ? `${professional.num_total_reviews.toLocaleString()} reviews` : null} />
                  {volumeDisplay && <Row label="Volume (3yr)" value={volumeDisplay} />}
                  <Row label="Website"     value={professional.website} />
                  <Row label="Title"       value={professional.title} />
                  <Row label="Headline"    value={professional.headline} />
                  <Row label="Address"     value={addressDisplay} />
                  <Row label="Specialties" value={Array.isArray(professional.specialty) ? professional.specialty.join(', ') : null} />
                  {professional.social_facebook || professional.social_instagram || professional.social_linkedin ? (
                    <Row label="Social" value={[professional.social_facebook, professional.social_instagram, professional.social_linkedin].filter(Boolean).join(' · ')} />
                  ) : null}
                  {professional.social_twitter && <Row label="Twitter/X" value={professional.social_twitter} />}
                  {professional.social_tiktok  && <Row label="TikTok"   value={professional.social_tiktok} />}
                  {professional.zillow_profile_url && <Row label="Zillow URL" value={professional.zillow_profile_url} />}
                  {professional.sidebar_video_url  && <Row label="YouTube"   value={professional.sidebar_video_url} />}
                </dl>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => navigate(`/funnel/${token}/review-2`)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />Back
                </Button>
                <Button onClick={handleAccept} className="flex-1 gap-2">
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
