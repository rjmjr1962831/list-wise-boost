import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { supabase } from "@/integrations/supabase/client";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ArrowLeft, Pencil, Check, Plus } from "lucide-react";
import { toast } from "sonner";

interface FieldState {
  value: string;
  original: string;
  editing: boolean;
  dirty: boolean;
}

function useField(initial: string) {
  const [state, setState] = useState<FieldState>({
    value: initial, original: initial, editing: false, dirty: false,
  });
  const set = (value: string) => setState(s => ({ ...s, value, dirty: value !== s.original }));
  const startEdit = () => setState(s => ({ ...s, editing: true }));
  const confirm = () => setState(s => ({ ...s, editing: false }));
  const init = (v: string) => setState({ value: v, original: v, editing: false, dirty: false });
  return { ...state, set, startEdit, confirm, init };
}

export default function SandboxStep2() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { trackEvent } = useGA4Tracking();

  const passedProfessional = (location.state as any)?.professional ?? null;

  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const email = useField("");
  const phone = useField("");
  const cellPhone = useField("");
  const website = useField("");
  const nickname = useField("");

  const [phoneVisible, setPhoneVisible] = useState(true);
  const [cellPhoneVisible, setCellPhoneVisible] = useState(true);
  const [emailVisible, setEmailVisible] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const load = async () => {
      if (!token) { navigate("/check-profile"); return; }

      let prof = passedProfessional;
      if (!prof) {
        try {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
          let { data, error } = await supabase
            .from("professionals")
            .select(`*, cities:city_id (id, name, state, state_slug, slug)`)
            .eq("verification_token", token).maybeSingle();
          if (!data && !error && isUUID) {
            const fb = await supabase.from("professionals")
              .select(`*, cities:city_id (id, name, state, state_slug, slug)`)
              .eq("id", token).maybeSingle();
            data = fb.data; error = fb.error;
          }
          if (error || !data || !data.active) { navigate("/check-profile"); return; }
          prof = data;
        } catch { navigate("/check-profile"); return; }
      }

      setProfessional(prof);
      email.init(prof.email ?? "");
      phone.init(prof.phone ?? "");
      cellPhone.init(prof.cell_phone ?? "");
      website.init(prof.website ?? "");
      nickname.init(prof.nickname ?? "");
      setPhoneVisible(prof.phone_visible !== false);
      setEmailVisible(prof.email_visible !== false);
      setLoading(false);
    };
    load();
  }, [token]);

  const saveField = async (field: string, value: string) => {
    const { error } = await supabase.functions.invoke("update-professional-field", {
      body: { token: professional.id, field, value },
    });
    if (error) {
      toast.error(`Failed to save ${field}.`);
      return false;
    }
    toast.success(`${field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, " ")} saved.`);
    return true;
  };

  const handleFieldSave = async (fieldName: string, fieldHook: ReturnType<typeof useField>) => {
    if (!fieldHook.dirty) { fieldHook.confirm(); return; }
    const ok = await saveField(fieldName, fieldHook.value);
    if (ok) {
      fieldHook.confirm();
      fieldHook.init(fieldHook.value);
    }
  };

  const handleVisibilityChange = async (field: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    await supabase.functions.invoke("update-professional-field", {
      body: { token: professional.id, field, value: value.toString() },
    });
  };

  const handleSubmit = async () => {
    if (!professional || !consentChecked) return;
    setSaving(true);
    try {
      // Save any remaining dirty fields
      const fieldsToSave: [string, ReturnType<typeof useField>][] = [
        ["email", email], ["phone", phone], ["cell_phone", cellPhone],
        ["website", website], ["nickname", nickname],
      ];
      const changedFields: string[] = [];
      for (const [name, hook] of fieldsToSave) {
        if (hook.dirty) {
          const ok = await saveField(name, hook.value);
          if (!ok) { setSaving(false); return; }
          changedFields.push(name);
        }
      }

      trackEvent("sandbox_step2_complete", {
        professional_id: professional.id,
        fields_changed: changedFields,
      });

      supabase.functions.invoke("send-funnel-notification", {
        body: {
          event_type: "sandbox_contact_submitted",
          agent_name: professional.name,
          agent_email: email.value,
          agent_id: professional.id,
        },
      }).catch(() => {});

      navigate(`/sandbox/${token}/why`, {
        state: { professional: { ...professional, email: email.value, phone: phone.value, website: website.value, nickname: nickname.value } },
      });
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SafeHead><title>Certify Your Data | Top10Lists.us</title><meta name="robots" content="noindex, nofollow" /></SafeHead>
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) return null;

  const renderField = (
    label: string, fieldHook: ReturnType<typeof useField>, fieldName: string,
    opts: { type?: string; required?: boolean; placeholder?: string; hint?: string } = {}
  ) => {
    const { type = "text", required = false, placeholder = "", hint } = opts;
    const isEmpty = !fieldHook.value.trim();
    return (
      <div>
        <Label htmlFor={fieldName} className="text-sm font-medium">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            id={fieldName}
            type={type}
            value={fieldHook.value}
            onChange={(e) => { fieldHook.set(e.target.value); if (!fieldHook.editing) fieldHook.startEdit(); }}
            onFocus={() => fieldHook.startEdit()}
            placeholder={placeholder}
            className="border-2 border-border focus:border-primary"
            required={required}
          />
          {fieldHook.editing ? (
            <Button
              size="icon"
              variant={fieldHook.dirty ? "default" : "outline"}
              className="flex-shrink-0 h-10 w-10"
              onClick={() => handleFieldSave(fieldName, fieldHook)}
              title="Save"
            >
              <Check className="h-4 w-4" />
            </Button>
          ) : isEmpty ? (
            <Button
              size="icon"
              variant="outline"
              className="flex-shrink-0 h-10 w-10"
              onClick={() => fieldHook.startEdit()}
              title="Add"
            >
              <Plus className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="flex-shrink-0 h-10 w-10"
              onClick={() => fieldHook.startEdit()}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        {fieldHook.dirty && <p className="text-xs text-primary mt-1">Unsaved change</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SafeHead>
        <title>Certify Your Data | Top10Lists.us</title>
        <meta name="robots" content="noindex, nofollow" />
      </SafeHead>

      <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
        {/* Agent name */}
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-1">
          {professional.name}
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Review and certify your contact information below.
        </p>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Nickname */}
            {renderField("Preferred Name / Nickname", nickname, "nickname", {
              placeholder: "How you prefer to be addressed",
              hint: "Leave blank to use your full name.",
            })}

            {/* Email */}
            <div>
              {renderField("Email", email, "email", {
                type: "email", required: true, placeholder: "you@example.com",
              })}
              <div className="flex items-center justify-between mt-2 px-1">
                <Label htmlFor="email-visible" className="text-xs text-muted-foreground">Publish on listing</Label>
                <Switch
                  id="email-visible"
                  checked={emailVisible}
                  onCheckedChange={(v) => handleVisibilityChange("email_visible", v, setEmailVisible)}
                />
              </div>
            </div>

            {/* Primary Phone */}
            <div>
              {renderField("Primary Phone", phone, "phone", {
                type: "tel", required: true, placeholder: "(555) 123-4567",
                hint: "Tip: If this is your Zillow tracking number, consider using your direct line instead.",
              })}
              <div className="flex items-center justify-between mt-2 px-1">
                <Label htmlFor="phone-visible" className="text-xs text-muted-foreground">Publish on listing</Label>
                <Switch
                  id="phone-visible"
                  checked={phoneVisible}
                  onCheckedChange={(v) => handleVisibilityChange("phone_visible", v, setPhoneVisible)}
                />
              </div>
            </div>

            {/* Secondary Phone */}
            <div>
              {renderField("Secondary Phone", cellPhone, "cell_phone", {
                type: "tel", placeholder: "(555) 987-6543",
                hint: "Optional. Add a mobile or alternate number.",
              })}
              <div className="flex items-center justify-between mt-2 px-1">
                <Label htmlFor="cell-phone-visible" className="text-xs text-muted-foreground">Publish on listing</Label>
                <Switch
                  id="cell-phone-visible"
                  checked={cellPhoneVisible}
                  onCheckedChange={(v) => handleVisibilityChange("cell_phone_visible", v, setCellPhoneVisible)}
                />
              </div>
            </div>

            {/* Website */}
            {renderField("Website", website, "website", {
              type: "url", placeholder: "https://yoursite.com",
            })}

            {/* Consent */}
            <div className="border-t pt-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="consent"
                  checked={consentChecked}
                  onCheckedChange={(v) => setConsentChecked(!!v)}
                />
                <Label htmlFor="consent" className="text-sm font-normal leading-snug">
                  I confirm that I have read and agree to the{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline text-primary">Terms and Conditions</a>{" "}
                  and{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-primary">Privacy Policy</a>
                  , and agree to receive account status and two-factor authentication communications from Top10Lists.us. I can opt out any time.
                </Label>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => navigate(`/sandbox/${token}`)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={!consentChecked || !email.value.trim() || !phone.value.trim() || saving}
                onClick={handleSubmit}
              >
                {saving ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>) : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
