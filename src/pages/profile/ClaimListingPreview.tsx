import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Edit, 
  Loader2, 
  CheckCircle2, 
  Globe, 
  Mail, 
  Phone, 
  MapPin,
  Award,
  Star,
  Building2,
  Shield,
  Linkedin,
  Facebook,
  Instagram,
  ChevronDown
} from 'lucide-react';
import { getValidImageUrl } from '@/utils/imageUrlValidator';

interface NotableAchievement {
  title: string;
  description: string;
  source?: string;
  date?: string;
  credibility?: number;
}

interface Certification {
  designation: string;
  full_name: string;
}

interface PressMention {
  title: string;
  outlet?: string;
  url?: string;
  date?: string;
  credibilityScore?: number;
}

interface CommunityRole {
  organization: string;
  role: string;
  description?: string;
}

interface ProfessionalData {
  id: string;
  name: string;
  company: string | null;
  image_url: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  specialty: string[] | null;
  address: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license_number: string | null;
  license_verified_at: string | null;
  years_experience: number | null;
  total_sales: number | null;
  current_listings: number | null;
  synthesized_bio: string | null;
  get_to_know_me: string | null;
  social_linkedin: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_tiktok: string | null;
  notable_achievements: unknown;
  certifications_verified: unknown;
  press_mentions: unknown;
  community_roles: unknown;
  cities: {
    name: string;
    state: string;
    slug: string;
    state_slug: string;
  };
}

