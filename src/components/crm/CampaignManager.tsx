/**
 * Campaign Manager: Step-by-step campaign wizard, review queue, and monitor.
 * Part of Email Sequencer v2.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { type ListMakerCriteria, getSavedListTemplates, type SavedListTemplate } from "./ListMaker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Campaign {
  id: string;
  name: string;
  status: string;
  template_subject: string | null;
  template_html: string | null;
  created_at: string;
  reviewed_by: string | null;
  approved_at: string | null;
  total_recipients: number;
  total_sent: number;
  total_opens: number;
  total_clicks: number;
}

type Tab = "wizard" | "review" | "monitor";

const SENDER_ACCOUNTS = [
  "hello@toptenlists.us",
  "robert@toptenlists.us",
  "mark@toptenlists.us",
  "hello@top10lists.us",
  "robert@top10lists.us",
];

const SAMPLE_DATA: Record<string, string> = {
  firstName: "Jane",
  lastName: "Smith",
  city: "Phoenix",
  state: "Arizona",
  company: "Sunshine Realty",
  magicLink: "https://toptenlists.us/claim/sample-agent",
  email: "jane@example.com",
  tier: "Listed",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-200 text-gray-800",
  pending_review: "bg-yellow-200 text-yellow-800",
  approved: "bg-blue-200 text-blue-800",
  active: "bg-green-200 text-green-800",
  paused: "bg-orange-200 text-orange-800",
  complete: "bg-purple-200 text-purple-800",
};

const BASE_TEMPLATE_VARIABLES = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "company", label: "Company" },
  { key: "magicLink", label: "Magic Link" },
  { key: "email", label: "Email" },
  { key: "tier", label: "Tier" },
];

const WIZARD_STEPS = ["Create or Select Campaign", "Build List", "Create Email", "Send Gates", "Review", "Test", "Launch"];

const WIZARD_STATES = [
  { value: "arizona", label: "Arizona" },
  { value: "california", label: "California" },
  { value: "texas", label: "Texas" },
  { value: "florida", label: "Florida" },
  { value: "colorado", label: "Colorado" },
  { value: "new-york", label: "New York" },
];

const WIZARD_TIERS = [
  { value: "listed", label: "Listed" },
  { value: "certified", label: "Certified" },
  { value: "audited", label: "Audited" },
  { value: "underwritten", label: "Underwritten" },
];

const TEST_RECIPIENTS = [
  { email: "rjmjr1@proton.me", name: "Robert (Proton)" },
  { email: "robert@maynard.com", name: "Robert (Maynard)" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

function renderTemplate(html: string, vars: Record<string, string>): string {
  let out = html;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v);
  }
  out = out.replace(/\[\[BLOCK\]\]/g, "").replace(/\[\[\/BLOCK\]\]/g, "");
  return out;
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Campaign Wizard — step-by-step campaign creation
// ---------------------------------------------------------------------------

interface SequenceTemplate {
  sequence_id: string;
  sequence_name: string;
  step_number: number;
  subject: string;
  body: string;
}

function CampaignWizard({
  campaigns,
  onRefresh,
}: {
  campaigns: Campaign[];
  onRefresh: () => void;
}) {
  const [step, setStep] = useState(0);

  // Step 0: Select List
  const [criteria, setCriteria] = useState<ListMakerCriteria>({
    active: true,
    state_slugs: [],
    current_tiers: [],
    min_rating: 0,
    email_verified: false,
    has_license: false,
  });
  const [listCount, setListCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [savedLists] = useState<SavedListTemplate[]>(getSavedListTemplates);

  // Step 1: Create Email
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senders, setSenders] = useState<string[]>([SENDER_ACCOUNTS[0]]);
  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [existingCampaignId, setExistingCampaignId] = useState<string>("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Step 3: Send Gates
  const [maxPerDay, setMaxPerDay] = useState(35);
  const [uptickPerDay, setUptickPerDay] = useState(10);
  const [minSecondsBetweenSends, setMinSecondsBetweenSends] = useState(120);

  // Step 5: Test
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testsSent, setTestsSent] = useState<string[]>([]);

  // Step 4: Launch
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [launchMode, setLaunchMode] = useState<"active" | "draft">("draft");
  const [launchedCount, setLaunchedCount] = useState(0);
  const [scheduledStartMST, setScheduledStartMST] = useState("");

  // ---- Step 0 helpers ----
  const fetchListCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      let q = supabase
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .not("email", "is", null)
        .neq("email", "");
      if (criteria.active === true) q = q.eq("active", true);
      if (criteria.active === false) q = q.eq("active", false);
      if (Array.isArray(criteria.state_slugs) && criteria.state_slugs.length > 0)
        q = q.in("state_slug", criteria.state_slugs);
      if (Array.isArray(criteria.current_tiers) && criteria.current_tiers.length > 0)
        q = q.in("current_tier", criteria.current_tiers);
      if (criteria.min_rating != null && criteria.min_rating > 0)
        q = q.gte("review_stars_rating", criteria.min_rating);
      if (criteria.email_verified) q = q.not("email_verified_at", "is", null);
      if (criteria.has_license)
        q = q.not("license_number", "is", null).neq("license_number", "");
      const { count, error } = await q;
      if (error) throw error;
      setListCount(count ?? 0);
    } catch (e: any) {
      toast.error("Count failed: " + e.message);
    } finally {
      setLoadingCount(false);
    }
  }, [criteria]);

  useEffect(() => {
    fetchListCount();
  }, [fetchListCount]);

  // ---- Step 1 helpers ----
  useEffect(() => {
    (async () => {
      setLoadingTemplates(true);
      try {
        const { data, error } = await supabase
          .from("crm_sequence_steps" as any)
          .select("sequence_id, step_number, subject, body, crm_sequences(name)")
          .order("step_number", { ascending: true });
        if (error) throw error;
        setTemplates(
          ((data as any[]) ?? []).map((d: any) => ({
            sequence_id: d.sequence_id,
            sequence_name: (d.crm_sequences as any)?.name ?? "Unknown",
            step_number: d.step_number,
            subject: d.subject ?? "",
            body: d.body ?? "",
          }))
        );
      } catch {
        /* templates are optional */
      } finally {
        setLoadingTemplates(false);
      }
    })();
  }, []);

  const insertVariable = (
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
    setter: React.Dispatch<React.SetStateAction<string>>,
    currentValue: string,
    varName: string
  ) => {
    const el = ref.current;
    const tag = `{{${varName}}}`;
    if (!el) {
      setter(currentValue + tag);
      return;
    }
    const start = el.selectionStart ?? currentValue.length;
    const end = el.selectionEnd ?? start;
    const newValue = currentValue.slice(0, start) + tag + currentValue.slice(end);
    setter(newValue);
    const newPos = start + tag.length;
    setTimeout(() => {
      el.setSelectionRange(newPos, newPos);
      el.focus();
    }, 0);
  };

  const handleSelectExistingCampaign = (id: string) => {
    setExistingCampaignId(id);
    if (id) {
      const c = campaigns.find((c) => c.id === id);
      if (c) {
        setCampaignName(c.name);
        setSubject(c.template_subject ?? "");
        setBody(c.template_html ?? "");
      }
    }
  };

  // ---- Step 3: Test ----
  const ensureCampaignExists = async (): Promise<string> => {
    let cId = draftCampaignId ?? existingCampaignId;
    if (cId) return cId;

    const name = campaignName.trim() || "Campaign " + new Date().toISOString().slice(0, 16);
    cId = slugify(name) + "-" + Date.now().toString(36);
    const { error } = await supabase.from("email_campaigns" as any).insert({
      id: cId,
      name,
      status: "draft",
      template_subject: subject || null,
      template_html: body || null,
    } as any);
    if (error) throw error;
    setDraftCampaignId(cId);
    return cId;
  };

  const handleSendTests = async () => {
    if (senders.length === 0) {
      toast.error("No sender accounts selected");
      return;
    }
    setTestSending(true);
    try {
      const cId = await ensureCampaignExists();

      const renderedSubject = renderTemplate(subject, SAMPLE_DATA);
      const renderedBody = renderTemplate(body, SAMPLE_DATA);

      const testEntries = TEST_RECIPIENTS.map((r, i) => ({
        campaign_id: cId,
        recipient_email: r.email,
        recipient_name: r.name,
        sender_account: senders[i % senders.length],
        subject: renderedSubject,
        html_body: renderedBody,
        status: "approved",
      }));

      const { error } = await supabase
        .from("email_queue" as any)
        .insert(testEntries as any);
      if (error) throw error;

      setTestsSent(TEST_RECIPIENTS.map((r) => r.email));
      toast.success("Test emails queued — will send within 2 minutes");
      onRefresh();
    } catch (err: any) {
      toast.error("Test send failed: " + (err.message ?? ""));
    } finally {
      setTestSending(false);
    }
  };

  // ---- Step 4: Launch ----
  const handleLaunch = async () => {
    if (senders.length === 0) {
      toast.error("No sender accounts selected");
      return;
    }
    setLaunching(true);
    try {
      const cId = await ensureCampaignExists();

      // Update template in case it changed
      await supabase
        .from("email_campaigns" as any)
        .update({
          template_subject: subject || null,
          template_html: body || null,
        } as any)
        .eq("id", cId);

      // Fetch matching agents (paginated)
      const pageSize = 1000;
      let offset = 0;
      let allAgents: { id: string; name: string; email: string }[] = [];

      while (true) {
        let q = supabase
          .from("professionals")
          .select("id, name, email")
          .not("email", "is", null)
          .neq("email", "")
          .range(offset, offset + pageSize - 1);
        if (criteria.active === true) q = q.eq("active", true);
        if (criteria.active === false) q = q.eq("active", false);
        if (Array.isArray(criteria.state_slugs) && criteria.state_slugs.length > 0)
          q = q.in("state_slug", criteria.state_slugs);
        if (Array.isArray(criteria.current_tiers) && criteria.current_tiers.length > 0)
          q = q.in("current_tier", criteria.current_tiers);
        if (criteria.min_rating != null && criteria.min_rating > 0)
          q = q.gte("review_stars_rating", criteria.min_rating);
        if (criteria.email_verified) q = q.not("email_verified_at", "is", null);
        if (criteria.has_license)
          q = q.not("license_number", "is", null).neq("license_number", "");
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data ?? []) as unknown as {
          id: string;
          name: string;
          email: string;
        }[];
        allAgents = allAgents.concat(rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
      }

      if (allAgents.length === 0) {
        toast.error("No agents with emails match criteria");
        setLaunching(false);
        return;
      }

      // Convert MST datetime to UTC for scheduled_at
      let scheduledAtUTC: string | null = null;
      if (launchMode === "active" && scheduledStartMST) {
        // MST is UTC-7 (Arizona doesn't observe DST)
        const mstDate = new Date(scheduledStartMST);
        const utcDate = new Date(mstDate.getTime() + 7 * 60 * 60 * 1000);
        scheduledAtUTC = utcDate.toISOString();
      }

      // Queue entries with raw template — cron interpolates at send time
      const queueRows = allAgents.map((agent, i) => ({
        campaign_id: cId,
        agent_id: agent.id,
        recipient_email: agent.email.trim().toLowerCase(),
        recipient_name: agent.name || null,
        sender_account: senders[i % senders.length],
        subject: subject || "No subject",
        html_body: body || "",
        status: launchMode === "active" ? "approved" : "pending_review",
        ...(scheduledAtUTC ? { scheduled_at: scheduledAtUTC } : {}),
      }));

      // Insert in batches of 500
      let inserted = 0;
      for (let i = 0; i < queueRows.length; i += 500) {
        const batch = queueRows.slice(i, i + 500);
        const { error } = await supabase
          .from("email_queue" as any)
          .insert(batch as any);
        if (error) throw error;
        inserted += batch.length;
      }

      // Update campaign
      const uniqueEmails = new Set(queueRows.map((r) => r.recipient_email));
      await supabase
        .from("email_campaigns" as any)
        .update({
          total_recipients: uniqueEmails.size,
          status: launchMode,
        } as any)
        .eq("id", cId);

      setLaunchedCount(inserted);
      setLaunched(true);
      toast.success(
        `${inserted} emails queued (${uniqueEmails.size} recipients). Campaign ${launchMode === "active" ? "started" : "saved as draft"}.`
      );
      onRefresh();
    } catch (err: any) {
      toast.error("Launch failed: " + (err.message ?? ""));
    } finally {
      setLaunching(false);
    }
  };

  const canProceed = (s: number) => {
    if (s === 0) return !!(campaignName.trim() || existingCampaignId);
    if (s === 1) return (listCount ?? 0) > 0;
    if (s === 2) return !!(subject.trim() && senders.length > 0);
    return true;
  };

  const handleReset = () => {
    setStep(0);
    setCriteria({
      active: true,
      state_slugs: [],
      current_tiers: [],
      min_rating: 0,
      email_verified: false,
      has_license: false,
    });
    setCampaignName("");
    setSubject("");
    setBody("");
    setSenders([SENDER_ACCOUNTS[0]]);
    setExistingCampaignId("");
    setDraftCampaignId(null);
    setTestsSent([]);
    setLaunched(false);
    setLaunchedCount(0);
    setScheduledStartMST("");
    setMaxPerDay(35);
    setUptickPerDay(10);
    setMinSecondsBetweenSends(120);
  };

  // ---- Variable insertion buttons ----
  const VariableButtons = ({
    targetRef,
    setter,
    currentValue,
  }: {
    targetRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    setter: React.Dispatch<React.SetStateAction<string>>;
    currentValue: string;
  }) => (
    <div className="flex flex-wrap gap-1 mt-1">
      <span className="text-xs text-muted-foreground mr-1 self-center">
        Insert:
      </span>
      {BASE_TEMPLATE_VARIABLES.map((v) => (
        <button
          key={v.key}
          type="button"
          className="px-2 py-0.5 text-xs rounded-full border bg-background hover:bg-muted transition-colors cursor-pointer"
          onClick={() => insertVariable(targetRef, setter, currentValue, v.key)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1 flex-wrap">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <button
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-green-600 text-white"
                    : "bg-muted text-muted-foreground"
              }`}
              onClick={() => i < step && !launched && setStep(i)}
              disabled={i >= step || launched}
            >
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </button>
            <span
              className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}
            >
              {s}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <span className="text-muted-foreground mx-1">&rarr;</span>
            )}
          </div>
        ))}
      </div>

      {/* ============ STEP 0: CREATE OR SELECT CAMPAIGN ============ */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Create or Select Campaign</CardTitle>
            <CardDescription>Start a new campaign or continue an existing one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Continue an existing campaign</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={existingCampaignId}
                onChange={(e) => handleSelectExistingCampaign(e.target.value)}
              >
                <option value="">— New campaign —</option>
                {campaigns
                  .filter((c) => ["draft", "pending_review", "approved", "paused"].includes(c.status))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.status.replace("_", " ")})</option>
                  ))}
              </select>
            </div>

            {!existingCampaignId && (
              <div className="space-y-1">
                <Label>Campaign Name</Label>
                <Input
                  placeholder="e.g. Q1 Phoenix Outreach"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!campaignName.trim() && !existingCampaignId}>
                Next: Build List &rarr;
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ STEP 1: BUILD LIST ============ */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Build List</CardTitle>
            <CardDescription>Filter agents to target. Only agents with email addresses are included.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {savedLists.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Load a saved list</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const found = savedLists.find((l) => l.id === e.target.value);
                    if (found) {
                      setCriteria({ ...found.criteria });
                      toast.info(`Loaded list: ${found.name}`);
                    }
                  }}
                >
                  <option value="">— Select saved list (optional) —</option>
                  {savedLists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} (saved {new Date(l.savedAt).toLocaleDateString()})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Active</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={criteria.active === true ? "active" : criteria.active === false ? "inactive" : "all"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCriteria((prev) => ({ ...prev, active: v === "active" ? true : v === "inactive" ? false : ("all" as const) }));
                  }}
                >
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                  <option value="all">All</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-sm">States</Label>
                <div className="flex flex-wrap gap-1">
                  {WIZARD_STATES.map((s) => (
                    <label key={s.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={criteria.state_slugs?.includes(s.value) ?? false}
                        onCheckedChange={(c) => setCriteria((prev) => ({ ...prev, state_slugs: c ? [...(prev.state_slugs || []), s.value] : (prev.state_slugs || []).filter((x) => x !== s.value) }))}
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-sm">Tiers</Label>
                <div className="flex flex-wrap gap-1">
                  {WIZARD_TIERS.map((t) => (
                    <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={criteria.current_tiers?.includes(t.value) ?? false}
                        onCheckedChange={(c) => setCriteria((prev) => ({ ...prev, current_tiers: c ? [...(prev.current_tiers || []), t.value] : (prev.current_tiers || []).filter((x) => x !== t.value) }))}
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Min rating</Label>
                <Input type="number" min={0} max={5} step={0.1} className="w-20 h-9"
                  value={criteria.min_rating ?? ""}
                  onChange={(e) => setCriteria((prev) => ({ ...prev, min_rating: parseFloat(e.target.value) || undefined }))}
                />
              </div>

              <label className="flex items-center gap-2">
                <Checkbox checked={!!criteria.email_verified} onCheckedChange={(c) => setCriteria((prev) => ({ ...prev, email_verified: !!c }))} />
                <span className="text-sm">Email verified</span>
              </label>

              <label className="flex items-center gap-2">
                <Checkbox checked={!!criteria.has_license} onCheckedChange={(c) => setCriteria((prev) => ({ ...prev, has_license: !!c }))} />
                <span className="text-sm">Has license</span>
              </label>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {loadingCount ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : listCount ?? "—"}
                </span>
                <span className="text-muted-foreground">agents with email</span>
              </div>
              <Button variant="outline" size="sm" onClick={fetchListCount} disabled={loadingCount}>Refine</Button>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>&larr; Back</Button>
              <Button onClick={() => setStep(2)} disabled={(listCount ?? 0) === 0}>Next: Create Email &rarr;</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ STEP 2: CREATE EMAIL ============ */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Create Email</CardTitle>
            <CardDescription>
              Build your email template. Click variable buttons to insert
              placeholders at cursor position.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template loader */}
            <div className="space-y-1">
              <Label>Load from Existing Sequence</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const idx = parseInt(e.target.value);
                  if (idx >= 0 && templates[idx]) {
                    const t = templates[idx];
                    setSubject(t.subject);
                    setBody(t.body);
                    if (!campaignName.trim())
                      setCampaignName(
                        t.sequence_name + " - Step " + t.step_number
                      );
                    toast.info(
                      `Loaded: ${t.sequence_name} Step ${t.step_number}`
                    );
                  }
                }}
                disabled={loadingTemplates}
              >
                <option value="">— Select template (optional) —</option>
                {templates.map((t, i) => (
                  <option
                    key={`${t.sequence_id}-${t.step_number}`}
                    value={i}
                  >
                    {t.sequence_name} — Step {t.step_number}:{" "}
                    {t.subject.slice(0, 60)}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input
                ref={subjectRef}
                placeholder='e.g. {{firstName}}, your Top 10 listing is ready'
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <VariableButtons
                targetRef={subjectRef}
                setter={setSubject}
                currentValue={subject}
              />
            </div>

            {/* Body */}
            <div className="space-y-1">
              <Label>Body (HTML)</Label>
              <textarea
                ref={bodyRef}
                className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                placeholder={
                  "<p>Hi {{firstName}},</p>\n<p>Your listing in {{city}}, {{state}} is live...</p>"
                }
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <VariableButtons
                targetRef={bodyRef}
                setter={setBody}
                currentValue={body}
              />
            </div>

            {/* Sender accounts */}
            <div className="space-y-1">
              <Label>Sender Accounts</Label>
              <div className="flex flex-wrap gap-3">
                {SENDER_ACCOUNTS.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={senders.includes(s)}
                      onCheckedChange={(checked) =>
                        setSenders((prev) =>
                          checked
                            ? [...prev, s]
                            : prev.filter((x) => x !== s)
                        )
                      }
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Emails distributed round-robin across selected senders.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                &larr; Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!subject.trim() || senders.length === 0}>
                Next: Send Gates &rarr;
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ STEP 3: SEND GATES ============ */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Send Gates</CardTitle>
            <CardDescription>Control sending speed to protect deliverability and stay within provider limits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Max emails per mailbox per day</Label>
                <Input type="number" min={1} max={2000} value={maxPerDay}
                  onChange={(e) => setMaxPerDay(parseInt(e.target.value) || 35)} />
                <p className="text-xs text-muted-foreground">Google Workspace allows up to 2,000/day. Start low (35) and ramp up.</p>
              </div>
              <div className="space-y-1">
                <Label>Daily uptick per mailbox</Label>
                <Input type="number" min={0} max={500} value={uptickPerDay}
                  onChange={(e) => setUptickPerDay(parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground">Increase max per day by this amount each day. 0 = flat rate.</p>
              </div>
              <div className="space-y-1">
                <Label>Min seconds between sends (per mailbox)</Label>
                <Input type="number" min={10} max={3600} value={minSecondsBetweenSends}
                  onChange={(e) => setMinSecondsBetweenSends(parseInt(e.target.value) || 120)} />
                <p className="text-xs text-muted-foreground">Spacing between emails from same sender. 120s = ~30/hour max.</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
              <p><span className="font-medium">Day 1 capacity:</span> {maxPerDay * senders.length} emails ({maxPerDay}/mailbox × {senders.length} senders)</p>
              <p><span className="font-medium">Day 2 capacity:</span> {(maxPerDay + uptickPerDay) * senders.length} emails</p>
              <p><span className="font-medium">Estimated days to send {listCount ?? 0}:</span> {senders.length > 0 ? (() => {
                let remaining = listCount ?? 0;
                let dayLimit = maxPerDay * senders.length;
                let days = 0;
                while (remaining > 0) {
                  days++;
                  remaining -= dayLimit;
                  dayLimit += uptickPerDay * senders.length;
                }
                return days;
              })() : "—"} sending days</p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>&larr; Back</Button>
              <Button onClick={() => setStep(4)}>Next: Review &rarr;</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ STEP 4: REVIEW ============ */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>
              Preview your email with sample data before testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Recipients</p>
                <p className="font-semibold">{listCount ?? 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Senders</p>
                <p className="font-semibold">{senders.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Campaign</p>
                <p className="font-semibold">
                  {campaignName ||
                    campaigns.find((c) => c.id === existingCampaignId)?.name ||
                    "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Per Sender</p>
                <p className="font-semibold">
                  ~
                  {senders.length > 0
                    ? Math.ceil((listCount ?? 0) / senders.length)
                    : 0}
                </p>
              </div>
            </div>

            {/* Rendered preview */}
            <div className="border rounded p-4 space-y-2 bg-white">
              <p className="text-xs font-medium text-muted-foreground">
                Email Preview (sample data)
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">From:</span>{" "}
                <span className="font-medium">{senders[0] ?? "—"}</span>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Subject:</span>{" "}
                <span className="font-semibold">
                  {renderTemplate(subject, SAMPLE_DATA)}
                </span>
              </p>
              <hr />
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: renderTemplate(body, SAMPLE_DATA),
                }}
              />
            </div>

            {/* Raw template */}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Show raw template
              </summary>
              <pre className="mt-1 bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap">
                Subject: {subject}
                {"\n\n"}
                {body}
              </pre>
            </details>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                &larr; Back
              </Button>
              <Button onClick={() => setStep(5)}>Next: Test &rarr;</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ STEP 5: TEST ============ */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Test</CardTitle>
            <CardDescription>
              Send test emails to verify everything looks right before
              launching.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {TEST_RECIPIENTS.map((r) => (
                <div
                  key={r.email}
                  className="flex items-center gap-3 text-sm"
                >
                  {testsSent.includes(r.email) ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border" />
                  )}
                  <span className="font-medium">{r.email}</span>
                  <span className="text-muted-foreground">({r.name})</span>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSendTests}
              disabled={testSending || testsSent.length > 0}
            >
              {testSending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {testsSent.length > 0 ? "Tests Sent" : "Send Test Emails"}
            </Button>

            {testsSent.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Test emails queued with sample data. They will be delivered
                within 2 minutes by the cron sender. Check both inboxes
                before proceeding.
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)}>
                &larr; Back
              </Button>
              <Button onClick={() => setStep(6)}>
                Next: Launch &rarr;
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ STEP 6: LAUNCH ============ */}
      {step === 6 && !launched && (
        <Card>
          <CardHeader>
            <CardTitle>Launch</CardTitle>
            <CardDescription>
              Add {listCount ?? 0} agents to the campaign and choose when to
              send.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label>Launch Mode</Label>
              <div className="flex gap-6 flex-wrap">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="launchMode"
                    checked={launchMode === "draft"}
                    onChange={() => { setLaunchMode("draft"); setScheduledStartMST(""); }}
                    className="accent-primary mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium">Save as Draft</span>
                    <p className="text-xs text-muted-foreground">
                      Queue emails as &quot;pending review&quot; for manual
                      approval before sending
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="launchMode"
                    checked={launchMode === "active" && !scheduledStartMST}
                    onChange={() => { setLaunchMode("active"); setScheduledStartMST(""); }}
                    className="accent-primary mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      Start Immediately
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Approve all emails and begin sending now (within send window)
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="launchMode"
                    checked={launchMode === "active" && !!scheduledStartMST}
                    onChange={() => {
                      setLaunchMode("active");
                      // Default to tomorrow 5am MST
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const y = tomorrow.getFullYear();
                      const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
                      const d = String(tomorrow.getDate()).padStart(2, "0");
                      setScheduledStartMST(`${y}-${m}-${d}T05:00`);
                    }}
                    className="accent-primary mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      Schedule Start
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Approve all emails but delay sending until a specific time
                    </p>
                  </div>
                </label>
              </div>

              {/* Scheduled start datetime picker */}
              {launchMode === "active" && scheduledStartMST && (
                <div className="flex items-center gap-3 pl-6">
                  <Label className="text-sm whitespace-nowrap">Start at (MST):</Label>
                  <Input
                    type="datetime-local"
                    className="w-56"
                    value={scheduledStartMST}
                    onChange={(e) => setScheduledStartMST(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    Arizona time (UTC-7, no DST)
                  </span>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
              <p>
                <span className="font-medium">Campaign:</span>{" "}
                {campaignName ||
                  campaigns.find((c) => c.id === existingCampaignId)?.name}
              </p>
              <p>
                <span className="font-medium">Recipients:</span>{" "}
                {listCount ?? 0} agents with email
              </p>
              <p>
                <span className="font-medium">Senders:</span>{" "}
                {senders.join(", ")}
              </p>
              <p>
                <span className="font-medium">Mode:</span>{" "}
                {launchMode === "draft"
                  ? "Save as draft for review"
                  : scheduledStartMST
                    ? `Scheduled for ${new Date(scheduledStartMST).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} MST`
                    : "Start immediately"}
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(5)}>
                &larr; Back
              </Button>
              <Button
                onClick={handleLaunch}
                disabled={launching}
                className={
                  launchMode === "active"
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
                }
              >
                {launching && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {launchMode === "draft"
                  ? "Save Draft"
                  : scheduledStartMST
                    ? "Schedule Campaign"
                    : "Launch Campaign"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ============ LAUNCHED ============ */}
      {step === 6 && launched && (
        <Card>
          <CardContent className="pt-6 space-y-4 text-center">
            <Check className="h-12 w-12 text-green-600 mx-auto" />
            <p className="text-lg font-semibold">
              {launchMode === "draft"
                ? "Campaign Saved as Draft"
                : scheduledStartMST
                  ? "Campaign Scheduled!"
                  : "Campaign Launched!"}
            </p>
            <p className="text-muted-foreground">
              {launchedCount} emails queued across {senders.length} sender
              {senders.length !== 1 ? "s" : ""}.{" "}
              {launchMode === "draft"
                ? "Go to Campaign Monitor to review and activate."
                : scheduledStartMST
                  ? `Sending will begin at ${new Date(scheduledStartMST).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} MST.`
                  : "Sending will begin on the next cron tick."}
            </p>
            <Button onClick={handleReset}>Start New Campaign</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Existing Campaign Row (inline-editable with recipient management)
// ---------------------------------------------------------------------------

interface QueueEntry {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  sender_account: string;
  subject: string;
  status: string;
  sent_at: string | null;
}

function CampaignEditRow({
  campaign: c,
  onRefresh,
}: {
  campaign: Campaign;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editSubject, setEditSubject] = useState(c.template_subject ?? "");
  const [editBody, setEditBody] = useState(c.template_html ?? "");
  const [saving, setSaving] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addSender, setAddSender] = useState(SENDER_ACCOUNTS[0]);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const { data, error } = await supabase
        .from("email_queue" as any)
        .select(
          "id, recipient_email, recipient_name, sender_account, subject, status, sent_at"
        )
        .eq("campaign_id", c.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setQueue((data as unknown as QueueEntry[]) ?? []);
    } catch (err: any) {
      toast.error("Failed to load recipients: " + (err.message ?? ""));
    } finally {
      setLoadingQueue(false);
    }
  }, [c.id]);

  useEffect(() => {
    if (expanded && showRecipients) fetchQueue();
  }, [expanded, showRecipients, fetchQueue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_campaigns" as any)
        .update({
          template_subject: editSubject || null,
          template_html: editBody || null,
        } as any)
        .eq("id", c.id);
      if (error) throw error;
      toast.success("Campaign updated");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      const updates: any = { status: newStatus };
      if (newStatus === "approved") {
        updates.reviewed_by = "admin";
        updates.approved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("email_campaigns" as any)
        .update(updates)
        .eq("id", c.id);
      if (error) throw error;
      toast.success(`Campaign status → ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRecipient = async (queueId: string) => {
    setRemoving(queueId);
    try {
      const { error } = await supabase
        .from("email_queue" as any)
        .delete()
        .eq("id", queueId);
      if (error) throw error;
      setQueue((prev) => prev.filter((q) => q.id !== queueId));
      toast.success("Recipient removed");
      const uniqueEmails = new Set(
        queue
          .filter((q) => q.id !== queueId)
          .map((q) => q.recipient_email.toLowerCase())
      );
      await supabase
        .from("email_campaigns" as any)
        .update({ total_recipients: uniqueEmails.size } as any)
        .eq("id", c.id);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to remove");
    } finally {
      setRemoving(null);
    }
  };

  const handleAddRecipient = async () => {
    if (!addEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      const subjectLine = editSubject || c.template_subject || "No subject";
      const bodyHtml = editBody || c.template_html || "";
      const { error } = await supabase.from("email_queue" as any).insert({
        campaign_id: c.id,
        recipient_email: addEmail.trim().toLowerCase(),
        recipient_name: addName.trim() || null,
        sender_account: addSender,
        subject: subjectLine,
        html_body: bodyHtml,
        status: "approved",
      } as any);
      if (error) throw error;
      toast.success(`Added ${addEmail.trim()}`);
      setAddEmail("");
      setAddName("");
      fetchQueue();
      const allEmails = [
        ...queue.map((q) => q.recipient_email.toLowerCase()),
        addEmail.trim().toLowerCase(),
      ];
      const uniqueEmails = new Set(allEmails);
      await supabase
        .from("email_campaigns" as any)
        .update({ total_recipients: uniqueEmails.size } as any)
        .eq("id", c.id);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add recipient");
    } finally {
      setSaving(false);
    }
  };

  const handleClearUnsent = async () => {
    if (!window.confirm("Remove all unsent emails from this campaign?")) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("email_queue" as any)
        .delete()
        .eq("campaign_id", c.id)
        .in("status", ["pending_review", "approved", "scheduled"]);
      if (error) throw error;
      toast.success("Unsent emails cleared");
      fetchQueue();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to clear");
    } finally {
      setSaving(false);
    }
  };

  const canEdit = c.status !== "active" && c.status !== "complete";
  const uniqueRecipients = new Set(
    queue.map((q) => q.recipient_email.toLowerCase())
  ).size;
  const pendingCount = queue.filter((q) =>
    ["pending_review", "approved", "scheduled"].includes(q.status)
  ).length;
  const sentCount = queue.filter((q) => q.status === "sent").length;

  return (
    <div className="border rounded">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{c.name}</span>
          <StatusBadge status={c.status} />
        </div>
        <span className="text-muted-foreground text-xs">
          {new Date(c.created_at).toLocaleDateString()}{" "}
          {expanded ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t pt-3">
          {/* Template editing */}
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Body</Label>
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Recipients: {c.total_recipients}</span>
            <span>|</span>
            <span>Sent: {c.total_sent}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={saving}
              >
                {saving && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Save Changes
              </Button>
            )}
            <Button
              size="sm"
              variant={showRecipients ? "default" : "outline"}
              onClick={() => {
                setShowRecipients(!showRecipients);
                if (!showRecipients) fetchQueue();
              }}
            >
              {showRecipients ? "Hide List" : "Manage List"}
            </Button>
            {c.status === "draft" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleStatusChange("pending_review")}
                disabled={saving}
              >
                Submit for Review
              </Button>
            )}
            {c.status === "pending_review" && (
              <>
                <Button
                  size="sm"
                  onClick={() => handleStatusChange("approved")}
                  disabled={saving}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStatusChange("draft")}
                  disabled={saving}
                >
                  Reject
                </Button>
              </>
            )}
            {c.status === "approved" && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleStatusChange("active")}
                disabled={saving}
              >
                Start Campaign
              </Button>
            )}
            {c.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("paused")}
                disabled={saving}
              >
                Pause
              </Button>
            )}
            {c.status === "paused" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange("active")}
                  disabled={saving}
                >
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleStatusChange("complete")}
                  disabled={saving}
                >
                  Complete
                </Button>
              </>
            )}
          </div>

          {/* Recipient list management */}
          {showRecipients && (
            <div className="border rounded p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">
                  Email List — {uniqueRecipients} recipients, {queue.length}{" "}
                  emails ({pendingCount} pending, {sentCount} sent)
                </Label>
                {canEdit && pendingCount > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleClearUnsent}
                    disabled={saving}
                  >
                    Clear Unsent
                  </Button>
                )}
              </div>

              {/* Add recipient */}
              {canEdit && (
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="space-y-1">
                    <Label className="text-xs">Email</Label>
                    <Input
                      className="w-56 h-8 text-sm"
                      placeholder="email@example.com"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Name (optional)</Label>
                    <Input
                      className="w-40 h-8 text-sm"
                      placeholder="Jane Doe"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sender</Label>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={addSender}
                      onChange={(e) => setAddSender(e.target.value)}
                    >
                      {SENDER_ACCOUNTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleAddRecipient}
                    disabled={saving}
                  >
                    Add
                  </Button>
                </div>
              )}

              {/* Queue table */}
              {loadingQueue ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading list...
                </div>
              ) : queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No emails in queue.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr className="text-left">
                        <th className="px-2 py-1">Recipient</th>
                        <th className="px-2 py-1">Sender</th>
                        <th className="px-2 py-1">Status</th>
                        <th className="px-2 py-1 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map((q) => (
                        <tr key={q.id} className="border-t">
                          <td className="px-2 py-1">
                            <span className="font-medium">
                              {q.recipient_email}
                            </span>
                            {q.recipient_name && (
                              <span className="text-muted-foreground ml-1">
                                ({q.recipient_name})
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">
                            {q.sender_account}
                          </td>
                          <td className="px-2 py-1">
                            <StatusBadge status={q.status} />
                          </td>
                          <td className="px-2 py-1">
                            {[
                              "pending_review",
                              "approved",
                              "scheduled",
                            ].includes(q.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => handleRemoveRecipient(q.id)}
                                disabled={removing === q.id}
                              >
                                {removing === q.id ? "..." : "\u2715"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review Queue
// ---------------------------------------------------------------------------

function ReviewQueue({
  campaigns,
  loading,
  onRefresh,
}: {
  campaigns: Campaign[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const pending = campaigns.filter((c) => c.status === "pending_review");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    try {
      const updates: any =
        action === "approve"
          ? {
              status: "approved",
              reviewed_by: "admin",
              approved_at: new Date().toISOString(),
            }
          : { status: "draft" };
      const { error } = await supabase
        .from("email_campaigns" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      toast.success(
        action === "approve"
          ? "Campaign approved"
          : "Campaign rejected (back to draft)"
      );
      onRefresh();
    } catch (err: any) {
      toast.error(err.message ?? `Failed to ${action}`);
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : pending.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              No campaigns pending review.
            </p>
          </CardContent>
        </Card>
      ) : (
        pending.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">{c.name}</CardTitle>
              <CardDescription>
                Recipients: {c.total_recipients} | Subject:{" "}
                {c.template_subject ?? "(none)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs bg-muted rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {c.template_html ?? "(no body)"}
              </div>

              {previewId === c.id && (
                <div className="border rounded p-3 space-y-2">
                  <p className="text-xs font-medium">
                    Rendered Preview (sample data)
                  </p>
                  <p className="text-sm font-semibold">
                    Subject:{" "}
                    {renderTemplate(c.template_subject ?? "", SAMPLE_DATA)}
                  </p>
                  <div
                    className="text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: renderTemplate(
                        c.template_html ?? "",
                        SAMPLE_DATA
                      ),
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreviewId(previewId === c.id ? null : c.id)
                  }
                >
                  {previewId === c.id ? "Hide Preview" : "Preview Sample"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction(c.id, "approve")}
                  disabled={acting === c.id}
                >
                  {acting === c.id && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleAction(c.id, "reject")}
                  disabled={acting === c.id}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign Monitor
// ---------------------------------------------------------------------------

function CampaignMonitor({
  campaigns,
  loading,
  onRefresh,
}: {
  campaigns: Campaign[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const visible = campaigns.filter((c) => c.status !== "draft");
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(onRefresh, 30_000);
    return () => clearInterval(timer);
  }, [onRefresh]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActing(id);
    try {
      const { error } = await supabase
        .from("email_campaigns" as any)
        .update({ status: newStatus } as any)
        .eq("id", id);
      if (error) throw error;
      toast.success(`Campaign status updated to ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update status");
    } finally {
      setActing(null);
    }
  };

  const pct = (num: number, den: number) =>
    den > 0 ? ((num / den) * 100).toFixed(1) + "%" : "0%";

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              No campaigns to monitor yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        visible.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <StatusBadge status={c.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Recipients</p>
                  <p className="font-semibold">{c.total_recipients}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Sent</p>
                  <p className="font-semibold">{c.total_sent}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Opens</p>
                  <p className="font-semibold">
                    {c.total_opens}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({pct(c.total_opens, c.total_sent)})
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Clicks</p>
                  <p className="font-semibold">
                    {c.total_clicks}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({pct(c.total_clicks, c.total_sent)})
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                {c.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acting === c.id}
                    onClick={() => handleStatusChange(c.id, "paused")}
                  >
                    {acting === c.id && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    Pause
                  </Button>
                )}
                {c.status === "paused" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acting === c.id}
                    onClick={() => handleStatusChange(c.id, "active")}
                  >
                    {acting === c.id && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    Resume
                  </Button>
                )}
                {(c.status === "active" || c.status === "paused") && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={acting === c.id}
                    onClick={() => handleStatusChange(c.id, "complete")}
                  >
                    Complete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
      <p className="text-xs text-muted-foreground text-right">
        Auto-refreshes every 30s
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CampaignManager() {
  const [tab, setTab] = useState<Tab>("wizard");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_campaigns" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns((data as unknown as Campaign[]) ?? []);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "wizard", label: "Campaign Wizard" },
    { key: "review", label: "Review Queue" },
    { key: "monitor", label: "Campaign Monitor" },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {/* Active panel */}
      {tab === "wizard" && (
        <div className="space-y-6">
          <CampaignWizard
            campaigns={campaigns}
            onRefresh={fetchCampaigns}
          />

          {/* Existing campaigns below wizard */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Campaigns</CardTitle>
              <CardDescription>
                Click a campaign to edit its template or manage recipients
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No campaigns yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {campaigns.map((c) => (
                    <CampaignEditRow
                      key={c.id}
                      campaign={c}
                      onRefresh={fetchCampaigns}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {tab === "review" && (
        <ReviewQueue
          campaigns={campaigns}
          loading={loading}
          onRefresh={fetchCampaigns}
        />
      )}
      {tab === "monitor" && (
        <CampaignMonitor
          campaigns={campaigns}
          loading={loading}
          onRefresh={fetchCampaigns}
        />
      )}
    </div>
  );
}
