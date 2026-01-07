import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, RefreshCw, ExternalLink, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FieldChangeRequest {
  id: string;
  professional_id: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string | null;
  change_request: string;
  status: string;
  pipedrive_activity_id: number | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  professional?: {
    name: string;
    email: string | null;
    profile_link: string | null;
  };
}

export function FieldChangeRequestsManager() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<FieldChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<FieldChangeRequest | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('field_change_requests')
        .select(`
          *,
          professional:professionals(name, email, profile_link)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as FieldChangeRequest[]);
    } catch (err: any) {
      console.error('Error fetching requests:', err);
      toast({
        title: 'Error',
        description: 'Failed to fetch change requests',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const sendCompletionEmail = async (request: FieldChangeRequest, status: 'approved' | 'rejected') => {
    if (!request.professional?.email) {
      console.log('No email for professional, skipping completion email');
      return;
    }

    try {
      const firstName = request.professional.name?.split(' ')[0] || 'there';
      
      const { error } = await supabase.functions.invoke('send-change-request-completed', {
        body: {
          email: request.professional.email,
          firstName,
          results: [{
            fieldName: request.field_name,
            previousValue: request.current_value,
            newValue: status === 'approved' ? request.proposed_value : request.current_value,
            status
          }]
        }
      });

      if (error) {
        console.error('Failed to send completion email:', error);
      } else {
        console.log('Completion email sent to:', request.professional.email);
      }
    } catch (err) {
      console.error('Error sending completion email:', err);
    }
  };

  const handleApprove = async (request: FieldChangeRequest) => {
    setProcessing(request.id);
    try {
      // Update the professional's field with the proposed value
      const updateData: Record<string, any> = {
        [request.field_name === 'Bio (Our Synthesis)' ? 'synthesized_bio' : request.field_name.toLowerCase().replace(/\s+/g, '_')]: request.proposed_value,
        skip_pipedrive_sync: false
      };

      const { error: updateError } = await supabase
        .from('professionals')
        .update(updateData)
        .eq('id', request.professional_id);

      if (updateError) throw updateError;

      // Mark request as approved
      const { error: statusError } = await supabase
        .from('field_change_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'admin'
        })
        .eq('id', request.id);

      if (statusError) throw statusError;

      // Send completion email
      await sendCompletionEmail(request, 'approved');

      toast({
        title: 'Approved',
        description: `${request.field_name} has been updated for ${request.professional?.name}`
      });

      fetchRequests();
      setShowDialog(false);
    } catch (err: any) {
      console.error('Error approving request:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to approve request',
        variant: 'destructive'
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: FieldChangeRequest) => {
    setProcessing(request.id);
    try {
      const { error } = await supabase
        .from('field_change_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'admin'
        })
        .eq('id', request.id);

      if (error) throw error;

      // Send completion email
      await sendCompletionEmail(request, 'rejected');

      toast({
        title: 'Rejected',
        description: `Change request for ${request.professional?.name} has been rejected`
      });

      fetchRequests();
      setShowDialog(false);
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to reject request',
        variant: 'destructive'
      });
    } finally {
      setProcessing(null);
    }
  };

  const openReviewDialog = (request: FieldChangeRequest) => {
    setSelectedRequest(request);
    setShowDialog(true);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Field Change Requests</CardTitle>
              <CardDescription>
                Review and approve agent profile field change requests
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No change requests found</p>
          ) : (
            <div className="space-y-6">
              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-lg">
                    Pending Requests ({pendingRequests.length})
                  </h3>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{request.professional?.name}</span>
                              {getStatusBadge(request.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Field: <span className="font-medium">{request.field_name}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(request.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReviewDialog(request)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Processed Requests */}
              {processedRequests.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-lg text-muted-foreground">
                    Processed ({processedRequests.length})
                  </h3>
                  <div className="space-y-2">
                    {processedRequests.slice(0, 10).map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-3 opacity-70"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{request.professional?.name}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">{request.field_name}</span>
                            {getStatusBadge(request.status)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {request.reviewed_at && new Date(request.reviewed_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Review Change Request</DialogTitle>
            <DialogDescription>
              Compare current and proposed values before approving
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* Agent Info */}
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-semibold">{selectedRequest.professional?.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRequest.professional?.email}</p>
                </div>
                {selectedRequest.professional?.profile_link && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedRequest.professional.profile_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View Profile
                    </a>
                  </Button>
                )}
              </div>

              {/* Field Name */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Field</p>
                <p className="font-medium">{selectedRequest.field_name}</p>
              </div>

              {/* Agent's Request */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium text-muted-foreground mb-1">Agent's Request</p>
                <p className="text-sm whitespace-pre-wrap">{selectedRequest.change_request}</p>
              </div>

              {/* Comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Current Value */}
                <div className="border rounded-lg p-3">
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-400"></span>
                    Current Value
                  </p>
                  <ScrollArea className="h-48">
                    <div 
                      className="text-sm whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ 
                        __html: selectedRequest.current_value || '<em class="text-muted-foreground">No current value</em>' 
                      }}
                    />
                  </ScrollArea>
                </div>

                {/* Proposed Value */}
                <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950/20">
                  <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-400"></span>
                    Proposed Value
                  </p>
                  <ScrollArea className="h-48">
                    <div 
                      className="text-sm whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ 
                        __html: selectedRequest.proposed_value || '<em class="text-muted-foreground">No proposed value</em>' 
                      }}
                    />
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={!!processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedRequest && handleReject(selectedRequest)}
              disabled={!!processing}
            >
              {processing === selectedRequest?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <X className="h-4 w-4 mr-1" />
              )}
              Reject
            </Button>
            <Button
              onClick={() => selectedRequest && handleApprove(selectedRequest)}
              disabled={!!processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing === selectedRequest?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Check className="h-4 w-4 mr-1" />
              )}
              Approve & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}