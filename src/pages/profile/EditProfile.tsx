import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Check, ChevronsUpDown, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Bio Preview component with ...more expander - renders HTML while preserving paragraph breaks
const BioPreview = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);

  const stripHtml = (html: string) =>
    html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

  const escapeHtml = (input: string) =>
    input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  // Minimal safety: remove obvious script/style blocks and inline event handlers
  const sanitizeHtml = (html: string) =>
    html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');

  const toHtmlFromText = (input: string) => {
    const normalized = input.replace(/\r\n/g, '\n').trim();
    const escaped = escapeHtml(normalized);

    // Convert blank-line separated blocks to <p> and single newlines to <br />
    const paragraphs = escaped
      .split(/\n{2,}/)
      .map(p => p.replace(/\n/g, '<br />'))
      .filter(Boolean);

    if (paragraphs.length === 0) return '';
    return `<p>${paragraphs.join('</p><p>')}</p>`;
  };

  const getRenderableHtml = (input: string) => {
    const value = (input || '').trim();
    if (!value) return '';

    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value);
    const html = looksLikeHtml ? value : toHtmlFromText(value);
    return sanitizeHtml(html);
  };

  const plainText = stripHtml(text);
  const maxLength = 200;
  const needsTruncation = plainText.length > maxLength;

  // Truncated view: show plain text (but keep whitespace) + ...more
  if (!expanded && needsTruncation) {
    return (
      <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground">
        <span className="whitespace-pre-line">
          {plainText.slice(0, maxLength)}
          <span
            onClick={() => setExpanded(true)}
            className="text-primary cursor-pointer hover:underline font-medium ml-1"
          >
            ...more
          </span>
        </span>
      </div>
    );
  }

  const html = getRenderableHtml(text);

  return (
    <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground">
      <div
        className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line [&>p]:mb-3 [&>p:last-child]:mb-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {needsTruncation && (
        <span
          onClick={() => setExpanded(false)}
          className="text-primary cursor-pointer hover:underline font-medium"
        >
          less
        </span>
      )}
    </div>
  );
};

// Approved field row component
const ApprovedFieldRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
    <div>
      <span className="font-medium text-foreground">{label}</span>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
      <CheckCircle className="h-3 w-3" />
      Approved
    </Badge>
  </div>
);

// Under review field row component
const UnderReviewFieldRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
    <div>
      <span className="font-medium text-foreground">{label}</span>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" />
      Under review
    </Badge>
  </div>
);

// Field label mapping for display
const FIELD_LABELS: Record<string, string> = {
  'name': 'Name',
  'review_stars_rating': 'Review Rating',
  'num_total_reviews': 'Review Count',
  'years_experience': 'Years of Experience',
  'total_sales': 'Transaction Count',
  'license_number': 'License Number',
  'email': 'Email',
  'phone': 'Phone Number',
  'company': 'Brokerage Name',
  'website': 'Website',
  'social_linkedin': 'LinkedIn',
  'social_facebook': 'Facebook',
  'social_instagram': 'Instagram',
  'address': 'Address',
  'synthesized_bio': 'Our Synthesized Review',
  'synthesized_review': 'Our Synthesized Review',
  'synthesized review': 'Our Synthesized Review'
};

