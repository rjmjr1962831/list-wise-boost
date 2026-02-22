import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowRight, ArrowLeft, HelpCircle, CheckCircle } from 'lucide-react';
import InlineReviewForm from '@/components/funnel/InlineReviewForm';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  profile_link: string | null;
  awards_verified: any[];
  notable_achievements: any[];
  press_mentions: any[];
  community_roles: any[];
}

type FieldKey = 'awards_verified' | 'notable_achievements' | 'press_mentions' | 'community_roles';

const sections: { field: FieldKey; label: string; description: string }[] = [
  { field: 'awards_verified',      label: 'Awards',                description: 'Verified awards and recognition we have on file for you.' },
  { field: 'notable_achievements', label: 'Notable Achievements',  description: 'Career milestones and accomplishments sourced from public data.' },
  { field: 'press_mentions',       label: 'Press Mentions',        description: 'Media coverage and publications that have featured you.' },
  { field: 'community_roles',      label: 'Community Involvement', description: 'Civic, nonprofit, and leadership roles we have verified.' },
];

function formatValue(field: FieldKey, data: any[]): string {
  if (!data || data.length === 0) return 'None on file';
  switch (field) {
    case 'awards_verified':
      return data.map(a => a.title || a.name || String(a)).join(', ');
    case 'notable_achievements':
      return data.map(a => a.title || String(a)).join('; ');
    case 'press_mentions':
      return data.map(p => {
        const hasTitle = p.title && !p.title.startsWith('Source ');
        return hasTitle ? p.title + ' (' + (p.source || '') + ')' : (p.source || p.url || '');
      }).join(', ');
    case 'community_roles':
      return data.map(r => typeof r === 'string' ? r : r.role || r.title || String(r)).join(', ');
    default:
      return String(data);
  }
}

export default function Step2bCredentials() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [reviewField, setReviewField] = useState<FieldKey | null>(null);
  const [submitted, setSubmitted] = useState<Set<FieldKey>>(new Set());

  useEffect(() => { loadProfessional(); }, [token]);

  const loadProfessional = async () => {
    if (!token) { navigate('/404'); return; }
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name, email, profile_link, awards_verified, notable_achievements, press_mentions, community_roles')
        .eq('verification_token', token)
        .single();
      if (error || !data) { navigate('/404'); return; }
      setProfessional(data as Professional);
    } catch { navigate('/404'); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  if (!professional) return null;

  return (
    <>
      <SafeHead>
        <title>Your Credentials | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Step 3 of 8</span>
                <span className="text-sm font-medium">Credentials {"&"} Background</span>
              </div>
              <CardTitle>Review your credentials on file</CardTitle>
              <p className="text-sm text-muted-foreground">
                This information was sourced from public records and third-party data. You cannot edit it directly. If anything is incorrect or missing, request a review and we will verify and update it.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {sections.map(({ field, label, description }) => {
                const value = formatValue(field, (professional as any)[field] || []);
                const hasData = ((professional as any)[field] || []).length > 0;
                const wasSubmitted = submitted.has(field);
                const isOpen = reviewField === field;

                return (
                  <div key={field} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground mb-1">{description}</p>
                        <div className={`rounded-md border px-3 py-2 text-sm ${hasData ? 'bg-muted/50' : 'bg-muted/20 text-muted-foreground italic'}`}>
                          {value}
                        </div>
                      </div>
                      <div className="shrink-0 mt-6">
                        {wasSubmitted ? (
                          <div className="flex items-center gap-1 text-xs text-green-700 font-medium px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Review requested
                          </div>
                        ) : !isOpen ? (
                          <Button type="button" variant="outline" size="sm" onClick={() => setReviewField(field)}>
                            <HelpCircle className="h-4 w-4 mr-1" />
                            Request review
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {isOpen && (
                      <InlineReviewForm
                        fieldName={label}
                        currentValue={value}
                        professionalId={professional.id}
                        professionalName={professional.name}
                        professionalEmail={professional.email || undefined}
                        profileLink={professional.profile_link || undefined}
                        onClose={() => setReviewField(null)}
                        onSubmitted={() => { setSubmitted(prev => new Set(prev).add(field)); setReviewField(null); }}
                      />
                    )}
                  </div>
                );
              })}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => navigate('/funnel/' + token + '/review-1')}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={() => navigate('/funnel/' + token + '/review-2')}>
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
