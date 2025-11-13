import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AgentApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  brokerage_name: string;
  license_number: string;
  license_verified: boolean;
  specialties: string[];
  cities: string[];
  zip_codes: Record<string, any>;
  status: string;
  website: string;
  zillow_url: string | null;
  bio: string;
  created_at: string;
}

export function AgentApplicationsManager() {
  const [selectedApplication, setSelectedApplication] = useState<AgentApplication | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["agent-applications"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("agent_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AgentApplication[];
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      const { error } = await (supabase as any)
        .from("agent_applications")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      // Send email notification
      const application = applications?.find(app => app.id === id);
      if (application) {
        const { error: emailError } = await supabase.functions.invoke("send-application-decision", {
          body: {
            email: application.email,
            name: application.full_name,
            status,
            notes,
          },
        });

        if (emailError) {
          console.error("Email notification failed:", emailError);
          toast.error("Application updated but email notification failed");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-applications"] });
      toast.success("Application updated successfully");
      setIsViewDialogOpen(false);
      setSelectedApplication(null);
      setReviewNotes("");
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(`Failed to update application: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const handleApprove = async () => {
    if (!selectedApplication) return;
    setIsProcessing(true);
    updateApplicationMutation.mutate({
      id: selectedApplication.id,
      status: "approved",
      notes: reviewNotes,
    });
  };

  const handleReject = async () => {
    if (!selectedApplication) return;
    setIsProcessing(true);
    updateApplicationMutation.mutate({
      id: selectedApplication.id,
      status: "rejected",
      notes: reviewNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Agent Applications</CardTitle>
          <CardDescription>Review and manage agent onboarding applications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Brokerage</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Cities</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No applications found
                    </TableCell>
                  </TableRow>
                ) : (
                  applications?.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.full_name}</TableCell>
                      <TableCell>{app.email}</TableCell>
                      <TableCell>{app.brokerage_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{app.license_number}</span>
                          {app.license_verified && (
                            <Badge variant="outline" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{app.cities.length} cities</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(app.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(app.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedApplication(app);
                            setIsViewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application Review</DialogTitle>
            <DialogDescription>Review agent application details</DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">Full Name</Label>
                  <p className="text-sm">{selectedApplication.full_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Brokerage</Label>
                  <p className="text-sm">{selectedApplication.brokerage_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Email</Label>
                  <p className="text-sm">{selectedApplication.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Phone</Label>
                  <p className="text-sm">{selectedApplication.phone}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">License Number</Label>
                  <p className="text-sm">{selectedApplication.license_number}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Website</Label>
                  <p className="text-sm break-all">{selectedApplication.website}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Bio</Label>
                <p className="text-sm mt-1">{selectedApplication.bio}</p>
              </div>

              <div>
                <Label className="text-sm font-semibold">Specialties</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedApplication.specialties.map((specialty, idx) => (
                    <Badge key={idx} variant="outline">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Service Cities</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedApplication.cities.map((city, idx) => (
                    <Badge key={idx} variant="secondary">
                      {city}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Zip Codes</Label>
                <p className="text-sm mt-1">
                  {Object.keys(selectedApplication.zip_codes).length} zip codes selected
                </p>
              </div>

              <div>
                <Label htmlFor="review-notes">Review Notes</Label>
                <Textarea
                  id="review-notes"
                  placeholder="Add notes about this application (will be included in email)"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="mt-2"
                  rows={4}
                />
              </div>

              {selectedApplication.status === "pending" && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={isProcessing}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={handleApprove} disabled={isProcessing}>
                    {isProcessing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
