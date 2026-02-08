import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
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
  company: string | null;
  website: string | null;
  license_number: string | null;
  years_experience: number | null;
  total_sales: number | null;
  description: string | null;
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
    navigate(`/funnel/${token}/cities`);
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
      <Helmet>
        <title>Review Your Profile | Top10Lists.us</title>
      </Helmet>
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
                    <dd>{professional.name}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-24">Email:</dt>
                    <dd>{professional.email || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-24">Phone:</dt>
                    <dd>{professional.phone || 'Not provided'}</dd>
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
                    <dt className="font-medium w-32">Website:</dt>
                    <dd>{professional.website || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">License:</dt>
                    <dd>{professional.license_number || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Experience:</dt>
                    <dd>{professional.years_experience ? `${professional.years_experience} years` : 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium w-32">Total Sales:</dt>
                    <dd>{professional.total_sales || 'Not provided'}</dd>
                  </div>
                  {professional.description && (
                    <div className="pt-2">
                      <dt className="font-medium mb-1">About:</dt>
                      <dd className="text-muted-foreground">{professional.description}</dd>
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
