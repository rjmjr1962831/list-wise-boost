import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Phone, Flame, Mail } from "lucide-react";

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
  professional_name?: string;
  professional_phone?: string;
  professional_email?: string;
  verification_token?: string;
  magic_link?: string;
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

  // Send email modal
  const [emailModal, setEmailModal] = useState<{ task: EngagementTask | null; open: boolean }>({ task: null, open: false });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [fromAccount, setFromAccount] = useState<string>(SAFE_ACCOUNTS[0]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => { fetchAll(); }, [filter]);

  const fetchAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchEngagementTasks(), fetchChangeTasks(), fetchTemplates()]);
    setIsLoading(false);
  };

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("crm_sequence_steps")
      .select("id, step_number, subject, body, sequence_id, crm_sequences(name)")
      .order("step_number");
    setTemplates((data ?? []).map((s: any) => ({
      id: s.id,
      subject: s.subject,
      body: s.body,
      label: `${(s.crm_sequences as any)?.name ?? "Sequence"} — Step ${s.step_number}: ${s.subject}`,
    })));
  };

  const fetchEngagementTasks = async () => {
    let query = supabase.from("crm_tasks").select("*").order("created_at", { ascending: false });
    if (filter === "pending") query = query.eq("status", "pending");
    const { data } = await query;
    if (!data?.length) { setEngagementTasks([]); return; }
    const ids = [...new Set(data.map((t: any) => t.professional_id).filter(Boolean))];
    const { data: pros } = await supabase
      .from("professionals").select("id, name, phone, email, verification_token, magic_link").in("id", ids);
    const proMap: Record<string, any> = {};
    (pros ?? []).forEach((p: any) => { proMap[p.id] = p; });
    setEngagementTasks(data.map((t: any) => ({
      ...t,
      professional_name:  proMap[t.professional_id]?.name  ?? "Unknown",
      professional_phone: proMap[t.professional_id]?.phone ?? null,
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

  const resolveEngagementTask = async (taskId: string) => {
    setProcessing(taskId);
    try {
      await supabase.from("crm_tasks").update({ status: "done", resolved_at: new Date().toISOString() }).eq("id", taskId);
      toast.success("Task marked done.");
      await fetchAll();
      onTaskResolved();
    } catch { toast.error("Failed to resolve task"); }
    finally { setProcessing(null); }
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

  async function sendEmail() {
    const task = emailModal.task;
    if (!task || !selectedTemplate) return;
    const tpl = templates.find(t => t.id === selectedTemplate);
    if (!tpl || !task.professional_email) return;
    setSending(true);
    setSendResult(null);
    const firstName = task.professional_name?.split(" ")[0] ?? task.professional_name;
    const subject = tpl.subject.replace(/\{\{firstName\}\}/g, firstName);
    const body    = tpl.body.replace(/\{\{firstName\}\}/g, firstName);
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
  const previewBody  = selectedTpl
    ? selectedTpl.body.replace(/\{\{firstName\}\}/g, emailModal.task?.professional_name?.split(" ")[0] ?? "")
    : "";

  return (
    <div className="space-y-6">

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
                    {selectedTpl.subject.replace(/\{\{firstName\}\}/g, emailModal.task.professional_name?.split(" ")[0] ?? "")}
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
                    {task.status === "done"
                      ? <Badge variant="outline" className="text-green-600 border-green-400 shrink-0"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>
                      : <Badge variant="outline" className="text-yellow-600 border-yellow-400 shrink-0"><Clock className="h-3 w-3 mr-1" />Action needed</Badge>
                    }
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                  <div className="flex flex-wrap gap-2 items-center">
                    {task.professional_phone && (
                      <a href={`tel:${task.professional_phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md font-medium hover:bg-green-700">
                        <Phone className="h-3.5 w-3.5" />{task.professional_phone}
                      </a>
                    )}
                    {task.professional_email && (
                      <button onClick={() => openEmailModal(task)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md font-medium hover:bg-indigo-700">
                        <Mail className="h-3.5 w-3.5" /> Send Email
                      </button>
                    )}
                    <Link to={`/admin/crm/agents/${task.professional_id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-sm rounded-md font-medium hover:bg-gray-900">
                      Contact
                    </Link>
                    {task.magic_link && (
                      <a href={task.magic_link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm rounded-md font-medium hover:bg-violet-700">
                        Funnel
                      </a>
                    )}
                    {task.status === "pending" && (
                      <Button size="sm" variant="outline" disabled={processing === task.id}
                        onClick={() => resolveEngagementTask(task.id)}
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
    </div>
  );
};
