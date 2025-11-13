import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  CheckCircle2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Building, 
  Users,
  Edit
} from 'lucide-react';
import { OnboardingData } from '@/pages/AgentOnboarding';

interface PreviewStepProps {
  data: OnboardingData;
  onSubmit: () => void;
  onBack: () => void;
  onEdit: () => void;
}

export function PreviewStep({ data, onSubmit, onBack, onEdit }: PreviewStepProps) {
  const initials = data.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Preview Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Preview Your Listing</CardTitle>
              <CardDescription>
                This is how your profile will appear to potential clients
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Agent Card Preview */}
          <div className="bg-gradient-to-br from-background via-background to-primary/5 rounded-lg border-2 border-primary/20 p-6 shadow-lg">
            <div className="flex items-start gap-4 mb-4">
              <Avatar className="h-20 w-20 border-2 border-primary">
                <AvatarFallback className="bg-gradient-to-br from-primary to-sunset-orange text-primary-foreground text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground mb-1">
                  {data.fullName}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Building className="h-4 w-4" />
                  <span>{data.brokerageName}</span>
                  {data.isTeamMember && data.teamName && (
                    <>
                      <span>•</span>
                      <Users className="h-4 w-4" />
                      <span>{data.teamName}</span>
                    </>
                  )}
                </div>
                {data.licenseVerified && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Verified License
                  </Badge>
                )}
              </div>
            </div>

            {/* Bio */}
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              {data.bio}
            </p>

            {/* Specialties */}
            {data.specialties.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">SPECIALTIES</p>
                <div className="flex flex-wrap gap-2">
                  {data.specialties.map((specialty) => (
                    <Badge key={specialty} variant="outline">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Info */}
            <div className="grid sm:grid-cols-2 gap-3 pt-4 border-t border-border/50">
              <a 
                href={data.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span className="truncate">Website</span>
              </a>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <span>{data.phone}</span>
              </div>
              {data.publishEmail && (
                <a 
                  href={`mailto:${data.email}`}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{data.email}</span>
                </a>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                <span>{data.cities.length} {data.cities.length === 1 ? 'City' : 'Cities'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Application Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">License Status</p>
              <p className="flex items-center gap-2">
                {data.licenseVerified ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Verified</span>
                  </>
                ) : (
                  <>
                    <span className="text-amber-600">Pending Verification</span>
                  </>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Specialties</p>
              <p>{data.specialties.length} selected</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Service Areas</p>
              <p>{data.cities.length} {data.cities.length === 1 ? 'city' : 'cities'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Target Zip Codes</p>
              <p>
                {Object.values(data.zipCodes || {}).reduce((sum, zips) => sum + zips.length, 0)} selected
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 border border-border/50 mt-6">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Next Steps:</strong> After submission, your application 
              will be reviewed by our team. You'll receive a confirmation email within 24-48 hours. 
              Once approved, you'll be prompted to complete payment setup.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Is this information accurate?</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Please review your information carefully. If everything looks correct, click Submit 
                to proceed to payment. If you need to make changes, click Edit or go Back.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button onClick={onBack} variant="outline">
          Back
        </Button>
        <Button onClick={onSubmit} size="lg" className="bg-gradient-to-r from-primary to-sunset-orange">
          Submit Application
        </Button>
      </div>
    </div>
  );
}