export default function ClaimListingPreview() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<ProfessionalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string>('');
  // Both sections collapsed by default to reduce page length
  const [editorialExpanded, setEditorialExpanded] = useState(false);
  const [agentStatementExpanded, setAgentStatementExpanded] = useState(false);

  // Test profile UUID for Robert Maynard
  const TEST_PROFILE_ID = '45415a04-dffe-46d0-96c6-fe8dbf6cebff';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const loadProfessional = async () => {
      const lookup = token || TEST_PROFILE_ID;

      try {
        let data: ProfessionalData | null = null;

        // Try by ID first
        const byId = await supabase
          .from('professionals')
          .select(`
            id, name, company, image_url, review_stars_rating, num_total_reviews,
            specialty, address, description, phone, email, website,
            license_number, license_verified_at, years_experience, total_sales, current_listings,
            synthesized_bio, get_to_know_me,
            social_linkedin, social_facebook, social_instagram, social_tiktok,
            notable_achievements, certifications_verified, press_mentions, community_roles,
            cities!inner(name, state, slug, state_slug)
          `)
          .eq('id', lookup)
          .maybeSingle();

        data = byId.data as ProfessionalData | null;

        // Fallback: try by verification_token
        if (!data) {
          const byToken = await supabase
            .from('professionals')
            .select(`
              id, name, company, image_url, review_stars_rating, num_total_reviews,
              specialty, address, description, phone, email, website,
              license_number, license_verified_at, years_experience, total_sales, current_listings,
              synthesized_bio, get_to_know_me,
              social_linkedin, social_facebook, social_instagram, social_tiktok,
              notable_achievements, certifications_verified, press_mentions, community_roles,
              cities!inner(name, state, slug, state_slug)
            `)
            .eq('verification_token', lookup)
            .maybeSingle();

          data = byToken.data as ProfessionalData | null;
        }

        if (!data) {
          setError('Profile not found');
          return;
        }

        setProfileId(data.id);
        setProfessional(data);
      } catch (err) {
        console.error('ClaimListingPreview loadProfessional error:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfessional();
  }, [token]);

  const handleFinish = () => {
    // Navigate to home or a success state
    navigate('/');
  };

  const handleContinueEditing = () => {
    navigate(`/profile/${profileId}/edit`);
  };

  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  const stripHtml = (html: string): string => {
    if (!html) return '';
    const withoutTags = html.replace(/<[^>]*>/g, '');
    if (typeof document === 'undefined') return withoutTags;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = withoutTags;
    return textarea.value;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{error || 'Unable to load profile'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const firstName = getFirstName(professional.name);
  const agentStatement = professional.get_to_know_me || professional.description;
  const hasSocialLinks = professional.social_linkedin || professional.social_facebook || 
                         professional.social_instagram || professional.social_tiktok;

  return (
    <>
      <Helmet>
        <title>Preview Your Profile | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            
            {/* Step Indicator & Header */}
            <div className="text-center mb-8">
              <p className="text-sm font-medium text-primary mb-2">Step 3 of 3</p>
              <h1 className="text-3xl md:text-4xl font-bold mb-3">
                Preview Your Public Profile
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                This is how your profile appears to consumers on Top10Lists.us. 
                You can continue editing at any time.
              </p>
            </div>

            {/* Profile Preview Card */}
            <Card className="mb-8 overflow-hidden">
              <CardContent className="p-0">
                
                {/* Profile Header */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 border-b">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                      <AvatarImage src={getValidImageUrl(professional.image_url)} alt={professional.name} />
                      <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                        {professional.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-2xl font-bold">{professional.name}</h2>
                        {professional.license_verified_at && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <Shield className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      {professional.company && (
                        <p className="text-muted-foreground flex items-center gap-1 mt-1">
                          <Building2 className="h-4 w-4" />
                          {professional.company}
                        </p>
                      )}
                      {professional.specialty && professional.specialty.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {professional.specialty.slice(0, 3).map((spec, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 1: Key Credentials & Metrics */}
                <div className="p-6 border-b">
                  <h3 className="font-semibold text-lg mb-4">Key Credentials & Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {professional.license_number && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Shield className="h-5 w-5 mx-auto mb-1 text-green-600" />
                        <p className="text-xs text-muted-foreground">License #</p>
                        <p className="font-medium text-sm">{professional.license_number}</p>
                        <p className="text-xs text-muted-foreground mt-1">Arizona DRE</p>
                      </div>
                    )}
                    {professional.years_experience && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Award className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-xs text-muted-foreground">Experience</p>
                        <p className="font-medium text-sm">{professional.years_experience} Years</p>
                      </div>
                    )}
                    {professional.total_sales && professional.total_sales > 0 && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Building2 className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-xs text-muted-foreground">Transactions</p>
                        <p className="font-medium text-sm">{professional.total_sales.toLocaleString()}</p>
                      </div>
                    )}
                    {professional.num_total_reviews && professional.num_total_reviews > 0 && (
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Star className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                        <p className="text-xs text-muted-foreground">Reviews</p>
                        <p className="font-medium text-sm">
                          {professional.review_stars_rating?.toFixed(1)} ({professional.num_total_reviews})
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Editorial Review (Collapsed by default) - Moved here */}
                {professional.synthesized_bio && (
                  <Collapsible open={editorialExpanded} onOpenChange={setEditorialExpanded}>
                    <div className="p-6 bg-blue-50/50 dark:bg-blue-950/20 border-b">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Award className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold text-lg">Top10Lists.us Editorial Review</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Written by Top10Lists.us based on publicly available data and editorial review.
                          </p>
                        </div>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-primary shrink-0">
                            {editorialExpanded ? "Hide" : "Show"}
                            <ChevronDown className={`h-4 w-4 ml-1 transition-transform duration-200 ${editorialExpanded ? "rotate-180" : ""}`} />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="pt-4">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <p className="text-foreground whitespace-pre-line leading-relaxed">
                            {stripHtml(professional.synthesized_bio)}
                          </p>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* Section: Agent Statement (Collapsed by default) - Moved here */}
                {agentStatement && (
                  <Collapsible open={agentStatementExpanded} onOpenChange={setAgentStatementExpanded}>
                    <div className="p-6 border-l-4 border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/10 border-b">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">From {firstName}</h3>
                          <p className="text-xs text-muted-foreground">
                            Statement provided by the agent.
                          </p>
                        </div>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-primary shrink-0">
                            {agentStatementExpanded ? "Hide" : "Show"}
                            <ChevronDown className={`h-4 w-4 ml-1 transition-transform duration-200 ${agentStatementExpanded ? "rotate-180" : ""}`} />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="pt-4">
                        <blockquote className="italic text-foreground whitespace-pre-line leading-relaxed">
                          "{stripHtml(agentStatement)}"
                        </blockquote>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                {/* Section: Notable Achievements & Awards */}
                {professional.notable_achievements && Array.isArray(professional.notable_achievements) && professional.notable_achievements.length > 0 && (
                  <div className="p-6 border-b">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Notable Achievements & Awards
                    </h3>
                    <div className="space-y-3">
                      {(professional.notable_achievements as NotableAchievement[])
                        .filter(a => a.credibility && a.credibility >= 7)
                        .slice(0, 5)
                        .map((achievement, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-medium text-sm">{achievement.title}</p>
                              {achievement.description && (
                                <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Section 3: Professional Certifications */}
                {professional.certifications_verified && Array.isArray(professional.certifications_verified) && professional.certifications_verified.length > 0 && (
                  <div className="p-6 border-b">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Professional Certifications
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(professional.certifications_verified as Certification[]).map((cert, i) => (
                        <Badge key={i} variant="outline" className="py-1.5">
                          <span className="font-semibold mr-1">{cert.designation}</span>
                          <span className="text-muted-foreground">- {cert.full_name}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 4: Press Mentions */}
                {professional.press_mentions && Array.isArray(professional.press_mentions) && professional.press_mentions.length > 0 && (
                  <div className="p-6 border-b">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      Press Mentions
                    </h3>
                    <div className="space-y-3">
                      {(professional.press_mentions as PressMention[]).slice(0, 5).map((mention, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                          <div>
                            {mention.url ? (
                              <a 
                                href={mention.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-medium text-sm text-primary hover:underline"
                              >
                                {mention.title}
                              </a>
                            ) : (
                              <p className="font-medium text-sm">{mention.title}</p>
                            )}
                            {mention.outlet && (
                              <p className="text-xs text-muted-foreground mt-1">{mention.outlet}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 5: Community Involvement */}
                {professional.community_roles && Array.isArray(professional.community_roles) && professional.community_roles.length > 0 && (
                  <div className="p-6 border-b">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Community Involvement
                    </h3>
                    <div className="space-y-3">
                      {(professional.community_roles as CommunityRole[]).slice(0, 5).map((role, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{role.role}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{role.organization}</p>
                            {role.description && (
                              <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 7: Areas of Focus */}
                {professional.specialty && professional.specialty.length > 0 && (
                  <div className="p-6 border-b">
                    <h3 className="font-semibold text-lg mb-4">Areas of Focus</h3>
                    <div className="flex flex-wrap gap-2">
                      {professional.specialty.map((spec, i) => (
                        <Badge key={i} variant="secondary">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 8: Featured City */}
                {professional.cities && (
                  <div className="p-6 border-b">
                    <h3 className="font-semibold text-lg mb-4">Featured City</h3>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {professional.cities.name}, {professional.cities.state}
                      </span>
                    </div>
                  </div>
                )}

                {/* Section 9: Contact & Online Presence */}
                <div className="p-6 border-b">
                  <h3 className="font-semibold text-lg mb-4">Contact & Online Presence</h3>
                  <div className="space-y-3">
                    {professional.website && (
                      <a 
                        href={professional.website.startsWith('http') ? professional.website : `https://${professional.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-primary hover:underline"
                      >
                        <Globe className="h-5 w-5" />
                        <span>{professional.website.replace(/^https?:\/\//, '')}</span>
                      </a>
                    )}
                    {professional.email && (
                      <a 
                        href={`mailto:${professional.email}`}
                        className="flex items-center gap-3 text-primary hover:underline"
                      >
                        <Mail className="h-5 w-5" />
                        <span>{professional.email}</span>
                      </a>
                    )}
                    {professional.phone && (
                      <a 
                        href={`tel:${professional.phone}`}
                        className="flex items-center gap-3 text-primary hover:underline"
                      >
                        <Phone className="h-5 w-5" />
                        <span>{professional.phone}</span>
                      </a>
                    )}
                    
                    {hasSocialLinks && (
                      <div className="pt-3 border-t mt-4">
                        <p className="text-sm text-muted-foreground mb-2">Social Profiles</p>
                        <div className="flex gap-3">
                          {professional.social_linkedin && (
                            <a 
                              href={professional.social_linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                            >
                              <Linkedin className="h-5 w-5" />
                            </a>
                          )}
                          {professional.social_facebook && (
                            <a 
                              href={professional.social_facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                            >
                              <Facebook className="h-5 w-5" />
                            </a>
                          )}
                          {professional.social_instagram && (
                            <a 
                              href={professional.social_instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                            >
                              <Instagram className="h-5 w-5" />
                            </a>
                          )}
                          {professional.social_tiktok && (
                            <a 
                              href={professional.social_tiktok}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                            >
                              <span className="text-sm font-bold">TT</span>
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                variant="outline"
                size="lg"
                onClick={handleContinueEditing}
                className="w-full sm:w-auto"
              >
                <Edit className="mr-2 h-5 w-5" />
                Continue Editing
              </Button>
              <Button
                size="lg"
                onClick={handleFinish}
                className="w-full sm:w-auto"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Finish
              </Button>
            </div>

            {/* Info Note */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              Your profile is now visible to consumers searching for top agents in your area.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
