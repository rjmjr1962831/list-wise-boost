import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { ContactDetail } from "./ContactDetail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Flame, Mail, Phone, Search } from "lucide-react";

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
  professional_raw_scraper_data?: { website_contact?: { email?: string | null } } | null;
}

interface Template { id: string; subject: string; body: string; label: string; }

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

  // Send email modal: compose from scratch or use template
  const [emailModal, setEmailModal] = useState<{ task: EngagementTask | null; open: boolean }>({ task: null, open: false });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [composeSubject, setComposeSubject] = useState<string>("");
  const [composeBody, setComposeBody] = useState<string>("");
  const [fromAccount, setFromAccount] = useState<string>(SAFE_ACCOUNTS[0]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [researchOpenTaskId, setResearchOpenTaskId] = useState<string | null>(null);
  const [researchEmails, setResearchEmails] = useState<Record<string, string[]>>({});
  const [researchLoading, setResearchLoading] = useState<string | null>(null);

  // Mark Done + notes + N-day follow-up modal
  const [markDoneTask, setMarkDoneTask] = useState<EngagementTask | null>(null);
  const [markDoneNotes, setMarkDoneNotes] = useState<string>("");
  const [followUpDays, setFollowUpDays] = useState<string>("");

  useEffect(() => { fetchAll(); }, [filter]);

  const replaceEmailFromBlob = async (task: EngagementTask, newEmail: string) => {
    setProcessing(task.id);
    try {
      const { error } = await supabase
        .from("professionals")
        .update({ email: newEmail })
        .eq("id", task.professional_id);
      if (error) throw error;
      toast.success(`Email updated to ${newEmail}`);
      setResearchOpenTaskId(null);
      await fetchAll();
      onTaskResolved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update email");
    } finally {
      setProcessing(null);
    }
  };

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
      .from("professionals").select("id, name, phone, cell_phone, email, verification_token, magic_link, raw_scraper_data").in("id", ids);
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
      professional_raw_scraper_data: proMap[t.professional_id]?.raw_scraper_data ?? null,
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
    setComposeSubject("");
    setComposeBody("");
    setFromAccount(SAFE_ACCOUNTS[0]);
    setSendResult(null);
  }

  function applyTaskTemplate(templateId: string) {
    setSelectedTemplate(templateId);
    if (!templateId) {
      setComposeSubject("");
      setComposeBody("");
      return;
    }
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl || !emailModal.task) return;
    const firstName = emailModal.task.professional_name?.split(" ")[0] ?? "";
    const fullName = emailModal.task.professional_name ?? "";
    const profileUrl = emailModal.task.magic_link ?? (emailModal.task.verification_token ? `https://www.top10lists.us/dashboard/${emailModal.task.verification_token}` : "https://www.top10lists.us");
    const sub = (s: string) => s
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{first_name\}\}/g, firstName)
      .replace(/\{\{agent_name\}\}/g, fullName)
      .replace(/\{\{profile_url\}\}/g, profileUrl);
    setComposeSubject(sub(tpl.subject));
    setComposeBody(sub(tpl.body));
  }

  function closeEmailModal() {
    setEmailModal({ task: null, open: false });
    setSendResult(null);
    setSending(false);
  }

  async function sendEmail() {
    const task = emailModal.task;
    if (!task || !task.professional_email) return;
    const subject = (composeSubject || "").trim();
    const body = (composeBody || "").trim();
    if (!subject || !body) return;
    setSending(true);
    setSendResult(null);
    try {
      const { error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: task.professional_email,
          subject,
          message_body: body,
          from_account: fromAccount,
          professional_id: task.professional_id,
        },
      });
      if (error) throw error;
      setSendResult({ ok: true, msg: `Sent to ${task.professional_email}` });
      setComposeSubject("");
      setComposeBody("");
      setSelectedTemplate("");
    } catch (e: any) {
      setSendResult({ ok: false, msg: e?.message ?? "Send failed" });
    }
    setSending(false);
  }

  const statusBadge = (status: string) => {
    if (status === "pending")  return <Badge variant="outline" className="text-yellow-600 border-yellow-400"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    if (status === "accepted") return <Badge variant="outline" className="text-green-600 border-green-400"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
    return <Badge variant="outline" className="text-red-600 border-red-400"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
  };

  const totalPending = engagementTasks.filter(t => t.status === "pending").length + tasks.filter(t => t.status === "pending").length;

  return (
    <div className="space-y-6">

      {/* Contact Detail view */}
      {selectedContact && (
        <ContactDetail professional={selectedContact} onBack={() => setSelectedContact(null)} />
      )}

      {/* Everything else hidden when contact is open */}
      {!selectedContact && (<>

      {/* Send Email Modal: New Email with optional template and placeholders */}
      {emailModal.open && emailModal.task && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "600px", maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>New Email</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#666" }}>
                  To: {emailModal.task.professional_name} &lt;{emailModal.task.professional_email}&gt;
                </p>
              </div>
              <button onClick={closeEmailModal} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#999", lineHeight: 1 }}>Cancel</button>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px" }}>Use template</label>
              <select value={selectedTemplate} onChange={e => applyTaskTemplate(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", background: "#fff" }}>
                <option value="">Select a template...</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px" }}>From</label>
              <select value={fromAccount} onChange={e => setFromAccount(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", background: "#fff" }}>
                {SAFE_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px" }}>To</label>
              <div style={{ padding: "8px 12px", background: "#f5f5f5", borderRadius: "6px", fontSize: "13px" }}>{emailModal.task.professional_email}</div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px" }}>Subject</label>
              <Input className="text-sm h-9" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#555" }}>Insert:</span>
                {[
                  { key: "{{first_name}}", label: "First Name" },
                  { key: "{{agent_name}}", label: "Full Name" },
                  { key: "{{profile_url}}", label: "Profile URL" },
                ].map(v => (
                  <button key={v.key} type="button" onClick={() => setComposeBody(b => b + v.key)}
                    className="text-[10px] px-2 py-1 rounded border border-input hover:bg-muted transition-colors">
                    {v.label}
                  </button>
                ))}
              </div>
              <Textarea className="min-h-[140px] text-sm font-mono resize-y" value={composeBody} onChange={e => setComposeBody(e.target.value)} placeholder="Write your message..." />
            </div>

            {sendResult && (
              <div style={{ padding: "10px 14px", borderRadius: "6px", marginBottom: "16px", background: sendResult.ok ? "#f0fdf4" : "#fef2f2", color: sendResult.ok ? "#15803d" : "#dc2626", fontSize: "13px", fontWeight: "500" }}>
                {sendResult.ok ? "Sent" : "Error"}: {sendResult.msg}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={closeEmailModal}>Cancel</Button>
              <Button onClick={sendEmail} disabled={!composeSubject.trim() || !composeBody.trim() || sending || !!sendResult?.ok}>
                <Mail className="h-3.5 w-3.5 mr-1" />{sending ? "Sending..." : sendResult?.ok ? "Sent" : "Send"}
              </Button>
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
                      <Popover
                        open={researchOpenTaskId === task.id}
                        onOpenChange={async (open) => {
                          setResearchOpenTaskId(open ? task.id : null);
                          if (open && task.professional_id) {
                            setResearchLoading(task.id);
                            setResearchEmails((prev) => ({ ...prev, [task.id]: [] }));
                            try {
                              const { data, error } = await supabase.functions.invoke("exa-bounce-research", {
                                body: { professional_id: task.professional_id },
                              });
                              if (error) throw error;
                              const list = (data?.suggestedEmails ?? []).filter((e: string) => typeof e === "string" && e.trim());
                              setResearchEmails((prev) => ({ ...prev, [task.id]: list }));
                            } catch (_) {
                              setResearchEmails((prev) => ({ ...prev, [task.id]: [] }));
                            } finally {
                              setResearchLoading(null);
                            }
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" disabled={processing === task.id} className="gap-1.5">
                            <Search className="h-3.5 w-3.5" /> Research
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Alternate emails (from agent&apos;s blob)</p>
                            {researchLoading === task.id ? (
                              <p className="text-xs text-muted-foreground">Loading…</p>
                            ) : (researchEmails[task.id]?.length ?? 0) > 0 ? (
                              <div className="space-y-1">
                                {researchEmails[task.id].map((e) => (
                                  <button
                                    key={e}
                                    onClick={() => replaceEmailFromBlob(task, e)}
                                    className="block w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted truncate"
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No alternate emails found in agent&apos;s blob.</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    {task.professional_email && (
                      <Button size="sm" variant="default" onClick={() => openEmailModal(task)}
                        className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </Button>
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

