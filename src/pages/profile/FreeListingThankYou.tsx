import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PartyPopper, Home } from 'lucide-react';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import { Professional } from '@/types/professional';
import { ARIZONA_CITIES } from '@/data/arizonaCityPricing';

interface DBProfessional {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  description: string | null;
  synthesized_bio: string | null;
  image_url: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  years_experience: number | null;
  specialty: string[] | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  zillow_profile_url: string | null;
  rank: number;
  type: string;
  is_brand_builder: boolean | null;
  badges: string[] | null;
  notable_achievements: any;
  press_mentions: any;
  sidebar_video_url: string | null;
  professional_information: any;
  agent_sales_stats: any;
}

interface CityInfo {
  id: string;
  name: string;
  slug: string;
  state: string;
  state_slug: string;
}

function convertToDisplayProfessional(db: DBProfessional, rank: number): Professional {
  return {
    id: db.id,
    name: db.name,
    title: db.title || 'Real Estate Agent',
    company: db.company || '',
    description: db.description || '',
    image: db.image_url || '/placeholder.svg',
    rating: db.review_stars_rating || 0,
    reviews: db.num_total_reviews || 0,
    years_experience: db.years_experience || 0,
    specialties: db.specialty || [],
    website: db.website || '',
    phone: db.phone || '',
    email: db.email || '',
    address: db.address || '',
    rank: rank,
    stats: {
      yearsExperience: db.years_experience || 0,
      totalSales: (db.agent_sales_stats as any)?.countAllTime || 0,
    },
    verified: true,
    notable_achievements: db.notable_achievements || [],
    press_mentions: db.press_mentions || [],
    synthesized_bio: db.synthesized_bio || '',
  };
}

export default function FreeListingThankYou() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<DBProfessional | null>(null);
  const [cityInfo, setCityInfo] = useState<CityInfo | null>(null);
  const [otherAgents, setOtherAgents] = useState<DBProfessional[]>([]);

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
        // Fetch professional by token
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
        
        let { data: profData } = await supabase
          .from('professionals')
          .select('*')
          .eq('verification_token', token)
          .maybeSingle();

        if (!profData && isUUID) {
          const fallback = await supabase
            .from('professionals')
            .select('*')
            .eq('id', token)
            .maybeSingle();
          profData = fallback.data;
        }

        if (!profData) {
          navigate('/');
          return;
        }

        setProfessional(profData);

        // Fetch city info
        const { data: cityData } = await supabase
          .from('cities')
          .select('id, name, slug, state, state_slug')
          .eq('id', profData.city_id)
          .single();

        if (cityData) {
          setCityInfo(cityData);

          // Fetch other qualified agents from the same city (excluding current agent)
          const { data: sameCityAgents } = await supabase
            .from('professionals_public')
            .select('*')
            .eq('city_id', cityData.id)
            .eq('active', true)
            .neq('id', profData.id)
            .gte('review_stars_rating', 4.8)
            .gte('num_total_reviews', 50)
            .limit(9);

          let allAgents: DBProfessional[] = (sameCityAgents || []) as DBProfessional[];

          // If we don't have enough agents, fetch from same region
          if (allAgents.length < 9) {
            const cityPricing = ARIZONA_CITIES.find(c => c.citySlug === cityData.slug);
            if (cityPricing) {
              const regionCities = ARIZONA_CITIES
                .filter(c => c.region === cityPricing.region && c.citySlug !== cityData.slug)
                .map(c => c.citySlug);

              if (regionCities.length > 0) {
                // Get city IDs for the region
                const { data: regionCityData } = await supabase
                  .from('cities')
                  .select('id, slug')
                  .in('slug', regionCities);

                if (regionCityData && regionCityData.length > 0) {
                  const regionCityIds = regionCityData.map(c => c.id);
                  const existingIds = allAgents.map(a => a.id);
                  existingIds.push(profData.id);

                  const { data: regionAgents } = await supabase
                    .from('professionals_public')
                    .select('*')
                    .in('city_id', regionCityIds)
                    .eq('active', true)
                    .gte('review_stars_rating', 4.8)
                    .gte('num_total_reviews', 50)
                    .limit(9 - allAgents.length);

                  if (regionAgents) {
                    // Filter out duplicates
                    const newAgents = (regionAgents as DBProfessional[]).filter(
                      a => !existingIds.includes(a.id)
                    );
                    allAgents = [...allAgents, ...newAgents].slice(0, 9);
                  }
                }
              }
            }
          }

          setOtherAgents(allAgents);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, navigate]);

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

  if (!professional || !cityInfo) {
    return null;
  }

  // Combine the agent's card with other agents for display
  // Insert the user's card at a random position to simulate round-robin
  const randomPosition = Math.floor(Math.random() * Math.min(otherAgents.length + 1, 10));
  const displayAgents = [...otherAgents];
  displayAgents.splice(randomPosition, 0, professional);
  
  // Take only first 10 and assign ranks
  const rankedAgents = displayAgents.slice(0, 10);

  return (
    <>
      <Helmet>
        <title>Welcome to Top10Lists! | Your Listing is Live</title>
        <meta name="description" content="Your free listing is now active" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Success Header */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="pt-8 pb-8 text-center">
              <PartyPopper className="h-16 w-16 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-foreground mb-4">
                You're all set!
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Here's your <strong className="font-bold text-foreground">FREE</strong> listing. It will come up in round-robin listings in{' '}
                <span className="font-semibold text-foreground">{cityInfo.name}</span>{' '}
                immediately.
              </p>
              <Button
                size="lg"
                className="mt-6"
                onClick={() => navigate(`/profile/${token}/pricing`)}
              >
                Ok, let's do this.
              </Button>
            </CardContent>
          </Card>


          {/* Actions */}
          <Card>
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Homepage
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate(`/profile/${token}/fields`)}
                >
                  Edit My Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
