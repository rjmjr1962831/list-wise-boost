import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import CityAutocomplete from '@/components/profile/CityAutocomplete';
import { 
  Loader2, CheckCircle, Lock, Pencil, X, Check, 
  Globe, Phone, Mail, MapPin, Star, Shield, 
  ExternalLink, Upload, Video, Building2, FileText, Tag, LogOut, Award, MessageSquare
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SpecialtyEditModal from '@/components/profile/SpecialtyEditModal';

// Bio Preview component with ...more expander
const BioPreview = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const cleanText = stripHtml(text);
  const maxLength = 600;
  const needsTruncation = cleanText.length > maxLength;
  const displayText = expanded ? cleanText : cleanText.slice(0, maxLength);

  return (
    <div className="bg-muted/50 rounded-md p-4 text-sm text-foreground">
      <span className="whitespace-pre-line">
        {displayText}
        {needsTruncation && (
          <span
            onClick={() => setExpanded(!expanded)}
            className="text-primary cursor-pointer hover:underline font-medium ml-1"
          >
            {expanded ? "less" : "...more"}
          </span>
        )}
      </span>
    </div>
  );
};
import { toast } from 'sonner';
import FieldReviewRequestModal from '@/components/profile/FieldReviewRequestModal';
import { cn } from '@/lib/utils';
import { ProfessionalCard } from '@/components/ProfessionalCard';
import type { Professional } from '@/types/professional';

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function convertToDisplayProfessional(db: any, rank: number): Professional {
  const agentStats = (db as any)?.agent_sales_stats;
  return ({
    ...(db || {}),
    id: db.id,
    name: db.name,
    title: db.title || 'Real Estate Agent',
    company: db.company || db.business_name || '',
    rating: toNum(db.review_stars_rating) || 0,
    reviews: toNum(db.num_total_reviews) || 0,
    specialties: db.specialty || [],
    address: db.address || '',
    phone: db.phone || '',
    email: db.email || '',
    website: db.website || '',
    description: db.description || '',
    stats: {
      yearsExperience: toNum(db.years_experience) || 0,
      totalSales: toNum(db.total_sales) || toNum(agentStats?.countAllTime) || 0,
    },
    verified: true,
    image: db.image_url || '/placeholder.svg',
    notable_achievements: db.notable_achievements || [],
    press_mentions: db.press_mentions || [],
    publications: db.publications || [],
    community_roles: db.community_roles || [],
    certifications_verified: db.certifications_verified || [],
    awards_verified: db.awards_verified || [],
    synthesized_bio: db.synthesized_bio || '',
    get_to_know_me: db.get_to_know_me || '',
    years_experience: db.years_experience || null,
    total_sales: db.total_sales || null,
    current_listings: db.current_listings || null,
    rank,
  } as unknown) as Professional;
}

