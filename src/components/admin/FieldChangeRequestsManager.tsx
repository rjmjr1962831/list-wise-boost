import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Check, X, RefreshCw, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FieldChangeRequest {
  id: string;
  professional_id: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string | null;
  change_request: string | null;
  status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  professional?: {
    name: string;
    email: string | null;
    profile_link: string | null;
    short_code: string | null;
  };
}

export function FieldChangeRequestsManager() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<FieldChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('field_change_requests')
        .select(`
          *,
          professional:professionals(name, email, profile_link, short_code)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      }

      const { data, error } = await query;
      if (error) throw error;
      setRequests((data || []) as FieldChangeRequest[]);
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to fetch change requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const getProfileUrl = (req: FieldChangeRequest) => {
    if (req.professional?.profile_link) return `https://www.top10lists.us${req.professional.profile_link}`;
    if (req.professional?.short_code) return `https://www.top10lists.us/agents/${req.professional.short_code}`;
    return null;
  };

  const handleAction = async (request: FieldChangeRequest, action: 'approved' | 'rejected') => {
    const reason = reasonMap[request.id] || '';
    if (action === 'rejected' && !reason.trim()) {
      toast({ title: 'Reason required', description: 'Please enter a reason for rejecting this request.', variant: 'destructive' });
      return;
    }

    setProcessing(request.id);
    try {
      // If approving, update the professional's field
      if (action === 'approved' && request.proposed_value) {
        const fieldMap: Record<string, string> = {
          'Full Name': 'name',
          'License Number': 'license_number',
          'Years of Experience': 'years_experience',
          'Total Sales': 'total_sales',
          'Reviews': 'num_total_reviews',
        };
        const dbField = fieldMap[request.field_name] || request.field_name.toLowerCase().replace(/\s+/g, '_');

        let value: any = request.proposed_value;
        if (['years_experience', 'total_sales', 'num_total_reviews'].includes(dbField)) {
          value = parseInt(value) || null;
        }

        const { error: updateError } = await supabase
          .from('professionals')
          .update({ [dbField]: value })
          .eq('id', request.professional_id);

        if (updateError) throw updateError;
      }

      // Update the request status
      const { error: statusError } = await supabase
        .from('field_change_requests')
        .update({
          status: action,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reason.trim() ? `admin: ${reason.trim()}` : 'admin',
        })
        .eq('id', request.id);

      if (statusError) throw statusError;

      // Send decision email (fire and forget)
      if (request.professional?.email) {
        const firstName = (request.professional.name || '').split(' ')[0] || 'there';
        supabase.functions.invoke('send-change-request-completed', {
          body: {
            email: request.professional.email,
            firstName,
            fieldName: request.field_name,
            decision: action,
            reason: reason.trim(),
            currentValue: request.current_value,
            newValue: action === 'approved' ? request.proposed_value : null,
          },
        }).catch((err) => console.error('Decision email failed (non-fatal):', err));
      }

      toast({
        title: action === 'approved' ? 'Approved' : 'Rejected',
        description: `${request.field_name} for ${request.professional?.name} has been ${action}.`,
      });

      setReasonMap((prev) => { const n = { ...prev }; delete n[request.id]; return n; });
      fetchRequests();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || `Failed to ${action} request`, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'approved') return 'bg-green-100 text-green-800';
    if (s === 'rejected') return 'bg-red-100 text-red-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Field Change Requests</CardTitle>
            <CardDescription>Review and approve or reject agent-submitted changes.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')}>
              Pending
            </Button>
            <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
              All
            </Button>
            <Button variant="outline" size="sm" onClick={fetchRequests}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No {filter === 'pending' ? 'pending ' : ''}change requests.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const profileUrl = getProfileUrl(req);
              return (
                <div key={req.id} className="border rounded-lg p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{req.professional?.name || 'Unknown'}</span>
                        <Badge className={statusColor(req.status)}>{req.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleString()}
                        {req.professional?.email && ` · ${req.professional.email}`}
                      </p>
                    </div>
                    {profileUrl && (
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm flex items-center gap-1 shrink-0"
                      >
                        View Profile <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* Field details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Field</Label>
                      <p className="font-medium">{req.field_name}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Current Value</Label>
                      <p className="font-mono text-sm bg-muted/50 rounded px-2 py-1">{req.current_value || '(empty)'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Requested Value</Label>
                      <p className="font-mono text-sm bg-primary/5 border border-primary/20 rounded px-2 py-1">{req.proposed_value || '(empty)'}</p>
                    </div>
                  </div>

                  {/* Confirmation source */}
                  {req.change_request && (
                    <div className="text-sm">
                      <Label className="text-xs text-muted-foreground">Confirmation Source</Label>
                      <p className="text-muted-foreground">{req.change_request}</p>
                    </div>
                  )}

                  {/* Reviewed by info */}
                  {req.reviewed_by && (
                    <div className="text-xs text-muted-foreground">
                      Reviewed: {req.reviewed_by} at {req.reviewed_at ? new Date(req.reviewed_at).toLocaleString() : ''}
                    </div>
                  )}

                  {/* Action area - only for pending */}
                  {req.status === 'pending' && (
                    <div className="border-t pt-3 space-y-2">
                      <div>
                        <Label htmlFor={`reason-${req.id}`} className="text-xs">
                          Why? {req.status === 'pending' && '(required for rejection)'}
                        </Label>
                        <Textarea
                          id={`reason-${req.id}`}
                          value={reasonMap[req.id] || ''}
                          onChange={(e) => setReasonMap((prev) => ({ ...prev, [req.id]: e.target.value }))}
                          placeholder="Reason for your decision..."
                          rows={2}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAction(req, 'approved')}
                          disabled={processing === req.id}
                          className="gap-1 bg-green-600 hover:bg-green-700"
                        >
                          {processing === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleAction(req, 'rejected')}
                          disabled={processing === req.id}
                          className="gap-1"
                        >
                          {processing === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
