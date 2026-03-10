/**
 * Campaign Manager: Build email campaigns, review queued emails, and monitor send performance.
 * Part of Email Sequencer v2.
 */
import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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

type Tab = "builder" | "review" | "monitor";

const SENDER_ACCOUNTS = [
  "hello@toptenlists.us",
  "robert@toptenlists.us",
  "hello@top10lists.us",
  "robert@top10lists.us",
];

const SAMPLE_DATA: Record<string, string> = {
  firstName: "Jane",
  city: "Phoenix",
  state: "Arizona",
  company: "Sunshine Realty",
  magicLink: "https://toptenlists.us/claim/sample-agent",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-200 text-gray-800",
  pending_review: "bg-yellow-200 text-yellow-800",
  approved: "bg-blue-200 text-blue-800",
  active: "bg-green-200 text-green-800",
  paused: "bg-orange-200 text-orange-800",
  complete: "bg-purple-200 text-purple-800",
};

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
  // Strip [[BLOCK]]...[[/BLOCK]] markers for preview
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
// Campaign Builder
// ---------------------------------------------------------------------------

interface SequenceTemplate {
  sequence_id: string;
  sequence_name: string;
  step_number: number;
  subject: string;
  body: string;
}

function CampaignBuilder({
  campaigns,
  loading,
  onRefresh,
}: {
  campaigns: Campaign[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sender, setSender] = useState(SENDER_ACCOUNTS[0]);
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
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
      // silently fail — templates are optional
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSelectTemplate = (idx: number) => {
    if (idx < 0) return;
    const t = templates[idx];
    setSubject(t.subject);
    setBody(t.body);
    if (!name.trim()) setName(t.sequence_name + " - Step " + t.step_number);
    toast.info(`Loaded template: ${t.sequence_name} Step ${t.step_number}`);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Campaign name is required");
      return;
    }
    setCreating(true);
    try {
      const id = slugify(name) + "-" + Date.now().toString(36);
      const { error } = await supabase.from("email_campaigns" as any).insert({
        id,
        name: name.trim(),
        status: "draft",
        template_subject: subject || null,
        template_html: body || null,
      } as any);
      if (error) throw error;
      toast.success(`Campaign "${name}" created`);
      setName("");
      setSubject("");
      setBody("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle>New Campaign</CardTitle>
          <CardDescription>
            Define a campaign template. Use {"{{var}}"} placeholders in subject and body.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template selector */}
          <div className="space-y-1">
            <Label htmlFor="camp-template">Load from Existing Sequence</Label>
            <select
              id="camp-template"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue=""
              onChange={(e) => handleSelectTemplate(parseInt(e.target.value))}
              disabled={loadingTemplates}
            >
              <option value="">— Select a template (optional) —</option>
              {templates.map((t, i) => (
                <option key={`${t.sequence_id}-${t.step_number}`} value={i}>
                  {t.sequence_name} — Step {t.step_number}: {t.subject.slice(0, 60)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Populates subject and body from an existing sequence step. You can edit after loading.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="camp-name">Campaign Name</Label>
            <Input
              id="camp-name"
              placeholder="e.g. Q1 Phoenix Outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="camp-subject">Subject Template</Label>
            <Input
              id="camp-subject"
              placeholder="e.g. {{firstName}}, your Top 10 listing is ready"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Available: {"{{firstName}} {{city}} {{state}} {{company}} {{magicLink}}"}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="camp-body">Body Template (HTML)</Label>
            <textarea
              id="camp-body"
              className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={"<p>Hi {{firstName}},</p>\n<p>Your listing in {{city}}, {{state}} is live...</p>\n[[BLOCK]]Optional block[[/BLOCK]]"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="camp-sender">Sender Account</Label>
            <select
              id="camp-sender"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
            >
              {SENDER_ACCOUNTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Campaign
          </Button>
        </CardContent>
      </Card>

      {/* Existing campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No campaigns yet.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between border rounded px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2">
                      <StatusBadge status={c.status} />
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
          ? { status: "approved", reviewed_by: "admin", approved_at: new Date().toISOString() }
          : { status: "draft" };
      const { error } = await supabase
        .from("email_campaigns" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      toast.success(action === "approve" ? "Campaign approved" : "Campaign rejected (back to draft)");
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
            <p className="text-muted-foreground text-sm">No campaigns pending review.</p>
          </CardContent>
        </Card>
      ) : (
        pending.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">{c.name}</CardTitle>
              <CardDescription>
                Recipients: {c.total_recipients} | Subject: {c.template_subject ?? "(none)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Body preview (raw) */}
              <div className="text-xs bg-muted rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {c.template_html ?? "(no body)"}
              </div>

              {/* Rendered preview */}
              {previewId === c.id && (
                <div className="border rounded p-3 space-y-2">
                  <p className="text-xs font-medium">Rendered Preview (sample data)</p>
                  <p className="text-sm font-semibold">
                    Subject: {renderTemplate(c.template_subject ?? "", SAMPLE_DATA)}
                  </p>
                  <div
                    className="text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: renderTemplate(c.template_html ?? "", SAMPLE_DATA),
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewId(previewId === c.id ? null : c.id)}
                >
                  {previewId === c.id ? "Hide Preview" : "Preview Sample"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAction(c.id, "approve")}
                  disabled={acting === c.id}
                >
                  {acting === c.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
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

  // Auto-refresh every 30 seconds
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
            <p className="text-muted-foreground text-sm">No campaigns to monitor yet.</p>
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
              {/* Stats grid */}
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

              {/* Actions */}
              <div className="flex gap-2">
                {c.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={acting === c.id}
                    onClick={() => handleStatusChange(c.id, "paused")}
                  >
                    {acting === c.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
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
                    {acting === c.id && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
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
      <p className="text-xs text-muted-foreground text-right">Auto-refreshes every 30s</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CampaignManager() {
  const [tab, setTab] = useState<Tab>("builder");
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
    { key: "builder", label: "Campaign Builder" },
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
      {tab === "builder" && (
        <CampaignBuilder campaigns={campaigns} loading={loading} onRefresh={fetchCampaigns} />
      )}
      {tab === "review" && (
        <ReviewQueue campaigns={campaigns} loading={loading} onRefresh={fetchCampaigns} />
      )}
      {tab === "monitor" && (
        <CampaignMonitor campaigns={campaigns} loading={loading} onRefresh={fetchCampaigns} />
      )}
    </div>
  );
}
