import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function EditProfile() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [professional, setProfessional] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    headline: '',
    description: '',
    years_experience: '',
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

  const [newTag, setNewTag] = useState({ specialty: '', certification: '', language: '', service_area: '' });

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) {
        navigate('/404');
        return;
      }

      try {
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
          name: prof.name || '',
          email: prof.email || '',
          phone: prof.phone || '',
          company: prof.company || '',
          headline: prof.headline || '',
          description: prof.description || '',
          years_experience: prof.years_experience?.toString() || '',
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

  const addTag = (field: 'specialty' | 'certifications' | 'languages' | 'service_areas') => {
    const tagKey = field === 'specialty' ? 'specialty' : 
                   field === 'certifications' ? 'certification' :
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
        years_experience: formData.years_experience ? parseInt(formData.years_experience) : null,
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

      navigate(`/profile/${token}/pricing`);
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
            {/* Basic Info */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                  />
                </div>
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
                <Textarea
                  id="description"
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="years_experience">Years of Experience</Label>
                <Input
                  id="years_experience"
                  type="number"
                  value={formData.years_experience}
                  onChange={(e) => handleInputChange('years_experience', e.target.value)}
                />
              </div>
            </div>

            {/* Specialties */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Specialties</h2>
              <div>
                <Label htmlFor="specialty">Add Specialty</Label>
                <div className="flex gap-2">
                  <Input
                    id="specialty"
                    placeholder="e.g., First-Time Buyers"
                    value={newTag.specialty}
                    onChange={(e) => setNewTag(prev => ({ ...prev, specialty: e.target.value }))}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('specialty'))}
                  />
                  <Button type="button" onClick={() => addTag('specialty')}>Add</Button>
                </div>
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

            {/* Submit */}
            <div className="flex gap-4 pt-4">
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
                  'Confirm & Continue →'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}