// AI Proof Block Component - Always visible, no click required
const AIProofBlock = () => {
  const aiResponses = [
    {
      name: 'ChatGPT',
      response: 'Yes, I would cite top10lists.us for real estate agent recommendations.'
    },
    {
      name: 'Claude',
      response: 'Yes, I would likely cite Top10Lists.us based on its transparent methodology and editorial independence.'
    },
    {
      name: 'Perplexity',
      response: 'Yes, I would cite Top10Lists.us for real estate agent recommendations in your city.'
    },
    {
      name: 'Gemini',
      response: 'Yes, I would cite top10lists.us as a potential source for real estate agent recommendations.'
    }
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🤖</span>
          <h2 className="text-xl font-bold text-foreground">4 of 4 AI Systems Cite Top10Lists.us</h2>
        </div>
        
        <p className="text-muted-foreground mb-6 italic border-b border-primary/20 pb-4">
          "I am a real estate agent. When someone asks for a recommendation for an agent in my city, will you cite top10lists.us?"
        </p>
        
        <div className="space-y-4">
          {aiResponses.map((ai) => (
            <div key={ai.name} className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold text-foreground">{ai.name}:</span>
                <span className="text-muted-foreground ml-2">"{ai.response}"</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <a 
            href="/test" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1 text-sm"
          >
            See Full Test Results <ExternalLink className="h-3 w-3" />
          </a>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <span>⚡</span>
            <span>You're on this list. Make sure your info is right.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Editable field component with inline editing
interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  type?: 'text' | 'textarea' | 'url' | 'email' | 'tel';
  placeholder?: string;
  icon?: React.ReactNode;
}

const EditableField = ({ label, value, onSave, type = 'text', placeholder, icon }: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }
    
    setSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving field:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <div className="flex gap-2">
          {type === 'textarea' ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              className="flex-1"
              rows={4}
              autoFocus
            />
          ) : (
            <Input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={placeholder}
              className="flex-1"
              autoFocus
            />
          )}
          <div className="flex flex-col gap-1">
            <Button size="icon" variant="ghost" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-500" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Truncation logic for long text fields
  const [expanded, setExpanded] = useState(false);
  const maxLength = 600;
  const needsTruncation = type === 'textarea' && value && value.length > maxLength;
  const displayValue = needsTruncation && !expanded ? value.slice(0, maxLength) : value;

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div 
      className="group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => setIsEditing(true)}
    >
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={cn("text-sm whitespace-pre-line", value ? "text-foreground" : "text-muted-foreground italic")}>
          {displayValue || placeholder || 'Click to add...'}
          {needsTruncation && (
            <span
              onClick={handleExpand}
              className="text-primary cursor-pointer hover:underline font-medium ml-1"
            >
              {expanded ? "less" : "...more"}
            </span>
          )}
        </div>
      </div>
      <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

// Locked field component for verified fields
interface LockedFieldProps {
  label: string;
  value: string | number | null;
  fieldKey: string;
  professionalId: string;
  professionalName: string;
  professionalEmail?: string;
  profileLink: string;
}

const LockedField = ({ label, value, fieldKey, professionalId, professionalName, professionalEmail, profileLink }: LockedFieldProps) => {
  const [showModal, setShowModal] = useState(false);
  const displayValue = value?.toString() || 'NA';

  return (
    <>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-sm font-medium text-foreground">{displayValue}</div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowModal(true)}
          className="text-xs text-primary hover:text-primary/80"
        >
          Request Review
        </Button>
      </div>
      
      <FieldReviewRequestModal
        open={showModal}
        onOpenChange={setShowModal}
        fieldName={label}
        profileLink={profileLink}
        professionalName={professionalName}
        professionalId={professionalId}
        professionalEmail={professionalEmail}
        currentValue={displayValue}
      />
    </>
  );
};

// Synthesized Bio Section with its own review modal
interface SynthesizedBioSectionProps {
  bio: string;
  professionalId: string;
  professionalName: string;
  professionalEmail: string;
  profileLink: string;
}

const SynthesizedBioSection = ({ bio, professionalId, professionalName, professionalEmail, profileLink }: SynthesizedBioSectionProps) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">Your AI-Generated Profile</h4>
          <Badge variant="secondary" className="text-xs">Our Synthesis</Badge>
        </div>
        <BioPreview text={bio} />
        <p className="text-xs text-muted-foreground mt-2">
          This bio was generated based on our research.{' '}
          <span
            onClick={() => setShowModal(true)}
            className="text-primary cursor-pointer hover:underline font-medium"
          >
            Request Review
          </span>{' '}
          to suggest changes.
        </p>
      </div>
      
      <FieldReviewRequestModal
        open={showModal}
        onOpenChange={setShowModal}
        fieldName="AI-Generated Bio"
        profileLink={profileLink}
        professionalName={professionalName}
        professionalId={professionalId}
        professionalEmail={professionalEmail}
        currentValue={bio}
      />
    </>
  );
};

// Main component
export default function StreamlinedOnboarding() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [cities, setCities] = useState<any[]>([]);
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimedCityName, setClaimedCityName] = useState('');
  const [showValidationError, setShowValidationError] = useState(false);
  const [pendingReviewRequests, setPendingReviewRequests] = useState<any[]>([]);
  const [showSpecialtyModal, setShowSpecialtyModal] = useState(false);
  
  // 3-step flow: 'card' (view card) -> 'edit' (edit fields) -> 'review' (review & approve)
  const [funnelStep, setFunnelStep] = useState<'card' | 'edit' | 'review'>('card');

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [token]);

  // Load pending review requests when professional is loaded
  useEffect(() => {
    const loadPendingRequests = async () => {
      if (!professional?.id) return;
      
      const { data } = await supabase
        .from('field_change_requests')
        .select('*')
        .eq('professional_id', professional.id)
        .eq('status', 'pending');
      
      setPendingReviewRequests(data || []);
    };
    
    loadPendingRequests();
  }, [professional?.id]);

  const loadData = async () => {
    if (!token) {
      navigate('/');
      return;
    }

    try {
      // Fetch professional by token or ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
      
      let { data: profData, error } = await supabase
        .from('professionals')
        .select(`
          *,
          cities:city_id (id, name, state, state_slug, slug),
          categories:category_id (id, name, slug)
        `)
        .eq('verification_token', token)
        .maybeSingle();

      if (!profData && !error && isUUID) {
        const fallback = await supabase
          .from('professionals')
          .select(`
            *,
            cities:city_id (id, name, state, state_slug, slug),
            categories:category_id (id, name, slug)
          `)
          .eq('id', token)
          .maybeSingle();
        profData = fallback.data;
        error = fallback.error;
      }

      if (error || !profData) {
        console.error('Error fetching professional:', error);
        navigate('/');
        return;
      }

      setProfessional(profData);
      setEmail(profData.email || '');

      // Update funnel status
      await supabase
        .from('professionals')
        .update({ 
          funnel_started_at: new Date().toISOString(),
          funnel_status: 'onboarding_started' 
        })
        .eq('id', profData.id)
        .is('funnel_started_at', null);

      // Fetch available cities (excluding sold-out ones)
      const { data: citiesData } = await supabase
        .from('cities')
        .select('id, name, slug, state')
        .eq('active', true)
        .eq('state', 'Arizona')
        .order('name');

      // Get brand builder counts to identify sold-out cities
      const { data: brandBuilderCounts } = await supabase
        .from('professionals')
        .select('city_id')
        .eq('is_brand_builder', true)
        .eq('active', true);

      const countMap: Record<string, number> = {};
      brandBuilderCounts?.forEach(p => {
        countMap[p.city_id] = (countMap[p.city_id] || 0) + 1;
      });

      // Filter out sold-out cities (10+ brand builders)
      const availableCities = citiesData?.filter(city => 
        (countMap[city.id] || 0) < 10
      ) || [];

      setCities(availableCities);

    } catch (err) {
      console.error('Error loading data:', err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const saveField = useCallback(async (field: string, value: string) => {
    if (!professional?.id) return;
    
    const { error } = await supabase
      .from('professionals')
      .update({ [field]: value })
      .eq('id', professional.id);

    if (error) {
      toast.error('Failed to save changes');
      throw error;
    }

    setProfessional((prev: any) => ({ ...prev, [field]: value }));
    toast.success('Saved');
  }, [professional?.id]);

  const saveSpecialties = useCallback(async (specialties: string[]) => {
    if (!professional?.id) return;
    
    const { error } = await supabase
      .from('professionals')
      .update({ specialty: specialties })
      .eq('id', professional.id);

    if (error) {
      toast.error('Failed to save specialties');
      return;
    }

    setProfessional((prev: any) => ({ ...prev, specialty: specialties }));
    toast.success('Specialties saved');
  }, [professional?.id]);

  const handleClaim = async () => {
    console.log('handleClaim called', { selectedCityId, email, professionalId: professional?.id });
    
    if (!selectedCityId) {
      toast.error('Please select a city');
      return;
    }
    
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    if (!professional?.id) {
      toast.error('Professional data not loaded. Please refresh and try again.');
      console.error('handleClaim: professional.id is missing', professional);
      return;
    }

    setClaiming(true);

    try {
      const selectedCity = cities.find(c => c.id === selectedCityId);
      console.log('Updating professional with city:', selectedCity?.name);
      
      // Update professional with selected city and trigger email verification
      const { error: updateError } = await supabase
        .from('professionals')
        .update({ 
          city_id: selectedCityId,
          email: email,
          is_brand_builder: true,
          funnel_status: 'claim_initiated',
          funnel_completed_at: new Date().toISOString()
        })
        .eq('id', professional.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      console.log('Database updated, sending verification email...');

      // Send custom magic link email via Resend - redirect to dashboard
      const redirectUrl = `https://top10lists.us/dashboard`;
      
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-funnel-verification', {
        body: {
          email,
          name: professional.name,
          firstName: professional.name?.split(' ')[0] || 'Agent',
          verificationUrl: redirectUrl,
          professionalId: professional.id,
        },
      });

      if (emailError) {
        console.error('Email sending error:', emailError);
        throw emailError;
      }

      console.log('Email sent successfully', emailData);

      setClaimedCityName(selectedCity?.name || '');
      setClaimed(true);
      toast.success('Check your email for a verification link!');

    } catch (err: any) {
      console.error('Error claiming listing:', err);
      toast.error(err.message || 'Failed to claim listing. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  const getProfileLink = () => {
    return professional?.profile_link || `https://top10lists.us/p/${professional?.short_code || token}`;
  };

  const firstName = professional?.name?.split(' ')[0] || 'Agent';
  const profileImage = professional?.image_url || '/placeholder.svg';

  // Helper to strip HTML
  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  };

  const bio = stripHtml(professional?.synthesized_bio || professional?.get_to_know_me || professional?.description || '');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Success view after final approval
  // Get selected city details for the success page link
  const getSelectedCityForLink = () => {
    const selectedCity = cities.find(c => c.id === selectedCityId);
    if (selectedCity) {
      return selectedCity;
    }
    return null;
  };

  if (claimed) {
    const selectedCity = getSelectedCityForLink();
    const listUrl = selectedCity 
      ? `/arizona/${selectedCity.slug}/best-real-estate-agents?highlight=${professional?.id}`
      : null;

    return (
      <>
        <Helmet>
          <title>You're All Set! | Top10Lists.us</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="p-8 bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="space-y-6">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h1 className="text-3xl font-bold text-foreground">
                  You're all set.
                </h1>
                <p className="text-xl text-muted-foreground">
                  Welcome to the most exclusive club in real estate.
                </p>
                <p className="text-lg text-muted-foreground">
                  Watch for important emails from us.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mt-4">
                  {listUrl && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(listUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      See how you appear in a list
                    </Button>
                  )}
                  <Button
                    variant="link"
                    onClick={() => navigate(`/profile/${token}/how-it-works`)}
                    className="text-primary"
                  >
                    How do I get more cities?
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  // Preview view before final approval (Step 3: Review)
  if (funnelStep === 'review') {
    const selectedCity = cities.find(c => c.id === selectedCityId);
    
    return (
      <>
        <Helmet>
          <title>Review Your Profile | Top10Lists.us</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Step 3 of 3:</span> Review & Approve
            </div>
            
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                Review Your Profile
              </h1>
              <p className="text-lg text-muted-foreground">
                This is how you'll appear in our recommendation engine
              </p>
              <p className="text-sm text-muted-foreground">
                Scroll to the bottom to edit or approve it.
              </p>
              {pendingReviewRequests.length > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Some fields are pending review. We'll get back to you in 24 hours.
                </p>
              )}
            </div>

            {/* Profile Preview Card - Fully Enriched */}
            <div className="space-y-6">
              {/* Selected City */}
              <div className="p-4 rounded-xl border bg-card">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">Listed in</div>
                    <div className="font-semibold text-foreground">
                      {selectedCity?.name || 'Select a city'}, {selectedCity?.state || 'Arizona'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Professional Card (expanded) */}
              {professional && (
                <ProfessionalCard
                  professional={convertToDisplayProfessional(professional, 1)}
                  market={selectedCity ? `${selectedCity.name}, ${selectedCity.state_slug?.toUpperCase() || 'AZ'}` : ''}
                  stateAbbr={selectedCity?.state_slug?.toUpperCase() || 'AZ'}
                  citySlug={selectedCity?.slug}
                  categorySlug={(professional as any)?.categories?.slug || 'top10realestateagents'}
                  quizCompleted={true}
                  expandSections={true}
                />
              )}

              {/* Fields Pending Review */}
              {pendingReviewRequests.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <h2 className="text-lg font-semibold">Fields Pending Review</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      For those fields that need review, we’ll get back to you in 24 hours.
                    </p>
                    <ul className="space-y-2">
                      {pendingReviewRequests.map((req) => (
                        <li key={req.id} className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{req.field_name}:</span> {req.change_request}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="outline" 
                onClick={() => {
                  setFunnelStep('edit');
                  window.scrollTo(0, 0);
                }}
                className="sm:min-w-[150px]"
              >
                Go Back to Edit
              </Button>
              <Button 
                onClick={handleClaim}
                disabled={claiming}
                className="sm:min-w-[150px]"
              >
                {claiming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve'
                )}
              </Button>
            </div>

          </div>
        </div>
      </>
    );
  }

  // Step 1: Card View - Show the profile card first
  if (funnelStep === 'card') {
    const selectedCity = cities.find(c => c.id === selectedCityId) || professional?.cities;
    
    return (
      <>
        <Helmet>
          <title>Welcome {firstName} | Top10Lists.us</title>
          <meta name="description" content="Review your professional listing on Top10Lists.us" />
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
          {/* Top Bar with Profile Dropdown */}
          <div className="max-w-4xl mx-auto px-4 pt-4">
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-muted transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarImage 
                        src={professional?.image_url} 
                        alt={professional?.name || 'Profile'} 
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {firstName?.[0]?.toUpperCase() || 'A'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground hidden sm:inline">
                      {firstName}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem 
                    onClick={() => {
                      navigate('/');
                      toast.success('Signed out successfully');
                    }}
                    className="text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
            
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Step 1 of 3:</span> Review your card
            </div>
            
            {/* Hero */}
            <div className="text-center space-y-4">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Hello {firstName}. <span className="text-primary">AI has been looking forward to meeting you.</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                You are one of the nearly 900 agents in Arizona (Out of 220,000+!) who we have invited to our recommendation engine.
              </p>
              <p className="text-lg md:text-xl text-primary font-semibold max-w-2xl mx-auto">
                There is no cost for your listing in the city of your choice
              </p>
            </div>

            {/* AI Proof Block */}
            <AIProofBlock />

            {/* The Card Preview */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-primary/5 border-b border-border p-6">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      This is what people will see when they look at your profile.
                    </h2>
                  </div>
                </div>
                
                <div className="p-6">
                  {professional && (
                    <ProfessionalCard
                      professional={convertToDisplayProfessional(professional, 1)}
                      market={selectedCity ? `${selectedCity.name}, ${selectedCity.state_slug?.toUpperCase() || 'AZ'}` : 'Arizona'}
                      stateAbbr={selectedCity?.state_slug?.toUpperCase() || 'AZ'}
                      citySlug={selectedCity?.slug}
                      categorySlug={(professional as any)?.categories?.slug || 'top10realestateagents'}
                      quizCompleted={true}
                      expandSections={true}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CTA to Edit */}
            <div className="text-center space-y-4">
              <Button 
                size="lg"
                onClick={() => {
                  setFunnelStep('edit');
                  window.scrollTo(0, 0);
                }}
                className="px-8"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit & Claim My Listing
              </Button>
              <p className="text-sm text-muted-foreground">
                You can update your contact info, bio, and more
              </p>
            </div>

          </div>
        </div>
      </>
    );
  }

  // Step 2: Edit View
  return (
    <>
      <Helmet>
        <title>Edit Your Listing | Top10Lists.us</title>
        <meta name="description" content="Edit and claim your professional listing on Top10Lists.us" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
        {/* Top Bar with Profile Dropdown */}
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-muted transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage 
                      src={professional?.image_url} 
                      alt={professional?.name || 'Profile'} 
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {firstName?.[0]?.toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground hidden sm:inline">
                    {firstName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => {
                    setFunnelStep('card');
                    window.scrollTo(0, 0);
                  }}
                  className="cursor-pointer"
                >
                  View Card
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    navigate('/');
                    toast.success('Signed out successfully');
                  }}
                  className="text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
          
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Step 2 of 3:</span> Edit your profile
          </div>
          
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Edit Your Profile
            </h1>
            <p className="text-muted-foreground">
              Update your information below. Click any field to edit.
            </p>
          </div>

          {/* Profile Card with Inline Editing */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* Card Header */}
              <div className="bg-primary/5 border-b border-border p-6">
                <h2 className="text-xl font-semibold text-foreground">
                  Here's your listing. Scroll down to review and edit it and claim your free spot.
                </h2>
              </div>

              {/* City Selector */}
              <div className="p-6 border-b border-border bg-muted/30">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground">Where would you like to be listed?</h2>
                  </div>
                  <div className="w-full max-w-md space-y-3">
                    <CityAutocomplete
                      cities={cities}
                      value={selectedCityId}
                      onValueChange={setSelectedCityId}
                      placeholder="Start typing a city name..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Your first city is <span className="font-medium text-green-600">FREE</span>. You can add more later.
                    </p>
                  </div>
                </div>
              </div>

              {/* Profile Photo & Basic Info */}
              <div className="p-6 border-b border-border">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Photo Upload */}
                  <div className="flex-shrink-0">
                    <div className="relative group">
                      <img 
                        src={profileImage} 
                        alt={professional?.name}
                        className="w-32 h-32 rounded-xl object-cover border-2 border-border"
                      />
                      <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-xl cursor-pointer transition-opacity">
                        <Upload className="h-6 w-6 text-white" />
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${professional.id}-${Date.now()}.${fileExt}`;
                            
                            const { error: uploadError } = await supabase.storage
                              .from('professional-photos')
                              .upload(fileName, file, { upsert: true });
                            
                            if (uploadError) {
                              toast.error('Failed to upload photo');
                              return;
                            }
                            
                            const { data: { publicUrl } } = supabase.storage
                              .from('professional-photos')
                              .getPublicUrl(fileName);
                            
                            await saveField('image_url', publicUrl);
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">Click to upload</p>
                  </div>

                  {/* Name, Rating, Company */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold text-foreground">{professional?.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {professional?.review_stars_rating && (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span>{professional.review_stars_rating}</span>
                              {professional?.num_total_reviews && (
                                <span>({professional.num_total_reviews} reviews)</span>
                              )}
                            </div>
                          )}
                          {professional?.company && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              <span>{professional.company}</span>
                            </div>
                          )}
                        </div>
                        {professional?.license_number && (
                          <div className="flex items-center gap-2 text-sm">
                            <Shield className="h-4 w-4 text-green-500" />
                            <span className="text-muted-foreground">License #{professional.license_number}</span>
                            {professional.license_verified_at && (
                              <Badge variant="secondary" className="text-xs">Verified</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Synthesized Bio Section */}
              {professional?.synthesized_bio && (
                <SynthesizedBioSection 
                  bio={professional.synthesized_bio}
                  professionalId={professional.id}
                  professionalName={professional.name}
                  professionalEmail={professional.email || ''}
                  profileLink={`/arizona/realtors/${professional.id}`}
                />
              )}

              {/* Editable Fields */}
              <div className="p-6 space-y-4">
                <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Click any field to edit - This is your direct message to the prospect. We recommend that you write it in the first person.
                </div>

                {/* Bio spans full width */}
                <EditableField
                  label="Bio"
                  value={bio}
                  onSave={(v) => saveField('description', v)}
                  type="textarea"
                  placeholder="Tell potential clients about yourself..."
                />
                
                <div className="grid md:grid-cols-2 gap-2">
                  
                  <EditableField
                    label="Phone Number"
                    value={professional?.phone || ''}
                    onSave={(v) => saveField('phone', v)}
                    type="tel"
                    placeholder="(555) 123-4567"
                    icon={<Phone className="h-4 w-4" />}
                  />
                  
                  <EditableField
                    label="Website"
                    value={professional?.website || ''}
                    onSave={(v) => saveField('website', v)}
                    type="url"
                    placeholder="https://yourwebsite.com"
                    icon={<Globe className="h-4 w-4" />}
                  />
                  
                  <EditableField
                    label="Video Introduction URL"
                    value={professional?.sidebar_video_url || ''}
                    onSave={(v) => saveField('sidebar_video_url', v)}
                    type="url"
                    placeholder="YouTube or Vimeo URL"
                    icon={<Video className="h-4 w-4" />}
                  />
                  
                  <EditableField
                    label="Facebook"
                    value={professional?.social_facebook || ''}
                    onSave={(v) => saveField('social_facebook', v)}
                    type="url"
                    placeholder="https://facebook.com/yourpage"
                  />
                  
                  <EditableField
                    label="Instagram"
                    value={professional?.social_instagram || ''}
                    onSave={(v) => saveField('social_instagram', v)}
                    type="url"
                    placeholder="https://instagram.com/yourhandle"
                  />
                  
                  <EditableField
                    label="LinkedIn"
                    value={professional?.social_linkedin || ''}
                    onSave={(v) => saveField('social_linkedin', v)}
                    type="url"
                    placeholder="https://linkedin.com/in/yourprofile"
                  />
                  
                  <EditableField
                    label="X / Twitter"
                    value={professional?.social_twitter || ''}
                    onSave={(v) => saveField('social_twitter', v)}
                    type="url"
                    placeholder="https://x.com/yourhandle"
                  />
                  
                  <EditableField
                    label="TikTok"
                    value={professional?.social_tiktok || ''}
                    onSave={(v) => saveField('social_tiktok', v)}
                    type="url"
                    placeholder="https://tiktok.com/@yourhandle"
                  />
                </div>

                {/* Specialties Section */}
                <div className="pt-4 border-t border-border">
                  <div 
                    className="group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setShowSpecialtyModal(true)}
                  >
                    <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">Specialties - This is where you can add neighborhoods.</div>
                      {professional?.specialty && professional.specialty.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {professional.specialty.map((s: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          Click to add specialties...
                        </div>
                      )}
                    </div>
                    <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>

              {/* Reviews Summary Section */}
              {(professional?.review_stars_rating || professional?.num_total_reviews) && (
                <div className="p-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Reviews</h3>
                  </div>
                  <div className="flex items-center gap-6">
                    {professional?.review_stars_rating && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={cn(
                                "h-5 w-5",
                                i < Math.floor(professional.review_stars_rating) 
                                  ? "text-yellow-500 fill-yellow-500" 
                                  : "text-muted-foreground/30"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-lg font-semibold">{professional.review_stars_rating}</span>
                      </div>
                    )}
                    {professional?.num_total_reviews && (
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">{professional.num_total_reviews}</span> total reviews
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notable Achievements / Awards Section */}
              {professional?.notable_achievements && Array.isArray(professional.notable_achievements) && professional.notable_achievements.length > 0 && (
                <div className="p-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Notable Achievements</h3>
                  </div>
                  <div className="space-y-3">
                    {(professional.notable_achievements as Array<{title?: string; description?: string; credibility?: number}>).map((achievement, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium text-foreground">{achievement.title}</div>
                          {achievement.description && (
                            <div className="text-sm text-muted-foreground">{achievement.description}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified/Locked Fields */}
              <div className="p-6 bg-muted/20 border-t border-border space-y-4">
                <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Verified information (request review to change)
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <LockedField
                    label="Name"
                    value={professional?.name}
                    fieldKey="name"
                    professionalId={professional?.id}
                    professionalName={professional?.name}
                    professionalEmail={professional?.email}
                    profileLink={getProfileLink()}
                  />
                  
                  <LockedField
                    label="Brokerage"
                    value={professional?.company}
                    fieldKey="company"
                    professionalId={professional?.id}
                    professionalName={professional?.name}
                    professionalEmail={professional?.email}
                    profileLink={getProfileLink()}
                  />
                  
                  <LockedField
                    label="Rating"
                    value={professional?.review_stars_rating ? `${professional.review_stars_rating} stars` : null}
                    fieldKey="review_stars_rating"
                    professionalId={professional?.id}
                    professionalName={professional?.name}
                    professionalEmail={professional?.email}
                    profileLink={getProfileLink()}
                  />
                  
                  <LockedField
                    label="Reviews"
                    value={professional?.num_total_reviews}
                    fieldKey="num_total_reviews"
                    professionalId={professional?.id}
                    professionalName={professional?.name}
                    professionalEmail={professional?.email}
                    profileLink={getProfileLink()}
                  />
                  
                  <LockedField
                    label="Total Sales"
                    value={professional?.total_sales || professional?.agent_sales_stats?.countAllTime}
                    fieldKey="total_sales"
                    professionalId={professional?.id}
                    professionalName={professional?.name}
                    professionalEmail={professional?.email}
                    profileLink={getProfileLink()}
                  />
                  
                  <LockedField
                    label="Years Experience"
                    value={professional?.years_experience ? `${professional.years_experience} years` : null}
                    fieldKey="years_experience"
                    professionalId={professional?.id}
                    professionalName={professional?.name}
                    professionalEmail={professional?.email}
                    profileLink={getProfileLink()}
                  />
                  
                  <LockedField
                    label="License Number"
                    value={professional?.license_number}
                    fieldKey="license_number"
                    professionalId={professional?.id}
                    professionalName={professional?.name}
                    professionalEmail={professional?.email}
                    profileLink={getProfileLink()}
                  />
                </div>
              </div>

              {/* Email Confirmation */}
              <div className="p-6 bg-primary/5 border-t border-border">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-1" />
                  <div className="flex-1 space-y-4">
                    <div className="font-medium text-foreground">Confirm your email to claim this listing</div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="flex-1"
                      />
                    </div>

                    {/* Consent Checkbox */}
                    <div className="flex items-start gap-3 max-w-lg">
                      <Checkbox
                        id="consent"
                        checked={consentChecked}
                        onCheckedChange={(checked) => setConsentChecked(checked === true)}
                        className="mt-1"
                      />
                      <label htmlFor="consent" className="text-sm text-muted-foreground cursor-pointer">
                        I agree to the{' '}
                        <a 
                          href="/terms" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a 
                          href="/privacy" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Privacy Policy
                        </a>
                        , and consent to receive emails and messages from Top10Lists.us about my listing and related services.
                      </label>
                    </div>

                    {/* Show what's missing - only after they try to click */}
                    {showValidationError && (!selectedCityId || !email || !consentChecked) && (
                      <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
                        <span className="font-medium">To claim your listing, please:</span>
                        <ul className="list-disc list-inside mt-1 space-y-0.5">
                          {!selectedCityId && <li>Select a city above</li>}
                          {!email && <li>Enter your email address</li>}
                          {!consentChecked && <li>Check the agreement box</li>}
                        </ul>
                      </div>
                    )}

                    <Button 
                      onClick={() => {
                        if (!selectedCityId || !email || !consentChecked) {
                          setShowValidationError(true);
                          return;
                        }
                        setFunnelStep('review');
                        window.scrollTo(0, 0);
                      }}
                      disabled={claiming}
                      className="whitespace-nowrap"
                    >
                      Review & Approve My Listing
                    </Button>
                    
                    <p className="text-sm text-muted-foreground">
                      We'll send a magic link to verify. No password needed.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Specialty Edit Modal */}
      <SpecialtyEditModal
        open={showSpecialtyModal}
        onClose={() => setShowSpecialtyModal(false)}
        onSave={saveSpecialties}
        currentSpecialties={professional?.specialty || []}
      />
    </>
  );
}
