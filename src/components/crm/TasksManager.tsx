import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ContactDetail } from "./ContactDetail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Flame, Mail, Phone, Search, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ChangeRequest {
  id: string;
  professional_id: string;
  field_name: string;
  current_value: string | null;
  proposed_value: string | null;
  change_request: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  professional_name?: string;
}

interface EngagementTask {
  id: string;
  professional_id: string;
  task_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  resolved_at: string | null;
  due_at?: string | null;
  notes?: string | null;
  professional_name?: string;
  professional_phone?: string;
  professional_email?: string;
  verification_token?: string;
  magic_link?: string;
}

interface Template { id: string; subject: string; body: string; label: string; }

interface ExaResearchState {
  status: "idle" | "loading" | "done" | "error";
  results?: { url: string; title?: string; text?: string; highlights?: string[] }[];
  suggestedEmails?: string[];
  query?: string;
  error?: string;
}

interface TasksManagerProps {
  onTaskResolved: () => void;
}

const SAFE_ACCOUNTS = ["robert@toptenlists.us", "hello@toptenlists.us"];

export const TasksManager = ({ onTaskResolved }: TasksManagerProps) => {
  const [tasks, setTasks] = useState<ChangeRequest[]>([]);
  const [engagementTasks, setEngagementTasks] = useState<EngagementTask[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string; email: string; phone: string | null; company: string | null; business_city: string | null; state_slug: string | null; current_tier: string | null; review_stars_rating: number | null; num_total_reviews: number | null; canonical_slug: string | null } | null>(null);

  // Send email modal
  const [emailModal, setEmailModal] = useState<{ task: EngagementTask | null; open: boolean }>({ task: null, open: false });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [fromAccount, setFromAccount] = useState<string>(SAFE_ACCOUNTS[0]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Exa research for bounced-email tasks: taskId -> { status, results?, suggestedEmails?, error? }
  const [exaResearch, setExaResearch] = useState<Record<string, ExaResearchState>>({});
  const [exaExpanded, setExaExpanded] = useState<Record<string, boolean>>({});

  // Mark Done + notes + N-day follow-up modal
  const [markDoneTask, setMarkDoneTask] = useState<EngagementTask | null>(null);
  const [markDoneNotes, setMarkDoneNotes] = useState<string>("");
  const [followUpDays, setFollowUpDays] = useState<string>("");

  useEffect(() => { fetchAll(); }, [filter]);

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchEngagementTasks(), fetchChangeTasks(), fetchTemplates()]);
    setIsLoading(false);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("crm_email_templates")
      .select("id, name, subject, body")
      .order("name");
    setTemplates((data ?? []).map((t: any) => ({
      id: t.id,
      subject: t.subject ?? "",
      body: t.body ?? "",
      label: t.name ?? t.subject ?? "Template",
    })));
  };

  const fetchEngagementTasks = async () => {
    let query = supabase.from("crm_tasks").select("*").order("created_at", { ascending: false });
    if (filter === "pending") query = query.eq("status", "pending");
    const { data } = await query;
    if (!data?.length) { setEngagementTasks([]); return; }
    // Pending: only show tasks that are due (no due_at, or due_at <= now)
    const now = new Date();
    const eligible = filter === "pending"
      ? (data as any[]).filter((t: any) => !t.due_at || new Date(t.due_at) <= now)
      : (data as any[]);
    if (!eligible.length) { setEngagementTasks([]); return; }
    const ids = [...new Set(eligible.map((t: any) => t.professional_id).filter(Boolean))];
    const { data: pros } = await supabase
      .from("professionals").select("id, name, phone, cell_phone, email, verification_token, magic_link").in("id", ids);
    const proMap: Record<string, any> = {};
    (pros ?? []).forEach((p: any) => { proMap[p.id] = p; });
    // Prefer mobile (cell_phone) or business (phone); do not use Zillow number
    const pickDisplayPhone = (p: any) => (p?.cell_phone && p.cell_phone.trim() !== "") ? p.cell_phone : (p?.phone && p.phone.trim() !== "" ? p.phone : null);
    setEngagementTasks(eligible.map((t: any) => ({
      ...t,
      professional_name:  proMap[t.professional_id]?.name  ?? "Unknown",
      professional_phone: pickDisplayPhone(proMap[t.professional_id]) ?? null,
      professional_email: proMap[t.professional_id]?.email ?? null,
      verification_token: proMap[t.professional_id]?.verification_token ?? null,
      magic_link:         proMap[t.professional_id]?.magic_link ?? null,
    })));
  };

  const fetchChangeTasks = async () => {
    let query = supabase.from("field_change_requests").select("*").order("created_at", { ascending: false });
    if (filter === "pending") query = query.eq("status", "pending");
    const { data, error } = await query;
    if (error) { toast.error("Failed to load field tasks"); return; }
    const enriched = await Promise.all((data || []).map(async (task) => {
      const { data: pro } = await supabase.from("professionals").select("name").eq("id", task.professional_id).single();
      return { ...task, professional_name: pro?.name || "Unknown" };
    }));
    setTasks(enriched);
  };

  function openMarkDoneModal(task: EngagementTask) {
    setMarkDoneTask(task);
    setMarkDoneNotes("");
    setFollowUpDays("");
  }

  function closeMarkDoneModal() {
    setMarkDoneTask(null);
    setMarkDoneNotes("");
    setFollowUpDays("");
  }

  const confirmMarkDone = async () => {
    const task = markDoneTask;
    if (!task) return;
    setProcessing(task.id);
    try {
      const notesTrimmed = markDoneNotes.trim();
      // 1. Complete current task and save notes
      const { error: updateErr } = await supabase
        .from("crm_tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          ...(notesTrimmed ? { notes: notesTrimmed } : {}),
        })
        .eq("id", task.id);
      if (updateErr) {
        toast.error("Failed to mark done: " + (updateErr.message ?? "unknown"));
        return;
      }
      const n = parseInt(followUpDays.trim(), 10);
      if (n > 0) {
        const dueAt = new Date();
        dueAt.setDate(dueAt.getDate() + n);
        dueAt.setHours(9, 0, 0, 0);
        await supabase.from("crm_tasks").delete().eq("professional_id", task.professional_id).eq("task_type", "follow_up");
        const followUpDesc = notesTrimmed
          ? `Notes: ${notesTrimmed}\n\nDue in ${n} day(s). Original: ${task.title}`
          : `Due in ${n} day(s). Original: ${task.title}`;
        const { error: insertErr } = await supabase.from("crm_tasks").insert({
          professional_id: task.professional_id,
          task_type: "follow_up",
          title: `Follow up: ${task.professional_name ?? "Contact"}`,
          description: followUpDesc,
          status: "pending",
          priority: task.priority || "normal",
          due_at: dueAt.toISOString(),
          ...(notesTrimmed ? { notes: notesTrimmed } : {}),
        });
        if (insertErr) {
          toast.error("Follow-up create failed: " + (insertErr.message ?? "unknown"));
        } else {
          toast.success(`Task done. Follow-up in ${n} day(s).`);
        }
      } else {
        toast.success("Task marked done.");
      }
      closeMarkDoneModal();
      await fetchAll();
      onTaskResolved();
    } catch (e: any) {
      toast.error("Failed: " + (e?.message ?? "unknown"));
    } finally {
      setProcessing(null);
    }
  };

  const handleAccept = async (task: ChangeRequest) => {
    setProcessing(task.id);
    try {
      const fieldMap: Record<string, string> = {
        "Name": "name", "License Number": "license_number",
        "Reviews": "num_total_reviews", "Years of Experience": "years_experience", "Total Sales": "total_sales",
      };
      const dbField = fieldMap[task.field_name];
      if (dbField && task.proposed_value) {
        await supabase.from("professionals").update({ [dbField]: task.proposed_value }).eq("id", task.professional_id);
      }
      await supabase.from("field_change_requests").update({ status: "accepted", reviewed_at: new Date().toISOString() }).eq("id", task.id);
      toast.success("Change accepted and applied.");
      await fetchAll();
      onTaskResolved();
    } catch { toast.error("Failed to accept change"); }
    finally { setProcessing(null); }
  };

  const handleReject = async (task: ChangeRequest) => {
    setProcessing(task.id);
    try {
      await supabase.from("field_change_requests").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", task.id);
      toast.success("Change rejected.");
      await fetchAll();
      onTaskResolved();
    } catch { toast.error("Failed to reject change"); }
    finally { setProcessing(null); }
  };

  function openEmailModal(task: EngagementTask) {
    setEmailModal({ task, open: true });
    setSelectedTemplate("");
    setFromAccount(SAFE_ACCOUNTS[0]);
    setSendResult(null);
  }

  function closeEmailModal() {
    setEmailModal({ task: null, open: false });
    setSendResult(null);
    setSending(false);
  }

  async function runExaResearch(task: EngagementTask) {
    setExaResearch((prev) => ({ ...prev, [task.id]: { status: "loading" } }));
    try {
      const { data, error } = await supabase.functions.invoke("exa-bounce-research", {
        body: { professional_id: task.professional_id },
      });
      if (error) throw error;
      if (data?.error) {
        setExaResearch((prev) => ({
          ...prev,
          [task.id]: { status: "error", error: data.error },
        }));
        toast.error(data.error);
        return;
      }
      setExaResearch((prev) => ({
        ...prev,
        [task.id]: {
          status: "done",
          results: data?.results ?? [],
          suggestedEmails: data?.suggestedEmails ?? [],
          query: data?.query,
        },
      }));
      setExaExpanded((prev) => ({ ...prev, [task.id]: true }));
      toast.success("Exa research loaded.");
    } catch (e: any) {
      const msg = e?.message ?? "Research failed";
      setExaResearch((prev) => ({ ...prev, [task.id]: { status: "error", error: msg } }));
      toast.error(msg);
    }
  }

  async function sendEmail() {
    const task = emailModal.task;
    if (!task || !selectedTemplate) return;
    const tpl = templates.find(t => t.id === selectedTemplate);
    if (!tpl || !task.professional_email) return;
    setSending(true);
    setSendResult(null);
    const firstName = task.professional_name?.split(" ")[0] ?? task.professional_name;
    const sub = (s: string) => s.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{first_name\}\}/g, firstName);
    const subject = sub(tpl.subject);
    const body    = sub(tpl.body);
    try {
      const { error } = await supabase.functions.invoke("gmail-send", {
        body: { to: task.professional_email, subject, body, from_account: fromAccount },
      });
      if (error) throw error;
      setSendResult({ ok: true, msg: `Sent to ${task.professional_email}` });
    } catch (e: any) {
      setSendResult({ ok: false, msg: e.message ?? "Send failed" });
    }
    setSending(false);
  }

  const statusBadge = (status: string) => {
    if (status === "pending")  return <Badge variant="outline" className="text-yellow-600 border-yellow-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    if (status === "accepted") return <Badge variant="outline" className="text-green-600 border-green-400"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
    return <Badge variant="outline" className="text-red-600 border-red-400"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  };

  const totalPending = engagementTasks.filter(t => t.status === "pending").length + tasks.filter(t => t.status === "pending").length;
  const selectedTpl  = templates.find(t => t.id === selectedTemplate);
  const firstForPreview = emailModal.task?.professional_name?.split(" ")[0] ?? "";
  const previewBody  = selectedTpl
    ? selectedTpl.body.replace(/\{\{firstName\}\}/g, firstForPreview).replace(/\{\{first_name\}\}/g, firstForPreview)
    : "";

  return (
    <div className="space-y-6">

      {/* Contact Detail view */}
      {selectedContact && (
        <ContactDetail professional={selectedContact} onBack={() => setSelectedContact(null)} />
      )}

      {/* Everything else hidden when contact is open */}
      {!selectedContact && (<>

      {/* Send Email Modal */}
      {emailModal.open && emailModal.task && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "600px", maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>Send Email</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#666" }}>
                  To: {emailModal.task.professional_name} &lt;{emailModal.task.professional_email}&gt;
                </p>
              </div>
              <button onClick={closeEmailModal} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#999", lineHeight: 1 }}>x</button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>From</label>
              <select value={fromAccount} onChange={e => setFromAccount(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", background: "#fff" }}>
                {SAFE_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Template</label>
              <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", background: "#fff" }}>
                <option value="">-- Choose a template --</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            {selectedTpl && (
              <>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subject</label>
                  <div style={{ padding: "8px 12px", background: "#f5f5f5", borderRadius: "6px", fontSize: "13px" }}>
                    {selectedTpl.subject.replace(/\{\{firstName\}\}/g, firstForPreview).replace(/\{\{first_name\}\}/g, firstForPreview)}
                  </div>
                </div>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Preview</label>
                  <pre style={{ padding: "12px", background: "#f5f5f5", borderRadius: "6px", fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: "220px", overflowY: "auto", fontFamily: "system-ui" }}>
                    {previewBody}
                  </pre>
                </div>
              </>
            )}

            {sendResult && (
              <div style={{ padding: "10px 14px", borderRadius: "6px", marginBottom: "16px", background: sendResult.ok ? "#f0fdf4" : "#fef2f2", color: sendResult.ok ? "#15803d" : "#dc2626", fontSize: "13px", fontWeight: "500" }}>
                {sendResult.ok ? "Sent" : "Error"}: {sendResult.msg}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={closeEmailModal} style={{ padding: "7px 16px", background: "#888", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
              <button onClick={sendEmail} disabled={!selectedTemplate || sending || !!sendResult?.ok}
                style={{ padding: "7px 16px", background: !selectedTemplate || sending || !!sendResult?.ok ? "#ccc" : "#1a1a1a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                {sending ? "Sending..." : sendResult?.ok ? "Sent" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Done: notes → follow-up → schedule */}
      {markDoneTask && (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center" onClick={closeMarkDoneModal}>
          <div className="bg-background rounded-xl shadow-xl p-6 w-[420px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Task completed</h3>
            <p className="text-sm text-muted-foreground mb-4">{markDoneTask.professional_name} — {markDoneTask.title}</p>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Notes</label>
            <Textarea
              placeholder="Enter notes (shown when follow-up appears)"
              value={markDoneNotes}
              onChange={e => setMarkDoneNotes(e.target.value)}
              className="mb-4 min-h-[80px] resize-y"
            />
            <label className="block text-sm font-medium text-muted-foreground mb-2">Follow up in (days)</label>
            <Input
              type="number"
              min={0}
              placeholder="0 = no follow-up"
              value={followUpDays}
              onChange={e => setFollowUpDays(e.target.value)}
              className="mb-4"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeMarkDoneModal}>Cancel</Button>
              <Button onClick={confirmMarkDone} disabled={processing === markDoneTask.id}>
                {processing === markDoneTask.id ? "Saving…" : "Schedule"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-3">
        <button onClick={() => setFilter("pending")}
          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${filter === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          Pending {filter === "pending" && totalPending > 0 ? `(${totalPending})` : ""}
        </button>
        <button onClick={() => setFilter("all")}
          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          All
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!isLoading && engagementTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Flame className="h-4 w-4 text-red-500" /> Agent Engagement
          </h2>
          {engagementTasks.map(task => {
            const isClick = task.task_type === "email_clicked";
            return (
              <Card key={task.id} className={isClick ? "border-red-200 bg-red-50/30" : "border-yellow-200 bg-yellow-50/20"}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${isClick ? "bg-red-500 text-white" : "bg-amber-400 text-white"}`}>
                          {isClick ? "HOT" : "WARM"}
                        </span>
                        <CardTitle className="text-base">{task.title}</CardTitle>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(task.created_at), "MMM d, yyyy h:mm a")}
                      </p>
                    </div>
                    {(task.status === "done" || task.status === "completed")
                      ? <Badge variant="outline" className="text-green-600 border-green-400 shrink-0"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>
                      : <Badge variant="outline" className="text-yellow-600 border-yellow-400 shrink-0"><Clock className="h-3 w-3 mr-1" />Action needed</Badge>
                    }
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.notes && (
                    <div className="rounded-md bg-muted/50 border border-muted px-3 py-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{task.notes}</p>
                    </div>
                  )}
                  {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                  {task.professional_phone && (
                    <p className="text-sm flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={`tel:${task.professional_phone.replace(/\s/g, "")}`} className="text-primary hover:underline font-medium">
                        {task.professional_phone}
                      </a>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    {task.task_type === "email_bounced" && (
                      <Button size="sm" variant="outline"
                        disabled={exaResearch[task.id]?.status === "loading"}
                        onClick={() => runExaResearch(task)}
                        className="border-violet-300 text-violet-700 hover:bg-violet-50">
                        {exaResearch[task.id]?.status === "loading" ? (
                          <span className="animate-pulse">Loading…</span>
                        ) : (
                          <><Search className="h-3.5 w-3.5 mr-1" /> Research</>
                        )}
                      </Button>
                    )}
                    {task.professional_email && (
                      <button onClick={() => openEmailModal(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md font-medium hover:bg-indigo-700">
                        <Mail className="h-3.5 w-3.5" /> Send Email
                      </button>
                    )}
                    <button onClick={() => setSelectedContact({
                        id: task.professional_id,
                        name: task.professional_name ?? "",
                        email: task.professional_email ?? "",
                        phone: task.professional_phone ?? null,
                        company: null, business_city: null, state_slug: null,
                        current_tier: null, review_stars_rating: null,
                        num_total_reviews: null, canonical_slug: null,
                      })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md font-medium hover:bg-gray-900">
                      Contact
                    </button>
                    {task.status !== "done" && task.status !== "completed" && (
                      <Button size="sm" variant="outline" disabled={processing === task.id}
                        onClick={() => openMarkDoneModal(task)}
                        className="ml-auto border-green-300 text-green-700 hover:bg-green-50">
                        <CheckCircle className="h-4 w-4 mr-1" /> Mark Done
                      </Button>
                    )}
                  </div>
                  {exaResearch[task.id] && (
                    <Collapsible
                      open={exaExpanded[task.id] ?? exaResearch[task.id].status === "loading"}
                      onOpenChange={(open) => setExaExpanded((prev) => ({ ...prev, [task.id]: open }))}
                      className="mt-3 border rounded-md border-muted bg-muted/30"
                    >
                      <CollapsibleTrigger asChild>
                        <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
                          {exaResearch[task.id].status === "loading" ? (
                            <span className="animate-pulse">Exa research…</span>
                          ) : (
                            <>
                              {exaResearch[task.id].status === "done" ? (
                                <ChevronDown className="h-4 w-4 shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0" />
                              )}
                              Exa results
                              {exaResearch[task.id].status === "done" && exaResearch[task.id].results?.length != null && (
                                <span className="text-xs">({exaResearch[task.id].results!.length} links)</span>
                              )}
                            </>
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-0 space-y-3 text-sm">
                          {exaResearch[task.id].status === "loading" && (
                            <p className="text-muted-foreground">Loading Exa results…</p>
                          )}
                          {exaResearch[task.id].status === "error" && (
                            <p className="text-red-600">{exaResearch[task.id].error}</p>
                          )}
                          {exaResearch[task.id].status === "done" && (
                            <>
                              {exaResearch[task.id].suggestedEmails && exaResearch[task.id].suggestedEmails!.length > 0 && (
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Suggested emails</p>
                                  <ul className="list-disc list-inside space-y-0.5">
                                    {exaResearch[task.id].suggestedEmails!.map((e, i) => (
                                      <li key={i}><a href={`mailto:${e}`} className="text-primary hover:underline">{e}</a></li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">Sources</p>
                                <ul className="space-y-2">
                                  {(exaResearch[task.id].results ?? []).map((r, i) => {
                                    let host = "";
                                    try { host = r.url ? new URL(r.url).hostname : ""; } catch { host = r.url || ""; }
                                    return (
                                      <li key={i} className="border-l-2 border-muted pl-2">
                                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                          {r.title || host || "Link"}
                                          <ExternalLink className="h-3 w-3" />
                                        </a>
                                        {r.text && <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{r.text}</p>}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!isLoading && tasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Field Change Requests</h2>
          {tasks.map(task => (
            <Card key={task.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">{task.professional_name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(task.created_at), "MMM d, yyyy h:mm a")}</p>
                  </div>
                  {statusBadge(task.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-muted/40 rounded p-3"><p className="text-xs text-muted-foreground mb-1">Field</p><p className="font-medium">{task.field_name}</p></div>
                  <div className="bg-muted/40 rounded p-3"><p className="text-xs text-muted-foreground mb-1">Current</p><p className="font-mono text-xs break-all">{task.current_value || "n/a"}</p></div>
                  <div className="bg-blue-50 rounded p-3"><p className="text-xs text-muted-foreground mb-1">Proposed</p><p className="font-mono text-xs break-all">{task.proposed_value || "n/a"}</p></div>
                </div>
                {task.change_request && (
                  <div className="bg-muted/30 rounded p-3 text-sm"><p className="text-xs text-muted-foreground mb-1">Agent note</p><p>{task.change_request}</p></div>
                )}
                {task.status === "pending" && (
                  <div className="space-y-2 pt-1">
                    <Textarea placeholder="Reason for rejection (optional)" className="text-sm min-h-[60px]"
                      value={rejectReasons[task.id] || ""}
                      onChange={e => setRejectReasons(prev => ({ ...prev, [task.id]: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAccept(task)} disabled={processing === task.id} className="bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="h-4 w-4 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleReject(task)} disabled={processing === task.id} className="border-red-300 text-red-600 hover:bg-red-50">
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && engagementTasks.length === 0 && tasks.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No {filter === "pending" ? "pending " : ""}tasks.</CardContent></Card>
      )}
      </>)}
    </div>
  );
};

