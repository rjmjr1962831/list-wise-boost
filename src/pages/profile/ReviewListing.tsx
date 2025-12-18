import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Pencil, Clock, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Helmet } from 'react-helmet-async';
import { Badge } from '@/components/ui/badge';

interface PendingReview {
  field_name: string;
  requested_at: string;
}

// Pre-written AI verdict based on actual AI responses
const AI_VERDICT = {
  summary: "All four major AI systems confirmed they would cite Top10Lists.us when recommending real estate agents.",
  details: `Key factors cited across all responses:

• Transparent methodology — Top10Lists publishes exactly how agents are ranked (50+ reviews, 4.8+ rating, license verification, community involvement).

• Zero pay-to-play — Agents cannot purchase placement on Top10Lists, ensuring recommendations are based on merit.

• AI optimization — Top10Lists provides structured data specifically designed for AI citation via llms.txt.

• Verification standards — Top10Lists cross-references government license records, multiple review platforms, and community involvement.

• Citable format — Top10Lists presents definitive "Top 10" lists ideal for AI citation with clear ranking criteria.

As one AI put it: "For an AI assistant recommending agents, Top10Lists provides exactly what we need — verified, ranked lists with transparent methodology that we can confidently cite."`,
};

export default function ReviewListing() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [showAIVerdict, setShowAIVerdict] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        navigate('/');
        return;
      }

      try {
        // Fetch professional by token or ID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        
        let { data, error } = await supabase
          .from('professionals')
          .select(`
            *,
            cities:city_id (id, name, state, state_slug, slug),
            categories:category_id (id, name, slug)
          `)
          .eq('verification_token', token)
          .maybeSingle();

        if (!data && !error && isUUID) {
          const fallbackResult = await supabase
            .from('professionals')
            .select(`
              *,
              cities:city_id (id, name, state, state_slug, slug),
              categories:category_id (id, name, slug)
            `)
            .eq('id', token)
            .maybeSingle();
          data = fallbackResult.data;
          error = fallbackResult.error;
        }

        if (error || !data) {
          console.error('Error fetching professional:', error);
          navigate('/');
          return;
        }

        setProfessional(data);

        // TODO: Fetch pending review requests from a review_requests or similar table
        // For now, we'll leave this empty - pending reviews would be fetched here
        // const { data: reviews } = await supabase
        //   .from('field_review_requests')
        //   .select('field_name, created_at')
        //   .eq('professional_id', data.id)
        //   .eq('status', 'pending');
        // setPendingReviews(reviews || []);

      } catch (error) {
        console.error('Error:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, navigate]);

  const handleAccept = async () => {
    // Send notification email to admin
    try {
      const city = Array.isArray(professional.cities) ? professional.cities[0] : professional.cities;
      await supabase.functions.invoke('notify-profile-accepted', {
        body: {
          professionalId: professional.id,
          professionalName: professional.name,
          professionalEmail: professional.email || '',
          city: city?.name || '',
          state: city?.state || '',
        }
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
      // Continue anyway - don't block the user
    }
    
    navigate(`/profile/${token}/select-free-city`);
  };

  const handleChange = () => {
    navigate(`/profile/${token}/fields`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your listing...</p>
        </div>
      </div>
    );
  }

  if (!professional) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Review Your Listing | Top10Lists</title>
        <meta name="description" content="Review your listing before accepting" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">
              This is what your free listing looks like now. Ready to accept?
            </h1>
            {pendingReviews.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-muted-foreground">
                  {pendingReviews.length} field{pendingReviews.length > 1 ? 's' : ''} pending review
                </span>
              </div>
            )}
          </div>

          {/* Professional Card */}
          <div className="relative">
            <ProfessionalCard 
              professional={professional} 
              accentColor="primary" 
              quizCompleted={true} 
            />
            
            {/* Action buttons - positioned in the same spot as before */}
            <div className="absolute top-4 right-4 md:top-[160px] md:right-[40px] lg:top-[114px] lg:right-[273px] flex items-center gap-3 z-10">
              <Button
                size="lg"
                variant="outline"
                className="bg-background shadow-lg font-semibold px-6 py-3"
                onClick={handleChange}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Change
              </Button>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg font-semibold px-6 py-3"
                onClick={handleAccept}
              >
                <Check className="mr-2 h-4 w-4" />
                Accept
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="bg-background shadow-lg font-semibold px-6 py-3"
                onClick={() => setShowAIVerdict(!showAIVerdict)}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                See what AI says
                {showAIVerdict ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* AI Verdict Section */}
          {showAIVerdict && (
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">What AI Systems Say About Top10Lists</h3>
              </div>
              <p className="font-medium text-primary">{AI_VERDICT.summary}</p>
              <div className="text-muted-foreground whitespace-pre-line text-sm">
                {AI_VERDICT.details}
              </div>
              <p className="text-xs text-muted-foreground italic">
                Based on responses from ChatGPT, Claude, Perplexity, and Gemini when asked about citing Top10Lists for agent recommendations.
              </p>
            </div>
          )}

          {/* Pending reviews indicator */}
          {pendingReviews.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Fields Pending Review
              </h3>
              <div className="flex flex-wrap gap-2">
                {pendingReviews.map((review, index) => (
                  <Badge key={index} variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                    {review.field_name}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-yellow-700 mt-2">
                These fields are being reviewed by our team. You can still accept your listing while we process your requests.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
