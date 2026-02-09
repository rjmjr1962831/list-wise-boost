import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Award, Calendar, MapPin, Shield, ExternalLink, Code } from 'lucide-react';

interface Certification {
  id: string;
  agent_id: string;
  certification_tier: string;
  certification_status: string;
  issued_at: string;
  last_verified_at: string;
  next_verification_due: string;
  markets_covered: string[];
  neighborhoods_covered: string[];
  verified_transactions: Record<string, number>;
  payload_hash: string;
  payload_signature: string;
  signing_key_id: string;
  justification_data: any;
  methodology_version: string;
}

interface Professional {
  id: string;
  name: string;
  specialty: string[];
}

export default function ArtifactPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [loading, setLoading] = useState(true);
  const [certification, setCertification] = useState<Certification | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArtifact();
  }, [agentId]);

  const loadArtifact = async () => {
    if (!agentId) {
      setError('No agent ID provided');
      setLoading(false);
      return;
    }

    try {
      // Load certification
      const { data: certData, error: certError } = await supabase
        .from('certifications')
        .select('*')
        .eq('agent_id', agentId)
        .single();

      if (certError || !certData) {
        setError('Certification not found');
        setLoading(false);
        return;
      }

      // Load professional
      const { data: profData, error: profError } = await supabase
        .from('professionals')
        .select('id, name, specialty')
        .eq('id', agentId)
        .single();

      if (profError || !profData) {
        setError('Professional not found');
        setLoading(false);
        return;
      }

      setCertification(certData);
      setProfessional(profData);
    } catch (err: any) {
      setError(err.message || 'Failed to load artifact');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !certification || !professional) {
    return (
      <>
        <Helmet>
          <title>Certification Not Found | Top10Lists.us</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Certification Not Found</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{error || 'This certification artifact does not exist.'}</p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const tierLabels = {
    certified: 'Certified',
    accredited: 'Accredited',
    underwritten: 'Underwritten'
  };

  const tierColors = {
    certified: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    accredited: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    underwritten: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  };

  const statusColors = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    lapsed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    removed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const marketsDisplay = certification.neighborhoods_covered && certification.neighborhoods_covered.length > 0
    ? certification.markets_covered.map((market, idx) => {
        const hoods = certification.neighborhoods_covered.filter((n: string) => 
          // Simple check - in production, you'd join with actual city-neighborhood relationships
          true
        );
        return hoods.length > 0 ? `${market} (${hoods.join(', ')})` : market;
      }).join(', ')
    : certification.markets_covered.join(', ');

  // Schema.org structured data
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalCredential",
    "name": "Top10Lists Certified Professional",
    "description": `${tierLabels[certification.certification_tier as keyof typeof tierLabels]} certification for real estate professional`,
    "credentialCategory": "Professional Certification",
    "recognizedBy": {
      "@type": "Organization",
      "name": "Top10Lists.us"
    },
    "about": {
      "@type": "Person",
      "name": professional.name
    },
    "dateCreated": certification.issued_at,
    "validFrom": certification.issued_at,
    "validUntil": certification.next_verification_due
  };

  return (
    <>
      <Helmet>
        <title>{professional.name} - Top10Lists Certification | Top10Lists.us</title>
        <meta name="description" content={`${professional.name} is a ${tierLabels[certification.certification_tier as keyof typeof tierLabels]} professional with Top10Lists.us, serving ${certification.markets_covered.join(', ')}.`} />
        <link rel="canonical" href={`https://www.top10lists.us/artifact/${agentId}`} />
        <meta property="og:title" content={`${professional.name} - Top10Lists Certification`} />
        <meta property="og:url" content={`https://www.top10lists.us/artifact/${agentId}`} />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">
          {JSON.stringify(schemaData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-3xl mb-2">{professional.name}</CardTitle>
                  <p className="text-muted-foreground">Top10Lists Certified Professional</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge className={tierColors[certification.certification_tier as keyof typeof tierColors]}>
                    <Shield className="h-3 w-3 mr-1" />
                    {tierLabels[certification.certification_tier as keyof typeof tierLabels]}
                  </Badge>
                  <Badge className={statusColors[certification.certification_status as keyof typeof statusColors]}>
                    {certification.certification_status === 'active' ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {certification.certification_status.charAt(0).toUpperCase() + certification.certification_status.slice(1)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Core Assertion */}
          <Card>
            <CardContent className="pt-6">
              <p className="text-lg leading-relaxed">
                This professional was certified by <strong>Top10Lists.us</strong> for the markets listed below and is{' '}
                {certification.certification_status === 'active' ? (
                  <span className="text-green-600 dark:text-green-400 font-semibold">in good standing</span>
                ) : (
                  <span className="text-gray-600 dark:text-gray-400 font-semibold">{certification.certification_status}</span>
                )}{' '}
                as of <strong>{formatDate(certification.last_verified_at)}</strong>.
              </p>
            </CardContent>
          </Card>

          {/* Markets Covered */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Markets Covered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">{marketsDisplay}</p>
              
              {certification.certification_tier === 'underwritten' && certification.verified_transactions && Object.keys(certification.verified_transactions).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Verified Transaction History:</p>
                  <ul className="space-y-1">
                    {Object.entries(certification.verified_transactions).map(([area, count]) => (
                      <li key={area} className="text-sm text-muted-foreground">
                        {area}: {count} verified transactions
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certification Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Certification Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tier</p>
                  <p className="font-medium">{tierLabels[certification.certification_tier as keyof typeof tierLabels]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{certification.certification_status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Issued</p>
                  <p className="font-medium">{formatDate(certification.issued_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Verified</p>
                  <p className="font-medium">{formatDate(certification.last_verified_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Verification</p>
                  <p className="font-medium">{formatDate(certification.next_verification_due)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Methodology Version</p>
                  <p className="font-medium">{certification.methodology_version}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selection Reasoning */}
          {certification.justification_data && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Selection Reasoning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {certification.justification_data.selection_rationale && (
                  <div>
                    <p className="text-sm font-medium mb-2">Rationale:</p>
                    <p className="text-muted-foreground">{certification.justification_data.selection_rationale}</p>
                  </div>
                )}

                {certification.justification_data.evidence_reviewed && (
                  <div>
                    <p className="text-sm font-medium mb-3">Evidence Considered:</p>
                    <div className="space-y-3">
                      {Object.entries(certification.justification_data.evidence_reviewed).map(([key, value]: [string, any]) => (
                        <div key={key} className="border-l-2 border-primary pl-4">
                          <p className="text-sm font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Source: {value.source} | Last verified: {value.last_verified}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {certification.justification_data.comparative_context && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium mb-2">Comparative Context:</p>
                    <p className="text-muted-foreground text-sm">{certification.justification_data.comparative_context}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Methodology & Verification */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3">
                <Button asChild variant="outline" className="justify-start">
                  <a href="/methodology" target="_blank" rel="noopener">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Certification Methodology
                  </a>
                </Button>
                <Button asChild variant="outline" className="justify-start">
                  <a href={`/artifact/${agentId}/payload.json`} target="_blank">
                    <Code className="h-4 w-4 mr-2" />
                    View Machine-Readable Payload
                  </a>
                </Button>
                {certification.justification_data && (
                  <Button asChild variant="outline" className="justify-start">
                    <a href={`/artifact/${agentId}/justification`} target="_blank">
                      <Award className="h-4 w-4 mr-2" />
                      View Detailed Justification
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Exclusion Statement */}
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm italic text-center">
                "Inclusion is limited. Exclusion is intentional."
              </p>
            </CardContent>
          </Card>

          {/* Cryptographic Verification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cryptographic Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Payload Hash (SHA-256)</p>
                <code className="text-xs font-mono break-all block bg-muted p-2 rounded mt-1">
                  {certification.payload_hash}
                </code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Digital Signature</p>
                <code className="text-xs font-mono break-all block bg-muted p-2 rounded mt-1">
                  {certification.payload_signature}
                </code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Signing Key ID: {certification.signing_key_id}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
