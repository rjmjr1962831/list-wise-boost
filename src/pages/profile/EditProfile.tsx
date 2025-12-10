import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X, Check, ChevronsUpDown, MessageSquarePlus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import FieldReviewRequestModal from '@/components/profile/FieldReviewRequestModal';

// Bio Preview component with ...more expander
const BioPreview = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  const cleanText = stripHtml(text);
  const maxLength = 200;
  const needsTruncation = cleanText.length > maxLength;
  const displayText = expanded ? cleanText : cleanText.slice(0, maxLength);

  return (
    <div className="bg-muted/50 rounded-md p-3 mb-2 text-sm text-muted-foreground">
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

// Fields that require manual review to change
const READ_ONLY_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'review_stars_rating', label: 'Review Rating' },
  { key: 'num_total_reviews', label: 'Reviews' },
  { key: 'years_experience', label: 'Years Experience' },
  { key: 'total_sales', label: 'Total Sales' },
  { key: 'license_number', label: 'License Number' }
];

export default function EditProfile() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<any>(null);
  const [availableSpecialties, setAvailableSpecialties] = useState<Array<{ id: string; name: string }>>([]);
  const [specialtySearchOpen, setSpecialtySearchOpen] = useState(false);
  const [specialtySearch, setSpecialtySearch] = useState('');
  
  // Review request modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<{ key: string; label: string } | null>(null);
  
  // Form state - only editable fields
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    company: '',
    headline: '',
    description: '',
    specialty: [] as string[],
    certifications: [] as string[],
    languages: [] as string[],
    service_areas: [] as string[],
    website: '',
    social_linkedin: '',
    social_facebook: '',
    social_instagram: '',
    address: '',
    zip_code: ''
  });

  const [newTag, setNewTag] = useState({ certification: '', language: '', service_area: '' });
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
        // Load specialties
        const { data: specialtiesData } = await supabase
          .from('specialties')
          .select('id, name')
          .eq('active', true)
          .order('name');
        
        if (specialtiesData) {
          setAvailableSpecialties(specialtiesData);
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
        
        setFormData({
          email: prof.email || '',
          phone: prof.phone || '',
          company: prof.company || '',
          headline: prof.headline || '',
          description: prof.description || '',
          specialty: Array.isArray(prof.specialty) ? prof.specialty : [],
          certifications: Array.isArray(prof.certifications) ? prof.certifications : [],
          languages: Array.isArray(prof.languages) ? prof.languages : [],
          service_areas: Array.isArray(prof.service_areas) ? prof.service_areas : [],
          website: prof.website || '',
          social_linkedin: prof.social_linkedin || '',
          social_facebook: prof.social_facebook || '',
          social_instagram: prof.social_instagram || '',
          address: prof.address || '',
          zip_code: prof.zip_code || ''
        });

        // Track edit view
        supabase.functions.invoke('track-profile-event', {
          body: { token, event_name: 'profile_edit_viewed' }
        });
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
    return `https://top10lists.us/profile/${token}`;
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
      default:
        return 'N/A';
    }
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

    // Check if already exists in list
    const existing = availableSpecialties.find(s => s.name.toLowerCase() === value.toLowerCase());
    if (existing) {
      addSpecialtyFromList(existing.name);
      setSpecialtySearch('');
      return;
    }

    // Add to form immediately
    if (!formData.specialty.includes(value)) {
      handleInputChange('specialty', [...formData.specialty, value]);
    }

    // Save to database in background
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

      if (error) {
        console.error('Error saving specialty:', error);
      } else if (newSpecialty) {
        setAvailableSpecialties(prev => [...prev, { id: newSpecialty.id, name: newSpecialty.name }].sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      console.error('Error adding specialty:', err);
    }

    setSpecialtySearch('');
    setSpecialtySearchOpen(false);
  };

  const addTag = (field: 'certifications' | 'languages' | 'service_areas') => {
    const tagKey = field === 'certifications' ? 'certification' :
                   field === 'languages' ? 'language' : 'service_area';
    const value = newTag[tagKey].trim();
    
    if (value && !formData[field].includes(value)) {
      handleInputChange(field, [...formData[field], value]);
      setNewTag(prev => ({ ...prev, [tagKey]: '' }));
    }
  };

  const removeTag = (field: 'specialty' | 'certifications' | 'languages' | 'service_areas', tag: string) => {
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

      // Track completion
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
        <title>Edit Your Profile | Top10Lists.us</title>
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
            Make sure everything looks accurate
          </p>
        </div>

        {/* Form */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Read-Only Fields Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Synced Information</h2>
              <p className="text-sm text-muted-foreground">
                These fields are synced from external sources. To request changes, click "Ask For Review" next to the field.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {READ_ONLY_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label>{field.label}</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        value={getReadOnlyValue(field.key)}
                        disabled
                        className="bg-muted flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewModal(field)}
                        className="whitespace-nowrap"
                      >
                        <MessageSquarePlus className="h-4 w-4 mr-1" />
                        Ask For Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Editable Basic Info */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Contact Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="company">Brokerage/Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => handleInputChange('company', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Professional Info */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Professional Details</h2>
              <div>
                <Label htmlFor="headline">Professional Headline</Label>
                <Input
                  id="headline"
                  placeholder="e.g., Luxury Real Estate Specialist"
                  value={formData.headline}
                  onChange={(e) => handleInputChange('headline', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="description">Bio</Label>
                {/* Current Bio Preview with ...more expander */}
                {professional?.synthesized_bio && (
                  <BioPreview text={professional.synthesized_bio} />
                )}
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="Enter your bio..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </div>
            </div>

            {/* Specialties */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Specialties</h2>
              <div>
                <Label>Select or Add Specialty</Label>
                <Popover open={specialtySearchOpen} onOpenChange={setSpecialtySearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={specialtySearchOpen}
                      className="w-full justify-between"
                    >
                      Select specialty...
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
                <p className="text-xs text-muted-foreground mt-1">
                  Select from existing specialties or type to add a new one
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.specialty.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeTag('specialty', tag)} />
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="certification">Certifications</Label>
                <div className="flex gap-2">
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

              <div>
                <Label htmlFor="language">Languages</Label>
                <div className="flex gap-2">
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

            {/* Location */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Location & Service Areas</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="zip_code">Zip Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => handleInputChange('zip_code', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="service_area">Service Areas</Label>
                <div className="flex gap-2">
                  <Input
                    id="service_area"
                    placeholder="e.g., Phoenix Metro"
                    value={newTag.service_area}
                    onChange={(e) => setNewTag(prev => ({ ...prev, service_area: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('service_areas'))}
                  />
                  <Button type="button" onClick={() => addTag('service_areas')}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.service_areas.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeTag('service_areas', tag)} />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Online Presence */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Online Presence</h2>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="social_linkedin">LinkedIn URL</Label>
                  <Input
                    id="social_linkedin"
                    type="url"
                    value={formData.social_linkedin}
                    onChange={(e) => handleInputChange('social_linkedin', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="social_facebook">Facebook URL</Label>
                  <Input
                    id="social_facebook"
                    type="url"
                    value={formData.social_facebook}
                    onChange={(e) => handleInputChange('social_facebook', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="social_instagram">Instagram URL</Label>
                  <Input
                    id="social_instagram"
                    type="url"
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
                By checking this box, I confirm that I have read and agree to the{' '}
                <a href="/terms" target="_blank" className="text-primary hover:underline">Terms and Conditions</a>
                {' '}and the{' '}
                <a href="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</a>
                , and agree to receive marketing, account status and 2 factor authentication communications in emails and messages from top10lists.us. I know I can opt-out any time.
              </Label>
            </div>

            {/* Submit */}
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
          professionalEmail={professional?.email}
          pipedrivePersonId={professional?.pipedrive_person_id}
        />
      )}
      </div>
    </>
  );
}
