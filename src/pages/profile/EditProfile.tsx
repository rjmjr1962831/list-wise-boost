import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X, Check, ChevronsUpDown, MessageSquarePlus, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import FieldReviewRequestModal from '@/components/profile/FieldReviewRequestModal';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Bio Preview component with ...more expander
const BioPreview = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const cleanText = stripHtml(text);
  const maxLength = 200;
  const needsTruncation = cleanText.length > maxLength;
  const displayText = expanded ? cleanText : cleanText.slice(0, maxLength);

  return (
    <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground">
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

// Fields for Section 1: Identity & Performance (read-only, review-required)
const IDENTITY_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'review_stars_rating', label: 'Review Rating' },
  { key: 'num_total_reviews', label: 'Review Count' },
  { key: 'years_experience', label: 'Years of Experience' },
  { key: 'total_sales', label: 'Total Sales' },
  { key: 'license_number', label: 'License Number' }
];

// Fields for Section 2: Contact Information (read-only, review-required)
const CONTACT_FIELDS = [
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Brokerage / Company' }
];

export default function EditProfile() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<any>(null);
  const [pendingReviews, setPendingReviews] = useState<string[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<Array<{ id: string; name: string }>>([]);
  const [specialtySearchOpen, setSpecialtySearchOpen] = useState(false);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [availableCities, setAvailableCities] = useState<Array<{ id: string; name: string; state: string }>>([]);
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  
  // Review request modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<{ key: string; label: string } | null>(null);
  
  // Form state - only agent-authored editable fields
  const [formData, setFormData] = useState({
    headline: '',
    description: '', // Agent's bio (first-person)
    specialty: [] as string[],
    certifications: [] as string[],
    languages: [] as string[],
    featured_city: '', // Single city for featuring
    website: '',
    social_linkedin: '',
    social_facebook: '',
    social_instagram: ''
  });

  const [newTag, setNewTag] = useState({ certification: '', language: '' });
  const [communicationConsent, setCommunicationConsent] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) {
        navigate('/404');
        return;
      }

      try {
        // Load specialties and cities in parallel
        const [specialtiesResult, citiesResult] = await Promise.all([
          supabase
            .from('specialties')
            .select('id, name')
            .eq('active', true)
            .order('name'),
          supabase
            .from('cities')
            .select('id, name, state')
            .eq('active', true)
            .order('name')
        ]);
        
        if (specialtiesResult.data) {
          setAvailableSpecialties(specialtiesResult.data);
        }
        if (citiesResult.data) {
          setAvailableCities(citiesResult.data);
        }

        const { data, error } = await supabase.functions.invoke('validate-profile-token', {
          body: { token }
        });

        if (error || !data?.success) {
          toast({
            title: 'Invalid Link',
            description: 'This verification link is invalid or has expired.',
            variant: 'destructive'
          });
          navigate('/404');
          return;
        }

        const prof = data.professional;
        setProfessional(prof);
        
        // Load pending review requests for this professional
        const { data: reviewRequests } = await supabase
          .from('field_change_requests')
          .select('field_name')
          .eq('professional_id', prof.id)
          .eq('status', 'pending');
        
        if (reviewRequests) {
          setPendingReviews(reviewRequests.map(r => r.field_name));
        }
        
        // Only populate agent-authored fields
        setFormData({
          headline: prof.headline || '',
          description: prof.description || '',
          specialty: Array.isArray(prof.specialty) ? prof.specialty : [],
          certifications: Array.isArray(prof.certifications) ? prof.certifications : [],
          languages: Array.isArray(prof.languages) ? prof.languages : [],
          featured_city: prof.cities?.name || '',
          website: prof.website || '',
          social_linkedin: prof.social_linkedin || '',
          social_facebook: prof.social_facebook || '',
          social_instagram: prof.social_instagram || ''
        });

        // Track edit view
        supabase.functions.invoke('track-profile-event', {
          body: { token, event_name: 'profile_edit_viewed' }
        });
        
        // Send email notification
        supabase.functions.invoke('send-funnel-notification', {
          body: {
            event_type: 'profile_edit_viewed',
            agent_name: prof.name,
            agent_email: prof.email,
            agent_id: prof.id,
            city_name: prof.cities?.name,
            profile_link: prof.profile_link
          }
        }).catch(err => console.error('Failed to send funnel notification:', err));
      } catch (err) {
        console.error('Error loading profile:', err);
        toast({
          title: 'Error',
          description: 'Something went wrong. Please try again.',
          variant: 'destructive'
        });
        navigate('/404');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token, navigate, toast]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openReviewModal = (field: { key: string; label: string }) => {
    setSelectedField(field);
    setReviewModalOpen(true);
  };

  const getProfileLink = () => {
    return `https://www.top10lists.us/profile/${token}`;
  };

  const getReadOnlyValue = (key: string) => {
    if (!professional) return 'N/A';
    
    switch (key) {
      case 'name':
        return professional.name || 'N/A';
      case 'review_stars_rating':
        return professional.review_stars_rating ? `${professional.review_stars_rating} stars` : 'N/A';
      case 'num_total_reviews':
        return professional.num_total_reviews?.toString() || 'N/A';
      case 'years_experience':
        return professional.years_experience ? `${professional.years_experience} years` : 'N/A';
      case 'total_sales':
        return professional.total_sales?.toString() || 'N/A';
      case 'license_number':
        return professional.license_number || 'N/A';
      case 'email':
        return professional.email || 'N/A';
      case 'phone':
        return professional.phone || 'N/A';
      case 'company':
        return professional.company || professional.business_name || 'N/A';
      default:
        return 'N/A';
    }
  };

  const isFieldPendingReview = (fieldLabel: string) => {
    return pendingReviews.some(f => f.toLowerCase() === fieldLabel.toLowerCase());
  };

  const addSpecialtyFromList = (specialtyName: string) => {
    if (!formData.specialty.includes(specialtyName)) {
      handleInputChange('specialty', [...formData.specialty, specialtyName]);
    }
    setSpecialtySearchOpen(false);
  };

  const addNewSpecialty = async () => {
    const value = specialtySearch.trim();
    if (!value) return;

    const existing = availableSpecialties.find(s => s.name.toLowerCase() === value.toLowerCase());
    if (existing) {
      addSpecialtyFromList(existing.name);
      setSpecialtySearch('');
      return;
    }

    if (!formData.specialty.includes(value)) {
      handleInputChange('specialty', [...formData.specialty, value]);
    }

    try {
      const { data: newSpecialty, error } = await supabase
        .from('specialties')
        .insert({
          name: value,
          category_id: professional?.category_id,
          active: true
        })
        .select()
        .single();

      if (!error && newSpecialty) {
        setAvailableSpecialties(prev => [...prev, { id: newSpecialty.id, name: newSpecialty.name }].sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      console.error('Error adding specialty:', err);
    }

    setSpecialtySearch('');
    setSpecialtySearchOpen(false);
  };

  const selectCity = (cityName: string) => {
    handleInputChange('featured_city', cityName);
    setCitySearchOpen(false);
    setCitySearch('');
  };

  const addTag = (field: 'certifications' | 'languages') => {
    const tagKey = field === 'certifications' ? 'certification' : 'language';
    const value = newTag[tagKey].trim();
    
    if (value && !formData[field].includes(value)) {
      handleInputChange(field, [...formData[field], value]);
      setNewTag(prev => ({ ...prev, [tagKey]: '' }));
    }
  };

  const removeTag = (field: 'specialty' | 'certifications' | 'languages', tag: string) => {
    handleInputChange(field, formData[field].filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updates = {
        ...formData,
        funnel_status: 'edit_complete'
      };

      const { data, error } = await supabase.functions.invoke('update-prospect-profile', {
        body: { token, updates }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to update profile');
      }

      supabase.functions.invoke('track-profile-event', {
        body: { token, event_name: 'profile_edited' }
      });

      toast({
        title: 'Profile Updated',
        description: 'Your information has been saved successfully.'
      });

      navigate(`/profile/${token}/preview`);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save changes. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredCities = availableCities.filter(city => 
    city.name.toLowerCase().includes(citySearch.toLowerCase()) ||
    city.state.toLowerCase().includes(citySearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Review & Edit Your Profile | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Step 2 of 3</span>
            <span className="text-sm text-muted-foreground">Review & Edit</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: '66%' }} />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Review Your Profile
          </h1>
          <p className="text-muted-foreground">
            Make sure everything looks accurate.
          </p>
        </div>

        {/* Pending Reviews Alert */}
        {pendingReviews.length > 0 && (
          <Alert className="mb-6 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Some requested changes are pending review. You may continue while they are reviewed.
            </AlertDescription>
          </Alert>
        )}

        {/* Form */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* SECTION 1: Synced Information (Identity & Performance) */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Synced Information</h2>
              <p className="text-sm text-muted-foreground">
                These fields are synced from external sources. To request changes, click <strong>Ask for review</strong> next to the field.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {IDENTITY_FIELDS.map((field) => {
                  const isPending = isFieldPendingReview(field.label);
                  return (
                    <div key={field.key} className="space-y-1">
                      <Label>{field.label}</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          value={getReadOnlyValue(field.key)}
                          disabled
                          className="bg-muted flex-1"
                        />
                        {isPending ? (
                          <Badge variant="secondary" className="whitespace-nowrap">
                            Review requested
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openReviewModal(field)}
                            className="whitespace-nowrap"
                          >
                            <MessageSquarePlus className="h-4 w-4 mr-1" />
                            Ask for review
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 2: Contact Information (Synced) */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Contact Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {CONTACT_FIELDS.map((field) => {
                  const isPending = isFieldPendingReview(field.label);
                  return (
                    <div key={field.key} className="space-y-1">
                      <Label>{field.label}</Label>
                      {field.key === 'phone' && (
                        <p className="text-xs text-muted-foreground italic">
                          This may be a tracking number from Zillow or similar platforms.
                        </p>
                      )}
                      <div className="flex gap-2 items-center">
                        <Input
                          value={getReadOnlyValue(field.key)}
                          disabled
                          className="bg-muted flex-1"
                        />
                        {isPending ? (
                          <Badge variant="secondary" className="whitespace-nowrap">
                            Review requested
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openReviewModal(field)}
                            className="whitespace-nowrap"
                          >
                            <MessageSquarePlus className="h-4 w-4 mr-1" />
                            Ask for review
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION 3: Our Synthesized Review (Read-Only) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Our Synthesized Review</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openReviewModal({ key: 'synthesized_bio', label: 'Synthesized Review' })}
                  className="whitespace-nowrap"
                >
                  <MessageSquarePlus className="h-4 w-4 mr-1" />
                  Ask for review
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                This third-party narrative was written by Top10Lists.us based on publicly available data and observations. It is not editable.
              </p>
              {professional?.synthesized_bio ? (
                <BioPreview text={professional.synthesized_bio} />
              ) : (
                <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground italic">
                  No synthesized review available yet.
                </div>
              )}
            </div>

            {/* SECTION 4: Your Bio (Editable - No Review Required) */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Your Bio</h2>
              <p className="text-sm text-muted-foreground">
                This is your statement to the public. We suggest you write it in the first person.
              </p>
              <Textarea
                id="description"
                rows={5}
                placeholder="Write your personal bio here..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="whitespace-pre-line"
              />
            </div>

            {/* SECTION 5: Professional Headline (Editable) */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Professional Headline</h2>
              <p className="text-sm text-muted-foreground">
                A short descriptor shown near your name (e.g., "Luxury Residential Specialist").
              </p>
              <Input
                id="headline"
                placeholder="e.g., Luxury Residential Specialist"
                value={formData.headline}
                onChange={(e) => handleInputChange('headline', e.target.value)}
              />
            </div>

            {/* SECTION 6: Service Area (Controlled Editable) */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">What city would you like to be featured in?</h2>
              <Popover open={citySearchOpen} onOpenChange={setCitySearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={citySearchOpen}
                    className="w-full justify-between"
                  >
                    {formData.featured_city || "Select a city..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 z-[100] bg-background" align="start" side="bottom">
                  <Command className="bg-background">
                    <CommandInput 
                      placeholder="Search cities..." 
                      value={citySearch}
                      onValueChange={setCitySearch}
                    />
                    <CommandList className="max-h-[300px] overflow-y-auto bg-background">
                      <CommandEmpty className="bg-background p-2 text-center text-sm text-muted-foreground">
                        No city found
                      </CommandEmpty>
                      <CommandGroup className="bg-background">
                        {filteredCities.slice(0, 50).map((city) => (
                          <CommandItem
                            key={city.id}
                            value={city.name}
                            onSelect={() => selectCity(city.name)}
                            className="cursor-pointer hover:bg-accent"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.featured_city === city.name ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {city.name}, {city.state}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* SECTION 7: Additional Editable Details */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-foreground">Additional Details</h2>
              
              {/* Specialties */}
              <div>
                <Label>Specialties / Tags</Label>
                <Popover open={specialtySearchOpen} onOpenChange={setSpecialtySearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={specialtySearchOpen}
                      className="w-full justify-between mt-1"
                    >
                      Select or add specialty...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0 z-[100] bg-background" align="start" side="bottom">
                    <Command className="bg-background">
                      <CommandInput 
                        placeholder="Search or add specialty..." 
                        value={specialtySearch}
                        onValueChange={setSpecialtySearch}
                      />
                      <CommandList className="max-h-[300px] overflow-y-auto bg-background">
                        <CommandEmpty className="bg-background">
                          <div className="p-2 text-center">
                            <p className="text-sm text-muted-foreground mb-2">No specialty found</p>
                            <Button 
                              size="sm" 
                              onClick={addNewSpecialty}
                              disabled={!specialtySearch.trim()}
                            >
                              Add "{specialtySearch}"
                            </Button>
                          </div>
                        </CommandEmpty>
                        <CommandGroup className="bg-background">
                          {availableSpecialties.map((specialty) => (
                            <CommandItem
                              key={specialty.id}
                              value={specialty.name}
                              onSelect={() => addSpecialtyFromList(specialty.name)}
                              className="cursor-pointer hover:bg-accent"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.specialty.includes(specialty.name) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {specialty.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.specialty.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeTag('specialty', tag)} />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Certifications */}
              <div>
                <Label htmlFor="certification">Certifications</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="certification"
                    placeholder="e.g., CRS, ABR"
                    value={newTag.certification}
                    onChange={(e) => setNewTag(prev => ({ ...prev, certification: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('certifications'))}
                  />
                  <Button type="button" onClick={() => addTag('certifications')}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.certifications.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeTag('certifications', tag)} />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <Label htmlFor="language">Languages</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="language"
                    placeholder="e.g., Spanish, Mandarin"
                    value={newTag.language}
                    onChange={(e) => setNewTag(prev => ({ ...prev, language: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('languages'))}
                  />
                  <Button type="button" onClick={() => addTag('languages')}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.languages.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeTag('languages', tag)} />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* SECTION 8: Online Presence */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Online Presence</h2>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="social_linkedin">LinkedIn URL</Label>
                  <Input
                    id="social_linkedin"
                    type="url"
                    placeholder="https://linkedin.com/in/yourprofile"
                    value={formData.social_linkedin}
                    onChange={(e) => handleInputChange('social_linkedin', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="social_facebook">Facebook URL</Label>
                  <Input
                    id="social_facebook"
                    type="url"
                    placeholder="https://facebook.com/yourpage"
                    value={formData.social_facebook}
                    onChange={(e) => handleInputChange('social_facebook', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="social_instagram">Instagram URL</Label>
                  <Input
                    id="social_instagram"
                    type="url"
                    placeholder="https://instagram.com/yourprofile"
                    value={formData.social_instagram}
                    onChange={(e) => handleInputChange('social_instagram', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Communication Consent */}
            <div className="flex items-start space-x-3 pt-4 border-t">
              <Checkbox
                id="communicationConsent"
                checked={communicationConsent}
                onCheckedChange={(checked) => setCommunicationConsent(checked === true)}
                className="mt-1"
              />
              <Label htmlFor="communicationConsent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-primary hover:underline">Terms and Conditions</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</a>.
                I consent to receive communications from Top10Lists.us. I can opt-out anytime.
              </Label>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/profile/${token}`)}
              >
                Back
              </Button>
              <Button type="submit" disabled={saving || !communicationConsent} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Confirm & Continue →'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Review Request Modal */}
      {selectedField && (
        <FieldReviewRequestModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          fieldName={selectedField.label}
          profileLink={getProfileLink()}
          professionalName={professional?.name || ''}
          professionalId={professional?.id || ''}
          professionalEmail={professional?.email}
          pipedrivePersonId={professional?.pipedrive_person_id}
          currentValue={selectedField.key === 'synthesized_bio' ? 'See synthesized review above' : (professional as any)?.[selectedField.key] || ''}
        />
      )}
      </div>
    </>
  );
}
