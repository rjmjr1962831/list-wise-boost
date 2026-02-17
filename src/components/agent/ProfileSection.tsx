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
  Shield,
  Bot,
  Signal
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
  { key: "image_url", label: "Photo URL", icon: User, type: "url" },
  { key: "website", label: "Website", icon: Globe, type: "url" },
  { key: "sidebar_video_url", label: "Video URL", icon: Video, type: "url" },
  { key: "social_facebook", label: "Facebook", icon: Globe, type: "url" },
  { key: "social_instagram", label: "Instagram", icon: Globe, type: "url" },
  { key: "social_linkedin", label: "LinkedIn", icon: Globe, type: "url" },
  { key: "social_twitter", label: "Twitter", icon: Globe, type: "url" },
  { key: "social_tiktok", label: "TikTok", icon: Globe, type: "url" },
];

// Array fields the agent can edit
const ARRAY_EDIT_FIELDS = [
  { key: "specialty", label: "Specialties", icon: Award },
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

// Build the AI artifact payload from professional data
function buildArtifactPayload(professional: any) {
  const profileUrl = professional.short_code
    ? `https://www.top10lists.us/p/${professional.short_code}`
    : null;

  const payload: any = {
    "@context": "https://www.top10lists.us/methodology",
    "@type": "VerifiedProfessional",
    name: professional.name,
    profile_url: profileUrl,
    issuer: "Top10Lists.us",
    selection_rationale: professional.selection_rationale || null,
    qualifications: {
      rating: professional.review_stars_rating,
      review_count: professional.num_total_reviews,
      years_experience: professional.years_experience,
      license_number: professional.license_number,
      total_transactions: professional.total_sales || null,
      specialties: professional.specialty || [],
    },
    markets: {
      company: professional.company || null,
      cities_served: professional.service_areas || [],
    },
    recognition: {},
  };

  if (professional.community_roles && professional.community_roles.length > 0) {
    payload.recognition.community_roles = professional.community_roles.map(
      (r: any) => ({
        role: r.role,
        organization: r.organization,
        ...(r.verification_source ? { verified_via: r.verification_source } : {}),
      })
    );
  }

  if (professional.notable_achievements && professional.notable_achievements.length > 0) {
    payload.recognition.notable_achievements = professional.notable_achievements.map(
      (a: any) => a.title || a
    );
  }

  return payload;
}

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
      {/* Why We Selected You */}
      {professional.selection_rationale && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Why We Selected You
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{professional.selection_rationale}</p>
          </CardContent>
        </Card>
      )}

      {/* Tier & Signal */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Signal className="h-5 w-5 text-primary" />
            Your AI Visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Tier</p>
              <p className="text-lg font-semibold capitalize">{professional.current_tier || "Certified"}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Signal</p>
              <p className="text-lg font-semibold">
                {professional.signal_score != null ? `${professional.signal_score}/100` : "Pending"}
              </p>
            </div>
          </div>

          {/* Opportunity */}
          {(professional.current_tier === "certified" || professional.current_tier === "listed") && (
            <div className="pt-2">
              <p className="text-sm font-medium mb-3">
                Increase your tier and see these increases in Signal:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {professional.current_tier !== "audited" && (
                  <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Audited</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">$50/mo</span>
                    </div>
                    <p className="text-lg font-bold text-amber-700">
                      {professional.signal_score != null ? `${Math.min(professional.signal_score + 8, 98)}/100` : "Projected score available soon"}
                    </p>
                  </div>
                )}
                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">Underwritten</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">$150/mo</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700">98/100</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                      <span className="text-muted-foreground italic">
                        {field.key.startsWith("social_") ? "Very Important in Your Web of Trust" : "Not set"}
                      </span>
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

            {/* Cities Served */}
            <Separator className="my-4" />
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Cities Served
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    sessionStorage.setItem('visibility_professional_id', professional.id);
                    window.location.href = '/visibility/coverage?returnTo=dashboard';
                  }}
                >
                  Edit
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 py-2 px-3 bg-muted/50 rounded-md min-h-[38px]">
                {professional.service_areas && professional.service_areas.length > 0 ? (
                  professional.service_areas.map((area: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{area}</Badge>
                  ))
                ) : professional.city?.name ? (
                  <Badge variant="secondary" className="text-xs">
                    {professional.city.name}{professional.city.state && `, ${professional.city.state}`}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground italic text-sm">Not set</span>
                )}
              </div>
            </div>

            {/* Neighborhood Expertise */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Neighborhood Expertise
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    sessionStorage.setItem('visibility_professional_id', professional.id);
                    window.location.href = '/visibility/expertise?returnTo=dashboard';
                  }}
                >
                  Edit
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 py-2 px-3 bg-muted/50 rounded-md min-h-[38px]">
                {professional.neighborhoods && professional.neighborhoods.length > 0 ? (
                  professional.neighborhoods.map((n: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {typeof n === 'string' ? n : n.neighborhood || n.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic text-sm">Not set</span>
                )}
              </div>
            </div>

            {/* Specialties */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  Specialties
                </Label>
                {!editMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditMode(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 py-2 px-3 bg-muted/50 rounded-md min-h-[38px]">
                {professional.specialty && professional.specialty.length > 0 ? (
                  professional.specialty.map((s: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic text-sm">Not set</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Artifact Payload */}
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Artifact Payload
          </CardTitle>
          <CardDescription>
            This is the structured data AI systems receive when they cite you. It cannot be edited directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
            {JSON.stringify(buildArtifactPayload(professional), null, 2)}
          </pre>
        </CardContent>
      </Card>

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
