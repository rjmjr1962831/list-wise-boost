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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ListMaker } from "./ListMaker";

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

type Tab = "list-maker" | "builder" | "review" | "monitor";

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
  const [senders, setSenders] = useState<string[]>([SENDER_ACCOUNTS[0]]);
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
    if (senders.length === 0) {
      toast.error("Select at least one sender account");
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
            <Label>Sender Accounts</Label>
            <div className="flex flex-wrap gap-3">
              {SENDER_ACCOUNTS.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={senders.includes(s)}
                    onCheckedChange={(checked) =>
                      setSenders((prev) =>
                        checked ? [...prev, s] : prev.filter((x) => x !== s)
                      )
                    }
                  />
                  <span>{s}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select one or more. Emails will be distributed across selected senders.
            </p>
          </div>

          <Button onClick={handleCreate} disabled={creating}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Campaign
          </Button>
        </CardContent>
      </Card>

      {/* Existing campaigns — click to edit */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Campaigns</CardTitle>
          <CardDescription>Click a campaign to edit its template</CardDescription>
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
                <CampaignEditRow key={c.id} campaign={c} onRefresh={onRefresh} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface QueueEntry {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  sender_account: string;
  subject: string;
  status: string;
  sent_at: string | null;
}

/** Inline-editable campaign row with recipient list management */
function CampaignEditRow({ campaign: c, onRefresh }: { campaign: Campaign; onRefresh: () => void }) {
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
        .select("id, recipient_email, recipient_name, sender_account, subject, status, sent_at")
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
      // Update recipient count
      const uniqueEmails = new Set(queue.filter((q) => q.id !== queueId).map((q) => q.recipient_email.toLowerCase()));
      await supabase.from("email_campaigns" as any).update({ total_recipients: uniqueEmails.size } as any).eq("id", c.id);
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
      // Update recipient count
      const allEmails = [...queue.map((q) => q.recipient_email.toLowerCase()), addEmail.trim().toLowerCase()];
      const uniqueEmails = new Set(allEmails);
      await supabase.from("email_campaigns" as any).update({ total_recipients: uniqueEmails.size } as any).eq("id", c.id);
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
  const uniqueRecipients = new Set(queue.map((q) => q.recipient_email.toLowerCase())).size;
  const pendingCount = queue.filter((q) => ["pending_review", "approved", "scheduled"].includes(q.status)).length;
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
          {new Date(c.created_at).toLocaleDateString()} {expanded ? "▲" : "▼"}
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
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Save Changes
              </Button>
            )}
            <Button
              size="sm"
              variant={showRecipients ? "default" : "outline"}
              onClick={() => { setShowRecipients(!showRecipients); if (!showRecipients) fetchQueue(); }}
            >
              {showRecipients ? "Hide List" : "Manage List"}
            </Button>
            {c.status === "draft" && (
              <Button size="sm" variant="secondary" onClick={() => handleStatusChange("pending_review")} disabled={saving}>
                Submit for Review
              </Button>
            )}
            {c.status === "pending_review" && (
              <>
                <Button size="sm" onClick={() => handleStatusChange("approved")} disabled={saving}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleStatusChange("draft")} disabled={saving}>
                  Reject
                </Button>
              </>
            )}
            {c.status === "approved" && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleStatusChange("active")} disabled={saving}>
                Start Campaign
              </Button>
            )}
            {c.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("paused")} disabled={saving}>
                Pause
              </Button>
            )}
            {c.status === "paused" && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleStatusChange("active")} disabled={saving}>
                  Resume
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleStatusChange("complete")} disabled={saving}>
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
                  Email List — {uniqueRecipients} recipients, {queue.length} emails ({pendingCount} pending, {sentCount} sent)
                </Label>
                {canEdit && pendingCount > 0 && (
                  <Button size="sm" variant="destructive" onClick={handleClearUnsent} disabled={saving}>
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
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <Button size="sm" className="h-8" onClick={handleAddRecipient} disabled={saving}>
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
                <p className="text-sm text-muted-foreground">No emails in queue. Add recipients above or use List Maker to build a list.</p>
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
                            <span className="font-medium">{q.recipient_email}</span>
                            {q.recipient_name && <span className="text-muted-foreground ml-1">({q.recipient_name})</span>}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">{q.sender_account}</td>
                          <td className="px-2 py-1"><StatusBadge status={q.status} /></td>
                          <td className="px-2 py-1">
                            {["pending_review", "approved", "scheduled"].includes(q.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => handleRemoveRecipient(q.id)}
                                disabled={removing === q.id}
                              >
                                {removing === q.id ? "..." : "✕"}
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
  const [tab, setTab] = useState<Tab>("list-maker");
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
    { key: "list-maker", label: "List Maker" },
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
      {tab === "list-maker" && <ListMaker />}
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
