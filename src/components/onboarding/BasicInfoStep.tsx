import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { OnboardingData } from '@/pages/AgentOnboarding';
import { supabase } from '@/integrations/supabase/client';

interface BasicInfoStepProps {
  data: OnboardingData;
  updateData: (data: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function BasicInfoStep({ data, updateData, onNext, onBack }: BasicInfoStepProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateWebsite = (url: string): string => {
    if (!url) return url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'https://' + url;
    }
    return url;
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+?1?\s*\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
    return phoneRegex.test(phone);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const verifyLicense = async () => {
    if (!data.licenseNumber || !data.state) {
      toast.error('Please enter license number and select state first');
      return;
    }

    setIsVerifying(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('lookup-agent-license', {
        body: {
          licenseNumber: data.licenseNumber,
          state: data.stateSlug,
        },
      });

      if (error) throw error;

      if (result?.verified) {
        updateData({ licenseVerified: true });
        toast.success('License verified successfully!');
      } else {
        updateData({ licenseVerified: false });
        toast.warning('Could not verify license. Using provided number.');
        
        // Log error for troubleshooting
        await supabase.functions.invoke('send-contact-email', {
          body: {
            to: 'errors@top10results.us',
            subject: 'License Verification Error',
            message: `Failed to verify license: ${data.licenseNumber} for state: ${data.state}`,
          },
        });
      }
    } catch (error) {
      console.error('License verification error:', error);
      updateData({ licenseVerified: false });
      toast.error('Verification service unavailable. Proceeding with manual review.');
    } finally {
      setIsVerifying(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!data.brokerageName.trim()) newErrors.brokerageName = 'Brokerage name is required';
    if (data.isTeamMember && !data.teamName?.trim()) newErrors.teamName = 'Team name is required';
    if (!data.bio.trim()) newErrors.bio = 'Bio is required';
    if (data.bio.length < 50) newErrors.bio = 'Bio must be at least 50 characters';
    if (!data.licenseNumber.trim()) newErrors.licenseNumber = 'License number is required';
    if (!data.website.trim()) newErrors.website = 'Website is required';
    if (!data.email.trim()) newErrors.email = 'Email is required';
    else if (!validateEmail(data.email)) newErrors.email = 'Invalid email format';
    if (!data.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!validatePhone(data.phone)) newErrors.phone = 'Invalid phone number format';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      updateData({ website: validateWebsite(data.website) });
      onNext();
    } else {
      const errorFields = Object.keys(errors).join(', ');
      toast.error('Please fix the errors before continuing', {
        description: `Issues with: ${errorFields}`,
        duration: 6000,
      });
      // Scroll to first error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Validation Error Summary */}
      {Object.keys(errors).length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-destructive mb-2">
                  Please fix the following issues:
                </h4>
                <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                  {Object.entries(errors).map(([field, error]) => (
                    <li key={field}>
                      <span className="font-medium capitalize">{field.replace(/([A-Z])/g, ' $1').trim()}:</span> {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Tell us about yourself and your business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={data.fullName}
              onChange={(e) => updateData({ fullName: e.target.value })}
              placeholder="John Doe"
              className={errors.fullName ? 'border-destructive' : ''}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
          </div>

          {/* Brokerage Name */}
          <div className="space-y-2">
            <Label htmlFor="brokerageName">Brokerage Name *</Label>
            <Input
              id="brokerageName"
              value={data.brokerageName}
              onChange={(e) => updateData({ brokerageName: e.target.value })}
              placeholder="ABC Realty Group"
              className={errors.brokerageName ? 'border-destructive' : ''}
            />
            {errors.brokerageName && (
              <p className="text-sm text-destructive">{errors.brokerageName}</p>
            )}
          </div>

          {/* Team Member */}
          <div className="space-y-4">
            <Label>Are you part of a team? *</Label>
            <RadioGroup
              value={data.isTeamMember ? 'yes' : 'no'}
              onValueChange={(value) => updateData({ isTeamMember: value === 'yes' })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="team-yes" />
                <Label htmlFor="team-yes" className="font-normal cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="team-no" />
                <Label htmlFor="team-no" className="font-normal cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Team Name (Conditional) */}
          {data.isTeamMember && (
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name *</Label>
              <Input
                id="teamName"
                value={data.teamName || ''}
                onChange={(e) => updateData({ teamName: e.target.value })}
                placeholder="Elite Home Team"
                className={errors.teamName ? 'border-destructive' : ''}
              />
              {errors.teamName && (
                <p className="text-sm text-destructive">{errors.teamName}</p>
              )}
            </div>
          )}

          {/* Bio */}
          <div className="space-y-2">
            <Label htmlFor="bio">
              Professional Bio * 
              <span className="text-xs text-muted-foreground ml-2">
                ({data.bio.length}/500 characters, minimum 50)
              </span>
            </Label>
            <Textarea
              id="bio"
              value={data.bio}
              onChange={(e) => updateData({ bio: e.target.value.slice(0, 500) })}
              placeholder="Describe your services, experience, and what makes you unique..."
              rows={5}
              className={errors.bio ? 'border-destructive' : ''}
            />
            {errors.bio && (
              <p className="text-sm text-destructive">{errors.bio}</p>
            )}
          </div>

          {/* License Number */}
          <div className="space-y-2">
            <Label htmlFor="licenseNumber">License Number *</Label>
            <div className="flex gap-2">
              <Input
                id="licenseNumber"
                value={data.licenseNumber}
                onChange={(e) => updateData({ licenseNumber: e.target.value })}
                placeholder="ABC123456"
                className={errors.licenseNumber ? 'border-destructive' : ''}
              />
              <Button
                type="button"
                onClick={verifyLicense}
                disabled={isVerifying || !data.licenseNumber}
                variant="outline"
                className="min-w-[120px]"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : data.licenseVerified ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Verified
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </div>
            {errors.licenseNumber && (
              <p className="text-sm text-destructive">{errors.licenseNumber}</p>
            )}
            {data.licenseVerified && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                License verified with state database
              </p>
            )}
          </div>

          {/* Website */}
          <div className="space-y-2">
            <Label htmlFor="website">Website URL *</Label>
            <Input
              id="website"
              value={data.website}
              onChange={(e) => updateData({ website: e.target.value })}
              placeholder="yourwebsite.com"
              className={errors.website ? 'border-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">https:// will be added automatically</p>
            {errors.website && (
              <p className="text-sm text-destructive">{errors.website}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={data.email}
              onChange={(e) => updateData({ email: e.target.value })}
              placeholder="john@example.com"
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
            
            <div className="flex items-center space-x-2 mt-2">
              <Switch
                id="publishEmail"
                checked={data.publishEmail}
                onCheckedChange={(checked) => updateData({ publishEmail: checked })}
              />
              <Label htmlFor="publishEmail" className="font-normal cursor-pointer">
                Display email publicly on my listing
              </Label>
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              value={data.phone}
              onChange={(e) => updateData({ phone: e.target.value })}
              placeholder="(555) 123-4567"
              className={errors.phone ? 'border-destructive' : ''}
            />
            <p className="text-xs text-muted-foreground">
              Required for SMS notifications when you receive inquiries
            </p>
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>

          {/* Zillow/Home.com Links */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="hasZillowHomeLinks"
                checked={data.hasZillowHomeLinks}
                onCheckedChange={(checked) => updateData({ hasZillowHomeLinks: checked })}
              />
              <Label htmlFor="hasZillowHomeLinks" className="font-normal cursor-pointer">
                I want to add links to my Zillow or Home.com profiles
              </Label>
            </div>

            {data.hasZillowHomeLinks && (
              <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="zillowUrl">Zillow Profile URL</Label>
                  <Input
                    id="zillowUrl"
                    value={data.zillowUrl || ''}
                    onChange={(e) => updateData({ zillowUrl: e.target.value })}
                    placeholder="https://www.zillow.com/profile/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="homeUrl">Home.com Profile URL</Label>
                  <Input
                    id="homeUrl"
                    value={data.homeUrl || ''}
                    onChange={(e) => updateData({ homeUrl: e.target.value })}
                    placeholder="https://www.home.com/agent/..."
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
        <Button onClick={handleNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
