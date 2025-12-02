import { Shield, Calendar, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './VerifiedBadge';
import { LicenseInfo } from '@/types/verifiedAgent';
import { formatVerificationDate } from '@/config/dataSources';

interface LicenseCardProps {
  license: LicenseInfo;
  brokerage?: string;
}

export function LicenseCard({ license, brokerage }: LicenseCardProps) {
  const statusColors: Record<string, string> = {
    Active: 'bg-cactus-green/20 text-cactus-green border-cactus-green/30',
    Inactive: 'bg-muted text-muted-foreground border-muted',
    Expired: 'bg-destructive/20 text-destructive border-destructive/30',
    Suspended: 'bg-sunset-orange/20 text-sunset-orange border-sunset-orange/30',
    Revoked: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  return (
    <Card className="bg-muted/30 border-muted">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-primary" />
          License Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* License Number & Status */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">License #:</span>
            <span className="font-mono font-medium">{license.licenseNumber}</span>
          </div>
          <Badge 
            variant="outline" 
            className={statusColors[license.status] || statusColors.Active}
          >
            {license.status}
          </Badge>
        </div>

        {/* License Type */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Type:</span>
          <span>{license.licenseType}</span>
        </div>

        {/* Dates */}
        <div className="flex flex-wrap gap-4 text-sm">
          {license.issuedAt && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Issued:</span>
              <span>{formatVerificationDate(license.issuedAt)}</span>
            </div>
          )}
          {license.expiresAt && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Expires:</span>
              <span>{formatVerificationDate(license.expiresAt)}</span>
            </div>
          )}
        </div>

        {/* Brokerage */}
        {brokerage && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Brokerage:</span>
            <span>{brokerage}</span>
          </div>
        )}

        {/* Verification Badge */}
        <div className="pt-2 border-t border-border/50">
          <VerifiedBadge
            verifiedAt={license.verifiedAt}
            sourceName={license.verificationSource}
            sourceUrl={license.verificationUrl}
          />
        </div>
      </CardContent>
    </Card>
  );
}
