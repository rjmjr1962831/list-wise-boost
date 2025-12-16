import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function FreeCityConfirmation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState<string>('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchCityName = async () => {
      const cityId = searchParams.get('city');
      
      if (!cityId) {
        navigate(`/profile/${token}/select-free-city`);
        return;
      }

      try {
        const { data } = await supabase
          .from('cities')
          .select('name')
          .eq('id', cityId)
          .single();

        if (data) {
          setCityName(data.name);
        }
      } catch (error) {
        console.error('Error fetching city:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCityName();
  }, [token, searchParams, navigate]);

  const handleSeeOptions = () => {
    const cityId = searchParams.get('city');
    navigate(`/profile/${token}/how-it-works?city=${cityId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>You're All Set! | Top10Lists</title>
        <meta name="description" content="Your free listing is confirmed" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card className="border-primary/20">
            <CardContent className="pt-8 pb-10 px-8 text-center space-y-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl font-bold">
                  Awesome, you are all set for {cityName}!
                </h1>
                
                <p className="text-lg text-muted-foreground max-w-md mx-auto">
                  Your profile will appear in a round-robin format with other qualified agents when someone asks for a recommendation.
                </p>
              </div>

              <div className="pt-4">
                <Button 
                  size="lg" 
                  onClick={handleSeeOptions}
                  className="gap-2"
                >
                  <Sparkles className="h-5 w-5" />
                  Let Me See My Options
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
