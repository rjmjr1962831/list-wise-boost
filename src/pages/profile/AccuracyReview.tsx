import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, CheckCircle2, X, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { VerifiedFieldRow } from '@/components/profile/VerifiedFieldRow';
import FieldReviewRequestModal from '@/components/profile/FieldReviewRequestModal';
import { useFunnelTracking, FUNNEL_EVENTS } from '@/hooks/useFunnelTracking';
import { useToast } from '@/hooks/use-toast';

interface ProfessionalData {
  id: string;
  name: string;
  license_number: string | null;
  company: string | null;
  business_name: string | null;
  years_experience: number | null;
  total_sales: number | null;
  num_total_reviews: number | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  verification_token: string | null;
  state_slug: string | null;
  synthesized_bio: string | null;
}

export default function AccuracyReview() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trackEvent } = useFunnelTracking(token);
  
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<ProfessionalData | null>(null);
  const [showExpandedView, setShowExpandedView] = useState(false);
  const [confirmingAccuracy, setConfirmingAccuracy] = useState(false);
  
  // Modal state
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<{ name: string; value: string | null }>({ name: '', value: null });

  useEffect(() => {
    const fetchProfessional = async () => {
      if (!token) return;

      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        
        let { data, error } = await supabase
          .from('professionals')
          .select(`
            id, name, license_number, company, business_name, 
            years_experience, total_sales, num_total_reviews, 
            phone, website, email, verification_token, state_slug,
            synthesized_bio
          `)
          .eq('verification_token', token)
          .maybeSingle();

        // Fallback to UUID lookup
        if (!data && !error && isUUID) {
          const fallback = await supabase
            .from('professionals')
            .select(`
              id, name, license_number, company, business_name, 
              years_experience, total_sales, num_total_reviews, 
              phone, website, email, verification_token, state_slug,
              synthesized_bio
            `)
            .eq('id', token)
            .maybeSingle();
          data = fallback.data;
          error = fallback.error;
        }

        if (error) throw error;
        
        if (!data) {
          toast({
            title: 'Profile Not Found',
            description: 'This verification link is invalid or has expired.',
            variant: 'destructive'
          });
          return;
        }

        setProfessional(data);
        trackEvent(FUNNEL_EVENTS.ACCURACY_REVIEW_VIEWED);
        
        // Update funnel status
        await supabase
          .from('professionals')
          .update({ 
            funnel_status: 'accuracy_review_started',
            verification_started_at: new Date().toISOString()
          })
          .eq('id', data.id);

      } catch (err) {
        console.error('Error fetching professional:', err);
        toast({
          title: 'Error',
          description: 'Failed to load profile data.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfessional();
  }, [token, toast, trackEvent]);

  const handleRequestCorrection = (fieldName: string, currentValue: string | null) => {
    setSelectedField({ name: fieldName, value: currentValue });
    setCorrectionModalOpen(true);
    trackEvent(FUNNEL_EVENTS.FIELD_CORRECTION_CLICKED, { field: fieldName });
  };

  const handleConfirmAccuracy = async () => {
    if (!professional) return;
    
    setConfirmingAccuracy(true);
    try {
      await supabase
        .from('professionals')
        .update({ funnel_status: 'accuracy_confirmed' })
        .eq('id', professional.id);

      trackEvent(FUNNEL_EVENTS.ACCURACY_CONFIRMED);
      
      // Navigate to Step 2 (the streamlined onboarding/edit page)
      navigate(`/profile/${token}/edit`);
    } catch (err) {
      console.error('Error confirming accuracy:', err);
      toast({
        title: 'Error',
        description: 'Failed to confirm accuracy. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setConfirmingAccuracy(false);
    }
  };

  const formatPhone = (phone: string | null): string => {
    if (!phone) return 'Not listed';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatTransactionCount = (sales: number | null): string => {
    if (!sales) return 'Not disclosed';
    if (sales < 10) return `${sales} transactions`;
    const lowerBound = Math.floor(sales / 100) * 100;
    const upperBound = lowerBound + 100;
    if (lowerBound === 0) {
      return `${sales} transactions`;
    }
    return `${lowerBound.toLocaleString()} - ${upperBound.toLocaleString()} transactions`;
  };

  const formatReviewCount = (reviews: number | null): string => {
    if (!reviews) return 'Not disclosed';
    if (reviews < 10) return `${reviews} reviews`;
    const lowerBound = Math.floor(reviews / 10) * 10;
    const upperBound = lowerBound + 10;
    return `${lowerBound} - ${upperBound} reviews`;
  };

  const getStateAuthority = (stateSlug: string | null): string => {
    const stateNames: Record<string, string> = {
      'arizona': 'Arizona',
      'california': 'California',
      'texas': 'Texas',
      'new-mexico': 'New Mexico',
      'nevada': 'Nevada',
      'colorado': 'Colorado',
      'utah': 'Utah'
    };
    return stateSlug ? (stateNames[stateSlug] || stateSlug) : 'Unknown';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Profile not found or link has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profileLink = `https://www.top10lists.us/profile/${token}`;
  const licenseDisplay = professional.license_number 
    ? `${professional.license_number} (${getStateAuthority(professional.state_slug)})`
    : 'Not listed';

  return (
    <>
      <Helmet>
        <title>Review Profile Accuracy | Top10Lists</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Step 1 of 3
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Hello {professional.name?.split(' ')[0] || 'there'}
            </h1>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Review Profile for Accuracy
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              This profile is currently published using publicly available data. Please review the information below to confirm its accuracy or request corrections.
            </p>
          </div>

          {/* What This Step Does */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">What this step does</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>Allows you to confirm facts are accurate</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>Allows you to request corrections</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4 flex-shrink-0" />
                  <span>Does NOT create or activate your profile</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4 flex-shrink-0" />
                  <span>Does NOT require payment</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4 flex-shrink-0" />
                  <span>Does NOT affect your ranking or eligibility</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                If no action is taken, this profile remains published as shown based on public data.
              </p>
            </CardContent>
          </Card>

          {/* Verified Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verified Profile Information</CardTitle>
              <p className="text-sm text-muted-foreground">
                The following fields are displayed as currently published. Each item reflects publicly available information.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-border">
                <VerifiedFieldRow
                  label="Name"
                  value={professional.name}
                  onRequestCorrection={() => handleRequestCorrection('Name', professional.name)}
                />
                <VerifiedFieldRow
                  label="License number and issuing authority"
                  value={licenseDisplay}
                  onRequestCorrection={() => handleRequestCorrection('License Number', professional.license_number)}
                />
                <VerifiedFieldRow
                  label="Brokerage"
                  value={professional.company || professional.business_name}
                  onRequestCorrection={() => handleRequestCorrection('Brokerage', professional.company || professional.business_name)}
                />
                <VerifiedFieldRow
                  label="Years of experience"
                  value={professional.years_experience ? `${professional.years_experience} years` : null}
                  onRequestCorrection={() => handleRequestCorrection('Years of Experience', professional.years_experience?.toString() || null)}
                />
                <VerifiedFieldRow
                  label="Transaction count"
                  value={formatTransactionCount(professional.total_sales)}
                  onRequestCorrection={() => handleRequestCorrection('Transaction Count', professional.total_sales?.toString() || null)}
                />
                <VerifiedFieldRow
                  label="Review count"
                  value={formatReviewCount(professional.num_total_reviews)}
                  onRequestCorrection={() => handleRequestCorrection('Review Count', professional.num_total_reviews?.toString() || null)}
                />
                <VerifiedFieldRow
                  label="Phone number"
                  value={formatPhone(professional.phone)}
                  onRequestCorrection={() => handleRequestCorrection('Phone Number', professional.phone)}
                />
                <VerifiedFieldRow
                  label="Professional website"
                  value={professional.website}
                  onRequestCorrection={() => handleRequestCorrection('Website', professional.website)}
                  isLink={true}
                />
              </div>
            </CardContent>
          </Card>

          {/* Expanded View Toggle */}
          {professional.synthesized_bio && (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setShowExpandedView(!showExpandedView);
                  if (!showExpandedView) {
                    trackEvent(FUNNEL_EVENTS.EXPANDED_VIEW_OPENED);
                  }
                }}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
              >
                {showExpandedView ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide full synthesized profile
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    View full synthesized profile (optional)
                  </>
                )}
              </button>

              {showExpandedView && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Synthesized Profile</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      This is an AI-generated summary based on publicly available information. You can request changes in Step 2.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className="prose prose-sm max-w-none text-foreground whitespace-pre-line"
                      dangerouslySetInnerHTML={{ __html: professional.synthesized_bio || '' }}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Confirmation Statement */}
          <p className="text-sm text-center text-muted-foreground">
            By confirming, you are stating that the information above is accurate to the best of your knowledge.
          </p>

          {/* Action Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleConfirmAccuracy}
              disabled={confirmingAccuracy}
              size="lg"
            >
              {confirmingAccuracy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Disclosure Footer */}
          <p className="text-xs text-center text-muted-foreground pt-4 border-t">
            If you do not confirm accuracy or request corrections, this profile will remain published as-is using publicly available data.
          </p>
        </div>
      </div>

      {/* Correction Modal */}
      <FieldReviewRequestModal
        open={correctionModalOpen}
        onOpenChange={setCorrectionModalOpen}
        fieldName={selectedField.name}
        profileLink={profileLink}
        professionalName={professional.name}
        professionalId={professional.id}
        professionalEmail={professional.email || undefined}
        currentValue={selectedField.value || undefined}
      />
    </>
  );
}
