import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { SafeHead } from "@/components/SafeHead";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface Professional {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  verification_token: string | null;
  verification_token_expires_at: string | null;
}

export default function SimpleFunnelTest() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfessional();
  }, [token]);

  const loadProfessional = async () => {
    if (!token) {
      setError('No token provided');
      setLoading(false);
      return;
    }

    console.log('[SimpleFunnelTest] Looking up token:', token);

    try {
      const { data, error: fetchError } = await supabase
        .from('professionals')
        .select('id, name, email, phone, company, verification_token, verification_token_expires_at')
        .eq('verification_token', token)
        .single();

      console.log('[SimpleFunnelTest] Database response:', { data, error: fetchError });

      if (fetchError) {
        console.error('[SimpleFunnelTest] Database error:', fetchError);
        setError(`Database error: ${fetchError.message} (Code: ${fetchError.code})`);
        setLoading(false);
        return;
      }

      if (!data) {
        setError('No professional found with this token');
        setLoading(false);
        return;
      }

      // Check if token is expired
      if (data.verification_token_expires_at) {
        const expiresAt = new Date(data.verification_token_expires_at);
        const now = new Date();
        console.log('[SimpleFunnelTest] Token expiration check:', {
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString(),
          isExpired: expiresAt < now
        });
        
        if (expiresAt < now) {
          setError(`Token expired at ${expiresAt.toLocaleString()}`);
          setLoading(false);
          return;
        }
      }

      console.log('[SimpleFunnelTest] Token valid! Professional:', data.name);
      setProfessional(data);
      setError(null);
    } catch (err: any) {
      console.error('[SimpleFunnelTest] Unexpected error:', err);
      setError(err.message || 'Failed to load professional');
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

  if (error || !professional) {
    return (
      <>
        <SafeHead>
          <title>Invalid Link | Top10Lists.us</title>
        </SafeHead>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Link Invalid or Expired</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {error || 'This link is invalid or has expired.'}
              </p>
              
              {token && (
                <div className="border rounded-lg p-3 bg-muted/50">
                  <p className="text-xs font-medium mb-1">Token being looked up:</p>
                  <code className="text-xs break-all">{token}</code>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button onClick={loadProfessional} variant="outline" size="sm">
                  <Loader2 className="h-3 w-3 mr-2" />
                  Retry
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground pt-2 border-t">
                Questions? Call <a href="tel:6027589600" className="underline">(602) 758-9600</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SafeHead>
        <title>Welcome {professional.name} | Top10Lists.us</title>
      </SafeHead>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <CardTitle>Funnel Test - Valid Token</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-2">Professional Information:</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-medium">Name:</dt>
                    <dd>{professional.name}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Email:</dt>
                    <dd>{professional.email || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Phone:</dt>
                    <dd>{professional.phone || 'Not provided'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Company:</dt>
                    <dd>{professional.company || 'Not provided'}</dd>
                  </div>
                </dl>
              </div>

              <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
                <h3 className="font-semibold mb-2 text-green-900 dark:text-green-100">Token Details:</h3>
                <dl className="space-y-1 text-sm text-green-800 dark:text-green-200">
                  <div className="flex gap-2">
                    <dt className="font-medium">Token:</dt>
                    <dd className="font-mono text-xs">{token}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium">Expires:</dt>
                    <dd>
                      {professional.verification_token_expires_at
                        ? new Date(professional.verification_token_expires_at).toLocaleString()
                        : 'Never'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="pt-4">
                <p className="text-sm text-muted-foreground text-center">
                  ✓ Token is valid and the funnel would work here
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
