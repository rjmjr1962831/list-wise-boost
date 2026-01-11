import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Star, ExternalLink, Phone, Mail, Globe, Award } from 'lucide-react';
import { getValidImageUrl } from '@/utils/imageUrlValidator';

interface VerifiedExpert {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  image_url: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  years_experience: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license_number: string | null;
  synthesized_bio: string | null;
  specialty: string[] | null;
  canonical_slug: string | null;
}

interface VerifiedExpertsSectionProps {
  neighborhoodSlug: string;
  citySlug: string;
  stateSlug: string;
  neighborhoodName: string;
}

export function VerifiedExpertsSection({ 
  neighborhoodSlug, 
  citySlug, 
  stateSlug,
  neighborhoodName 
}: VerifiedExpertsSectionProps) {
  const [experts, setExperts] = useState<VerifiedExpert[]>([]);
  const [loading, setLoading] = useState(true);
  const [neighborhoodId, setNeighborhoodId] = useState<string | null>(null);

  useEffect(() => {
    const fetchExperts = async () => {
      try {
        // First, get the neighborhood ID from the catalog
        const { data: neighborhood, error: neighborhoodError } = await supabase
          .from('neighborhood_catalog')
          .select('id')
          .eq('neighborhood_slug', neighborhoodSlug)
          .eq('city_area_slug', citySlug)
          .eq('is_active', true)
          .maybeSingle();

        if (neighborhoodError || !neighborhood) {
          console.log('[VerifiedExperts] Neighborhood not found:', neighborhoodSlug);
          setLoading(false);
          return;
        }

        setNeighborhoodId(neighborhood.id);

        // Query active subscriptions for this neighborhood with professional data
        const { data: subscriptions, error: subError } = await supabase
          .from('agent_neighborhood_subscriptions')
          .select(`
            professional_id,
            professionals (
              id,
              name,
              company,
              title,
              image_url,
              review_stars_rating,
              num_total_reviews,
              years_experience,
              phone,
              email,
              website,
              license_number,
              synthesized_bio,
              specialty,
              canonical_slug,
              active
            )
          `)
          .eq('neighborhood_id', neighborhood.id)
          .eq('is_active', true);

        if (subError) {
          console.error('[VerifiedExperts] Error fetching subscriptions:', subError);
          setLoading(false);
          return;
        }

        // Extract and filter active professionals
        const activeExperts = (subscriptions || [])
          .map((sub: any) => sub.professionals)
          .filter((prof: any) => prof && prof.active === true) as VerifiedExpert[];

        console.log(`[VerifiedExperts] Found ${activeExperts.length} verified experts for ${neighborhoodName}`);
        setExperts(activeExperts);
      } catch (error) {
        console.error('[VerifiedExperts] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExperts();
  }, [neighborhoodSlug, citySlug, neighborhoodName]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    );
  }

  if (experts.length === 0) {
    return null; // Don't show section if no verified experts
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">Verified Neighborhood Experts</h2>
        <Badge variant="secondary" className="ml-2">
          {experts.length} Expert{experts.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        These agents have been verified as specialists in {neighborhoodName} with proven local expertise.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {experts.map((expert) => (
          <ExpertCard 
            key={expert.id} 
            expert={expert} 
            stateSlug={stateSlug}
            citySlug={citySlug}
          />
        ))}
      </div>
    </div>
  );
}

function ExpertCard({ 
  expert, 
  stateSlug, 
  citySlug 
}: { 
  expert: VerifiedExpert; 
  stateSlug: string;
  citySlug: string;
}) {
  const imageUrl = getValidImageUrl(expert.image_url);
  const profileUrl = expert.canonical_slug 
    ? `/${stateSlug}/${citySlug}/top10realestateagents/${expert.canonical_slug}`
    : null;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-background hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={expert.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary/30"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/30">
                <span className="text-xl font-bold text-primary">
                  {expert.name.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{expert.name}</h3>
              <Badge variant="default" className="flex-shrink-0 text-xs">
                <Award className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            </div>

            {expert.company && (
              <p className="text-sm text-muted-foreground truncate">{expert.company}</p>
            )}

            {/* Rating */}
            {expert.review_stars_rating && expert.review_stars_rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{expert.review_stars_rating.toFixed(1)}</span>
                {expert.num_total_reviews && expert.num_total_reviews > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({expert.num_total_reviews} reviews)
                  </span>
                )}
              </div>
            )}

            {/* Experience */}
            {expert.years_experience && expert.years_experience > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {expert.years_experience}+ years experience
              </p>
            )}
          </div>
        </div>

        {/* Contact buttons */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-border/50">
          {profileUrl && (
            <a
              href={profileUrl}
              className="flex-1 flex items-center justify-center gap-1 text-sm py-2 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              View Profile
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {expert.phone && (
            <a
              href={`tel:${expert.phone}`}
              className="flex items-center justify-center p-2 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
              title="Call"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          {expert.email && (
            <a
              href={`mailto:${expert.email}`}
              className="flex items-center justify-center p-2 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
              title="Email"
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
          {expert.website && (
            <a
              href={expert.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center p-2 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
              title="Website"
            >
              <Globe className="h-4 w-4" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
