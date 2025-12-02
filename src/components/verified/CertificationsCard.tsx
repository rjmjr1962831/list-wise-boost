import { GraduationCap, ExternalLink, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './VerifiedBadge';
import { Certification } from '@/types/verifiedAgent';
import { formatVerificationDate } from '@/config/dataSources';

interface CertificationsCardProps {
  certifications: Certification[];
}

function CertificationItem({ cert }: { cert: Certification }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <div className="p-2 rounded-full bg-primary/10">
        <GraduationCap className="h-4 w-4 text-primary" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default" className="font-mono">
            {cert.abbreviation}
          </Badge>
          <span className="font-medium text-sm">{cert.fullName}</span>
        </div>
        
        <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
          <span>Issued by {cert.issuingOrganization}</span>
          {cert.issuingOrgUrl && (
            <a 
              href={cert.issuingOrgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
              title={`Visit ${cert.issuingOrganization}`}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        
        {cert.dateEarned && (
          <p className="text-xs text-muted-foreground mt-1">
            Earned: {formatVerificationDate(cert.dateEarned)}
          </p>
        )}
        
        <div className="flex items-center gap-3 mt-2">
          <VerifiedBadge 
            verifiedAt={cert.verifiedAt}
            sourceName={cert.issuingOrganization}
            sourceUrl={cert.verificationUrl}
            variant="compact"
          />
        </div>
      </div>
    </div>
  );
}

export function CertificationsCard({ certifications }: CertificationsCardProps) {
  if (!certifications || certifications.length === 0) return null;

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-5 w-5 text-primary" />
          Professional Certifications
          <Badge variant="secondary" className="ml-auto">
            {certifications.length} cert{certifications.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {certifications.map((cert, index) => (
            <CertificationItem key={`${cert.abbreviation}-${index}`} cert={cert} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