export default function EditProfile() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<any>(null);
  const [pendingReviews, setPendingReviews] = useState<Array<{ field_name: string; current_value: string | null }>>([]);
  const [approvedChanges, setApprovedChanges] = useState<Array<{ field_name: string; proposed_value: string | null }>>([]);
  const [availableCities, setAvailableCities] = useState<Array<{ id: string; name: string; state: string }>>([]);
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [bioEditValue, setBioEditValue] = useState('');
  const [bioLastEdited, setBioLastEdited] = useState<string | null>(null);
  const [savingBio, setSavingBio] = useState(false);
  
  // Form state - only agent-authored editable fields (no review required)
  const [formData, setFormData] = useState({
    headline: '',
    description: '', // Agent's bio (first-person)
    featured_city: '', // Single city for featuring
    website: '',
    social_linkedin: '',
    social_facebook: '',
    social_instagram: ''
  });

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
        // Load cities
        const citiesResult = await supabase
          .from('cities')
          .select('id, name, state')
          .eq('active', true)
          .order('name');
        
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
        
        // Load field change requests for this professional
        const { data: changeRequests } = await supabase
          .from('field_change_requests')
          .select('field_name, status, current_value, proposed_value')
          .eq('professional_id', prof.id);
        
        if (changeRequests) {
          // Pending reviews (status = 'pending')
          setPendingReviews(
            changeRequests
              .filter(r => r.status === 'pending')
              .map(r => ({ field_name: r.field_name, current_value: r.current_value }))
          );
          
          // Approved changes (status = 'approved')
          setApprovedChanges(
            changeRequests
              .filter(r => r.status === 'approved')
              .map(r => ({ field_name: r.field_name, proposed_value: r.proposed_value }))
          );
        }
        
        // Only populate agent-authored fields
        setFormData({
          headline: prof.headline || '',
          description: prof.description || '',
          featured_city: prof.cities?.name || '',
          website: prof.website || '',
          social_linkedin: prof.social_linkedin || '',
          social_facebook: prof.social_facebook || '',
          social_instagram: prof.social_instagram || ''
        });
        
        // Initialize bio last edited date if description exists
        if (prof.description && prof.updated_at) {
          setBioLastEdited(prof.updated_at);
        }

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

  const getFieldLabel = (fieldName: string): string => {
    return FIELD_LABELS[fieldName.toLowerCase()] || fieldName;
  };

  const isSynthesizedBioPending = () => {
    return pendingReviews.some(r => 
      r.field_name.toLowerCase().includes('synthesized') || 
      r.field_name.toLowerCase().includes('bio')
    );
  };


  const selectCity = (cityName: string) => {
    handleInputChange('featured_city', cityName);
    setCitySearchOpen(false);
    setCitySearch('');
  };

  const handleSaveBio = async () => {
    if (!professional?.id) return;
    setSavingBio(true);
    try {
      const { error } = await supabase
        .from('professionals')
        .update({ description: bioEditValue })
        .eq('id', professional.id);
      
      if (error) throw error;
      
      const now = new Date().toISOString();
      setProfessional((prev: any) => ({ ...prev, description: bioEditValue }));
      setBioLastEdited(now);
      setEditingBio(false);
      toast({
        title: 'Bio Updated',
        description: 'Your bio has been saved successfully.'
      });
    } catch (err: any) {
      console.error('Error saving bio:', err);
      toast({
        title: 'Error',
        description: 'Failed to save bio. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSavingBio(false);
    }
  };

  const startEditingBio = () => {
    setBioEditValue(professional?.description || '');
    setEditingBio(true);
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

  const hasApprovedChanges = approvedChanges.length > 0;
  const hasPendingReviews = pendingReviews.length > 0;

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
            Review & Edit
          </h1>
          <p className="text-xl text-muted-foreground">
            Review updates and complete your profile
          </p>
        </div>

        {/* Form */}
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* SECTION 1: APPROVED CHANGES (Read-Only) */}
            {hasApprovedChanges && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Approved Changes</h2>
                <p className="text-sm text-muted-foreground">
                  The following updates were approved and applied based on your review request.
                </p>
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 space-y-1">
                  {approvedChanges.map((change, index) => (
                    <ApprovedFieldRow
                      key={index}
                      label={getFieldLabel(change.field_name)}
                      value={change.proposed_value || 'Updated'}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic">
                  These changes require no further action.
                </p>
              </div>
            )}

            {/* SECTION 2: CHANGES UNDER REVIEW (Read-Only) */}
            {hasPendingReviews && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">Changes Under Review</h2>
                <p className="text-sm text-muted-foreground">
                  The following requests are still under review. No action is required at this time.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                  {pendingReviews.map((review, index) => (
                    <UnderReviewFieldRow
                      key={index}
                      label={getFieldLabel(review.field_name)}
                      value={review.current_value || 'Current value on file'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 1: OUR SYNTHESIZED REVIEW (Read-Only, Review Required) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Our Synthesized Review</h2>
                {isSynthesizedBioPending() && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Under review
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                This narrative was written by Top10Lists.us based on publicly available data and editorial review. If you believe any part is inaccurate, you may{' '}
                <span
                  onClick={() => navigate(`/profile/${token}`)}
                  className="text-primary cursor-pointer hover:underline font-medium"
                >
                  request a review
                </span>.
              </p>
              {professional?.synthesized_bio ? (
                <BioPreview text={professional.synthesized_bio} />
              ) : (
                <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground italic">
                  No synthesized review available yet.
                </div>
              )}
            </div>

            {/* SECTION 2: YOUR BIO (Editable — Agent Source of Truth) */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Your Bio</h2>
              <p className="text-sm text-muted-foreground">
                This is your statement to the public. We suggest you write it in the first person.{' '}
                <span
                  onClick={startEditingBio}
                  className="text-primary cursor-pointer hover:underline font-medium"
                >
                  Edit
                </span>
              </p>
              {bioLastEdited && (
                <p className="text-xs text-muted-foreground italic">
                  Last edited by you on {new Date(bioLastEdited).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })} at {new Date(bioLastEdited).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              )}
              {editingBio ? (
                <div className="space-y-3">
                  <Textarea
                    value={bioEditValue}
                    onChange={(e) => setBioEditValue(e.target.value)}
                    placeholder="Write your bio here..."
                    className="min-h-[200px]"
                  />
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSaveBio} 
                      disabled={savingBio}
                      size="sm"
                    >
                      {savingBio ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditingBio(false)}
                      disabled={savingBio}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : professional?.description ? (
                <BioPreview text={professional.description} />
              ) : (
                <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground italic">
                  No bio available yet.
                </div>
              )}
            </div>

            {/* SECTION 3: OPTIONAL ADDITIONS (Editable — Agent Source of Truth) */}
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Optional Additions</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  You may add or update the following optional details. These do not require review.
                </p>
              </div>

              {/* Professional Headline */}
              <div>
                <Label htmlFor="headline">Professional Headline</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  A short descriptor shown near your name (e.g., "Luxury Residential Specialist").
                </p>
                <Input
                  id="headline"
                  placeholder="e.g., Luxury Residential Specialist"
                  value={formData.headline}
                  onChange={(e) => handleInputChange('headline', e.target.value)}
                />
              </div>

              {/* Website */}
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

              {/* Social Links */}
              <div className="space-y-4">
                <Label>Social Links</Label>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="social_linkedin" className="text-xs text-muted-foreground">LinkedIn</Label>
                    <Input
                      id="social_linkedin"
                      type="url"
                      placeholder="https://linkedin.com/in/yourprofile"
                      value={formData.social_linkedin}
                      onChange={(e) => handleInputChange('social_linkedin', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="social_facebook" className="text-xs text-muted-foreground">Facebook</Label>
                    <Input
                      id="social_facebook"
                      type="url"
                      placeholder="https://facebook.com/yourpage"
                      value={formData.social_facebook}
                      onChange={(e) => handleInputChange('social_facebook', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="social_instagram" className="text-xs text-muted-foreground">Instagram</Label>
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
            </div>

            {/* SECTION 4: FEATURED CITY (Editable — Agent Source of Truth) */}
            <div className="space-y-4">
              <Label htmlFor="featured_city" className="text-xl font-semibold text-foreground">What city would you like to be featured in?</Label>
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
              <p className="text-xs text-muted-foreground italic">You may change this later.</p>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/profile/${token}`)}
              >
                Back
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Next'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
      </div>
    </>
  );
}
