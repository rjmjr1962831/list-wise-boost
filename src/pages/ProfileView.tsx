import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Loader2, MapPin, Briefcase, Star, Award, Mail, Phone, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Professional {
  id: string;
  name: string;
  title?: string;
  company?: string;
  business_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
  synthesized_bio?: string;
  image_url?: string;
  specialty?: string[];
  rank: number;
  years_experience?: number;
  num_total_reviews?: number;
  review_stars_rating?: number;
  current_listings?: number;
  total_sales?: number;
  is_brand_builder?: boolean;
  is_top_agent?: boolean;
  is_premier_agent?: boolean;
  city?: {
    name: string;
    state: string;
    slug: string;
  };
  category?: {
    name: string;
    plural_name: string;
  };
  city_rank?: number;
  total_in_city?: number;
}

export default function ProfileView() {
  const { token } = useParams<{ token: string }>();
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!token) {
      setError("Invalid magic link");
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error: funcError } = await supabase.functions.invoke(
          "validate-profile-token",
          { body: { token } }
        );

        if (funcError) throw funcError;

        if (!data.success) {
          throw new Error(data.error || "Failed to load profile");
        }

        setProfessional(data.professional);
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setError(err.message || "Invalid or expired magic link");
        toast({
          title: "Error",
          description: "Unable to load profile. Please check your link.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Profile Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error || "This magic link is invalid or has expired."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bio = professional.synthesized_bio || professional.description;

  return (
    <>
      <Helmet>
        <title>{professional.name} - Professional Profile | Top10Lists</title>
        <meta name="description" content={`View the professional profile of ${professional.name}`} />
        <meta name="robots" content="noindex, nofollow" />
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta http-equiv="Pragma" content="no-cache" />
        <meta http-equiv="Expires" content="0" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                {professional.image_url && (
                  <img
                    src={professional.image_url}
                    alt={professional.name}
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-primary/10"
                  />
                )}
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="text-3xl font-bold">{professional.name}</h1>
                      {professional.city_rank && (
                        <Badge variant="default" className="text-sm">
                          #{professional.city_rank} in {professional.city?.name}
                        </Badge>
                      )}
                    </div>
                    {professional.title && (
                      <p className="text-lg text-muted-foreground">{professional.title}</p>
                    )}
                    <p className="text-primary font-medium">
                      {professional.business_name || professional.company}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {professional.is_brand_builder && (
                      <Badge variant="secondary" className="gap-1">
                        <Award className="w-3 h-3" /> Brand Builder
                      </Badge>
                    )}
                    {professional.is_top_agent && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="w-3 h-3" /> Top Agent
                      </Badge>
                    )}
                    {professional.is_premier_agent && (
                      <Badge variant="secondary" className="gap-1">
                        <Award className="w-3 h-3" /> Premier Agent
                      </Badge>
                    )}
                  </div>

                  {/* Location */}
                  {professional.city && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{professional.city.name}, {professional.city.state}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Professional Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {professional.years_experience && (
                  <div>
                    <div className="text-2xl font-bold text-primary">{professional.years_experience}</div>
                    <div className="text-sm text-muted-foreground">Years Experience</div>
                  </div>
                )}
                {professional.num_total_reviews !== undefined && (
                  <div>
                    <div className="text-2xl font-bold text-primary">{professional.num_total_reviews}</div>
                    <div className="text-sm text-muted-foreground">Reviews</div>
                  </div>
                )}
                {professional.review_stars_rating && (
                  <div>
                    <div className="text-2xl font-bold text-primary flex items-center gap-1">
                      {professional.review_stars_rating}
                      <Star className="w-5 h-5 fill-primary" />
                    </div>
                    <div className="text-sm text-muted-foreground">Rating</div>
                  </div>
                )}
                {professional.total_sales !== undefined && professional.total_sales > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-primary">{professional.total_sales}</div>
                    <div className="text-sm text-muted-foreground">Total Sales</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bio Card */}
          {bio && (
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{bio}</p>
              </CardContent>
            </Card>
          )}

          {/* Specialties */}
          {professional.specialty && professional.specialty.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Specialties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {professional.specialty.map((spec, idx) => (
                    <Badge key={idx} variant="outline">{spec}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {professional.email && (
                <a
                  href={`mailto:${professional.email}`}
                  className="flex items-center gap-3 text-primary hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  {professional.email}
                </a>
              )}
              {professional.phone && (
                <a
                  href={`tel:${professional.phone}`}
                  className="flex items-center gap-3 text-primary hover:underline"
                >
                  <Phone className="w-4 h-4" />
                  {professional.phone}
                </a>
              )}
              {professional.website && (
                <a
                  href={professional.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-primary hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  Visit Website
                </a>
              )}
            </CardContent>
          </Card>

          {/* Ranking Context */}
          {professional.city_rank && professional.total_in_city && (
            <Card className="bg-primary/5">
              <CardContent className="pt-6">
                <p className="text-center text-sm text-muted-foreground">
                  <span className="font-semibold text-primary">#{professional.city_rank}</span> out of{" "}
                  <span className="font-semibold">{professional.total_in_city}</span>{" "}
                  {professional.category?.plural_name || "professionals"} in{" "}
                  <span className="font-semibold">{professional.city?.name}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
