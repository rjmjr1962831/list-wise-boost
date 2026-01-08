import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Save, 
  Loader2, 
  Edit2, 
  Clock, 
  AlertCircle,
  Phone,
  Globe,
  Video,
  FileText,
  Star,
  Building2,
  Award,
  MapPin,
  Mail,
  User,
  Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChangeRequestModal } from "./ChangeRequestModal";

interface PendingRequest {
  id: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string | null;
  status: string;
  created_at: string;
}

interface ProfileSectionProps {
  professional: any;
  sessionToken: string;
  pendingRequests: PendingRequest[];
  onProfileUpdate: () => void;
}

// Self-service fields that agents can edit directly
const SELF_SERVICE_FIELDS = [
  { key: "phone", label: "Phone Number", icon: Phone, type: "tel" },
  { key: "description", label: "Bio / Description", icon: FileText, type: "textarea" },
  { key: "get_to_know_me", label: "Get To Know Me", icon: User, type: "textarea" },
  { key: "image_url", label: "Photo URL", icon: User, type: "url" },
  { key: "website", label: "Website", icon: Globe, type: "url" },
  { key: "sidebar_video_url", label: "Video URL", icon: Video, type: "url" },
  { key: "social_facebook", label: "Facebook", icon: Globe, type: "url" },
  { key: "social_instagram", label: "Instagram", icon: Globe, type: "url" },
  { key: "social_linkedin", label: "LinkedIn", icon: Globe, type: "url" },
  { key: "social_twitter", label: "Twitter", icon: Globe, type: "url" },
  { key: "social_tiktok", label: "TikTok", icon: Globe, type: "url" },
];

// Controlled fields (view only, can request changes)
const CONTROLLED_FIELDS = [
  { key: "email", label: "Email", icon: Mail, note: "Contact support to change email" },
  { key: "name", label: "Name", icon: User },
  { key: "license_number", label: "License Number", icon: Shield },
  { key: "license_status", label: "License Status", icon: Shield },
  { key: "review_stars_rating", label: "Rating", icon: Star },
  { key: "num_total_reviews", label: "Review Count", icon: Star },
  { key: "total_sales", label: "Transaction Count", icon: Award },
  { key: "company", label: "Company / Brokerage", icon: Building2 },
  { key: "years_experience", label: "Years Experience", icon: Award },
];

export function ProfileSection({
  professional,
  sessionToken,
  pendingRequests,
  onProfileUpdate,
}: ProfileSectionProps) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    SELF_SERVICE_FIELDS.forEach((field) => {
      initial[field.key] = professional[field.key] || "";
    });
    return initial;
  });

  const [changeRequestModal, setChangeRequestModal] = useState<{
    isOpen: boolean;
    fieldName: string;
    fieldLabel: string;
    currentValue: string;
  }>({
    isOpen: false,
    fieldName: "",
    fieldLabel: "",
    currentValue: "",
  });

  const hasPendingRequest = (fieldName: string) => {
    return pendingRequests.some((r) => r.field_name === fieldName);
  };

  const handleInputChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      SELF_SERVICE_FIELDS.forEach((field) => {
        if (formData[field.key] !== (professional[field.key] || "")) {
          updates[field.key] = formData[field.key];
        }
      });

      if (Object.keys(updates).length === 0) {
        toast.info("No changes to save");
        setEditMode(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("update-agent-profile", {
        body: { sessionToken, updates },
      });

      if (error) throw error;

      toast.success("Profile updated successfully");
      setEditMode(false);
      onProfileUpdate();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error(error.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestChange = (fieldName: string, fieldLabel: string, currentValue: string) => {
    setChangeRequestModal({
      isOpen: true,
      fieldName,
      fieldLabel,
      currentValue,
    });
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return value.toString();
    return String(value);
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Self-Service Fields */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Editable Profile Fields</CardTitle>
                <CardDescription>You can update these fields directly</CardDescription>
              </div>
              {!editMode ? (
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditMode(false);
                      // Reset form data
                      const reset: Record<string, string> = {};
                      SELF_SERVICE_FIELDS.forEach((f) => {
                        reset[f.key] = professional[f.key] || "";
                      });
                      setFormData(reset);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {SELF_SERVICE_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={field.key} className="flex items-center gap-2 text-sm">
                  <field.icon className="h-4 w-4 text-muted-foreground" />
                  {field.label}
                </Label>
                {editMode ? (
                  field.type === "textarea" ? (
                    <Textarea
                      id={field.key}
                      value={formData[field.key]}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type}
                      value={formData[field.key]}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                    />
                  )
                ) : (
                  <p className="text-sm py-2 px-3 bg-muted/50 rounded-md min-h-[38px]">
                    {professional[field.key] || (
                      <span className="text-muted-foreground italic">Not set</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Controlled Fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Verified Information</CardTitle>
            <CardDescription>
              Request changes to these fields. Our team will review your request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CONTROLLED_FIELDS.map((field) => {
              const isPending = hasPendingRequest(field.key);
              const value = formatValue(professional[field.key]);

              return (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm">
                      <field.icon className="h-4 w-4 text-muted-foreground" />
                      {field.label}
                      {isPending && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </Label>
                    {!isPending && field.key !== "email" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleRequestChange(field.key, field.label, value)}
                      >
                        Request Change
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm py-2 px-3 bg-muted/50 rounded-md flex-1 min-h-[38px]">
                      {value || <span className="text-muted-foreground italic">Not set</span>}
                    </p>
                  </div>
                  {"note" in field && field.note && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {field.note}
                    </p>
                  )}
                </div>
              );
            })}

            {/* City Display */}
            <Separator className="my-4" />
            <div className="space-y-1">
              <Label className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Primary City
              </Label>
              <p className="text-sm py-2 px-3 bg-muted/50 rounded-md">
                {professional.city?.name || "Not assigned"}
                {professional.city?.state && `, ${professional.city.state}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Summary */}
      {pendingRequests.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Change Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-md"
                >
                  <div>
                    <p className="font-medium text-sm">{req.field_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Proposed: {req.proposed_value || "N/A"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Under Review
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ChangeRequestModal
        isOpen={changeRequestModal.isOpen}
        onClose={() =>
          setChangeRequestModal({ isOpen: false, fieldName: "", fieldLabel: "", currentValue: "" })
        }
        fieldName={changeRequestModal.fieldName}
        fieldLabel={changeRequestModal.fieldLabel}
        currentValue={changeRequestModal.currentValue}
        sessionToken={sessionToken}
        onSuccess={onProfileUpdate}
      />
    </>
  );
}
