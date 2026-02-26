import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Phone, Star, ArrowLeft, Plus, Check, Clock, CreditCard, Send,
  Activity, ListTodo, X, AlertCircle, ExternalLink, Copy, Link, Edit2,
  Save, StickyNote, User, Shield, BarChart3, Power, Eye
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Professional {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  business_city: string | null;
  state_slug: string | null;
  current_tier: string | null;
  review_stars_rating: number | null;
  num_total_reviews: number | null;
  canonical_slug: string | null;
}

interface Props {
  professional: Professional;
  onBack: () => void;
}

export const ContactDetail = ({ professional, onBack }: Props) => {
  const [pro, setPro] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "emails" | "activity" | "tasks" | "payments">("overview");
  const [emails, setEmails] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeFrom, setComposeFrom] = useState("hello@toptenlists.us");
  const [sending, setSending] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<{ id: string; subject: string; body: string; label: string }[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  useEffect(() => { loadAll(); }, [professional.id]);

  const loadAll = async () => {
    setIsLoading(true);
    await Promise.all([
      loadFullPro(), loadEmails(), loadActivities(), loadTasks(),
      loadChangeRequests(), loadPayments(), loadSubscriptions(), loadNotes(),
      loadEnrollment(), loadAccounts(), loadTemplates(),
    ]);
    setIsLoading(false);
  };

  const loadTemplates = async () => {
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

  const loadFullPro = async () => {
    const { data } = await supabase.from("professionals").select("*").eq("id", professional.id).single();
    setPro(data);
  };

  const loadEmails = async () => {
    const email = professional.email;
    if (!email || email === "pending@123.com") { setEmails([]); return; }
    const { data } = await supabase.from("crm_emails").select("*")
      .or(`to_address.ilike.%${email}%,from_address.ilike.%${email}%`)
      .order("sent_at", { ascending: false }).limit(100);
    setEmails(data || []);
  };

  const loadActivities = async () => {
    const { data } = await supabase.from("funnel_events").select("*")
      .eq("professional_id", professional.id).order("created_at", { ascending: false }).limit(50);
    setActivities(data || []);
  };

  const loadTasks = async () => {
    const { data } = await supabase.from("crm_tasks" as any).select("*")
      .eq("professional_id", professional.id).order("created_at", { ascending: false }).limit(50);
    setTasks(data || []);
  };

  const loadChangeRequests = async () => {
    const { data } = await supabase.from("field_change_requests").select("*")
      .eq("professional_id", professional.id).order("created_at", { ascending: false }).limit(50);
    setChangeRequests(data || []);
  };

  const loadPayments = async () => {
    const { data } = await supabase.from("crm_payment_log" as any).select("*")
      .eq("professional_id", professional.id).order("created_at", { ascending: false }).limit(50);
    setPayments(data || []);
  };

  const loadSubscriptions = async () => {
    const { data } = await supabase.from("agent_neighborhood_subscriptions").select("*")
      .eq("professional_id", professional.id).order("created_at", { ascending: false }).limit(50);
    setSubscriptions(data || []);
  };

  const loadNotes = async () => {
    const { data } = await supabase.from("crm_notes" as any).select("*")
      .eq("professional_id", professional.id).order("created_at", { ascending: false }).limit(100);
    setNotes(data || []);
  };

  const loadEnrollment = async () => {
    const { data } = await supabase.from("crm_sequence_enrollments").select("*, crm_sequences(name)")
      .eq("professional_id", professional.id).order("enrolled_at", { ascending: false }).limit(1).maybeSingle();
    setEnrollment(data);
  };

  const SAFE_ACCOUNTS = ["robert@toptenlists.us", "hello@toptenlists.us"];
  const loadAccounts = async () => {
    const { data } = await supabase.from("crm_email_accounts").select("email, display_name");
    const safe = (data || []).filter((a: { email?: string }) => a.email && SAFE_ACCOUNTS.includes(a.email));
    setAccounts(safe.length ? safe : SAFE_ACCOUNTS.map(email => ({ email, display_name: email })));
    if (safe.length) setComposeFrom(safe[0].email);
    else setComposeFrom(SAFE_ACCOUNTS[0]);
  };

  const formatPhone = (val: string) => {
    if (val == null || typeof val !== "string") return "";
    const digits = val.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === "1") return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return val;
  };

  const saveField = async (field: string, value: string) => {
    let formatted = value;
    if (["phone", "cell_phone"].includes(field)) formatted = formatPhone(value);
    const { error } = await supabase.from("professionals").update({ [field]: formatted }).eq("id", professional.id);
    if (error) { toast.error("Failed to save"); return; }
    toast.success(`Updated ${field.replace(/_/g, " ")}`);
    setEditingField(null);
    loadFullPro();
  };

  const toggleActive = async () => {
    if (!pro) return;
    await supabase.from("professionals").update({ active: !pro.active }).eq("id", professional.id);
    toast.success(pro.active ? "Agent deactivated" : "Agent activated");
    loadFullPro();
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await supabase.from("crm_notes" as any).insert({ professional_id: professional.id, note: newNote.trim() });
    toast.success("Note added");
    setNewNote("");
    loadNotes();
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      setComposeSubject("");
      setComposeBody("");
      return;
    }
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    const firstName = (pro?.name || "").split(" ")[0] || "";
    const sub = (s: string) => s.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{first_name\}\}/g, firstName);
    setComposeSubject(sub(tpl.subject));
    setComposeBody(sub(tpl.body));
  };

  const sendEmail = async () => {
    if (!composeSubject || !composeBody) { toast.error("Subject and body required"); return; }
    setSending(true);
    try {
      await supabase.functions.invoke("gmail-send", {
        body: { from_account: composeFrom, to: pro?.email, subject: composeSubject, message_body: composeBody },
      });
      toast.success("Email sent");
      setShowCompose(false);
      setComposeSubject("");
      setComposeBody("");
      setSelectedTemplateId("");
      loadEmails();
    } catch { toast.error("Failed to send"); }
    finally { setSending(false); }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    await supabase.from("crm_tasks" as any).insert({
      professional_id: professional.id, title: newTaskTitle.trim(),
      priority: newTaskPriority, due_date: newTaskDue || null,
    });
    toast.success("Task added");
    setNewTaskTitle(""); setNewTaskDue(""); setShowAddTask(false);
    loadTasks();
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    await supabase.from("crm_tasks" as any).update({
      status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    loadTasks();
  };

  const handleChangeRequest = async (requestId: string, action: "approved" | "rejected") => {
    const cr = changeRequests.find(r => r.id === requestId);
    if (!cr) return;
    if (action === "approved") {
      const fieldMap: Record<string, string> = {
        "License Number": "license_number", "Phone": "phone", "Email": "email",
        "Company": "company", "Name": "name", "Reviews": "num_total_reviews",
        "Years of Experience": "years_experience", "Total Sales": "total_sales",
      };
      const dbField = fieldMap[cr.field_name] || (cr.field_name && String(cr.field_name).toLowerCase().replace(/ /g, "_")) || "";
      await supabase.from("professionals").update({ [dbField]: cr.proposed_value }).eq("id", professional.id);
    }
    await supabase.from("field_change_requests").update({
      status: action, reviewed_at: new Date().toISOString(), reviewed_by: "admin",
    }).eq("id", requestId);
    if (pro?.email && pro.email !== "pending@123.com") {
      const firstName = (pro.name || "").split(" ")[0] || "there";
      const subject = action === "approved" ? "Your review request at top10lists.us" : "We need more information";
      const body = action === "approved"
        ? `Hi ${firstName} -\n\nWe have reviewed your request to update your ${cr.field_name}. We have updated the information as you have requested.\n\nTo see the change, click here: ${pro.magic_link || "https://www.top10lists.us"}\n\nBest Regards,\n\nRobert Maynard\nFounder`
        : `Hi ${firstName} -\n\nWe are reviewing your request to update your ${cr.field_name}. Before we can approve it, we need more information.\n\nPlease provide a more detailed explanation justifying the change. Please include any links that will support your request.\n\nJust reply here with the information.\n\nRobert Maynard\nFounder`;
      try { await supabase.functions.invoke("gmail-send", { body: { from_account: "hello@toptenlists.us", to: pro.email, subject, message_body: body } }); } catch {}
    }
    toast.success(`Change request ${action} - notification sent`);
    loadChangeRequests(); loadEmails(); loadFullPro();
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const tierColor = (tier: string | null) => {
    const t = (tier || "listed").toLowerCase();
    if (t === "underwritten") return "bg-purple-100 text-purple-800 border-purple-300";
    if (t === "audited") return "bg-blue-100 text-blue-800 border-blue-300";
    if (t === "certified") return "bg-green-100 text-green-800 border-green-300";
    return "bg-gray-100 text-gray-700 border-gray-300";
  };

  const statusPill = (val: string | null) => {
    const s = (val || "none").toLowerCase();
    if (["active", "confirmed", "approved", "edit_complete"].includes(s)) return "text-green-700 bg-green-50";
    if (["pending", "welcome", "started"].includes(s)) return "text-yellow-700 bg-yellow-50";
    if (["disabled", "bounced", "unsubscribed", "past_due"].includes(s)) return "text-red-700 bg-red-50";
    return "text-gray-700 bg-gray-50";
  };

  const pendingCR = changeRequests.filter(r => r.status === "pending").length;
  const pendingTasks = tasks.filter(t => t.status === "pending").length;
  const inboundEmails = emails.filter(e => e.direction === "inbound");

  const EditableField = ({ field, label, value }: { field: string; label: string; value: string | null }) => (
    <div className="flex items-center justify-between py-1.5 group">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      {editingField === field ? (
        <div className="flex items-center gap-1 flex-1">
          <Input className="h-7 text-xs" value={editValue} onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveField(field, editValue); if (e.key === "Escape") setEditingField(null); }} autoFocus />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => saveField(field, editValue)}><Check className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingField(null)}><X className="h-3 w-3" /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-sm truncate flex-1">{value || "-"}</span>
          <button className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => { setEditingField(field); setEditValue(value || ""); }}>
            <Edit2 className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );

  const ReadField = ({ label, value }: { label: string; value: string | null }) => (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm truncate flex-1">{value || "-"}</span>
    </div>
  );

  if (isLoading || !pro) {
    return <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const profileUrl = pro.profile_link || (pro.canonical_slug ? `https://www.top10lists.us/professional/${pro.state_slug}/${pro.canonical_slug}` : null);

  const tabs = [
    { key: "overview" as const, label: "Overview", icon: User },
    { key: "emails" as const, label: "Emails", icon: Mail, count: inboundEmails.length },
    { key: "activity" as const, label: "Activity", icon: Activity, count: activities.length },
    { key: "tasks" as const, label: "Tasks", icon: ListTodo, count: pendingCR + pendingTasks },
    { key: "payments" as const, label: "Payments", icon: CreditCard },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl font-bold">{pro.name}</h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${tierColor(pro.current_tier)}`}>
            {(pro.current_tier || "listed").toUpperCase()}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${pro.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
            {pro.active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {profileUrl && (
            <Button size="sm" variant="outline" onClick={() => window.open(profileUrl, "_blank")}><Eye className="h-3.5 w-3.5 mr-1" />Profile</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowCompose(!showCompose)}><Send className="h-3.5 w-3.5 mr-1" />Email</Button>
          <Button size="sm" variant={pro.active ? "destructive" : "default"} onClick={toggleActive}>
            <Power className="h-3.5 w-3.5 mr-1" />{pro.active ? "Deactivate" : "Activate"}
          </Button>
        </div>
      </div>

      {/* Compose — open/click tracking is applied automatically by gmail-send */}
      {showCompose && (
        <Card className="border-primary/30">
          <CardContent className="py-3 px-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12">Template</span>
              <select
                className="text-sm border rounded px-2 py-1 flex-1 bg-background"
                value={selectedTemplateId}
                onChange={e => applyTemplate(e.target.value)}
              >
                <option value="">— Choose a template —</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12">From</span>
              <select className="text-sm border rounded px-2 py-1 flex-1 bg-background" value={composeFrom} onChange={e => setComposeFrom(e.target.value)}>
                {accounts.map(a => <option key={a.email} value={a.email}>{a.display_name ? `${a.display_name} <${a.email}>` : a.email}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12">To</span>
              <span className="text-sm">{pro.email}</span>
            </div>
            <Input placeholder="Subject" className="text-sm h-8" value={composeSubject} onChange={e => setComposeSubject(e.target.value)} />
            <Textarea placeholder="Write your message..." className="text-sm min-h-[100px]" value={composeBody} onChange={e => setComposeBody(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowCompose(false); setSelectedTemplateId(""); }}>Cancel</Button>
              <Button size="sm" onClick={sendEmail} disabled={sending}><Send className="h-3.5 w-3.5 mr-1" />{sending ? "Sending..." : "Send"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT SIDEBAR */}
        <div className="space-y-4">
          {/* Contact */}
          <Card>
            <CardHeader className="py-3 px-4 pb-1"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><User className="h-3.5 w-3.5" />Contact</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3 divide-y divide-muted/30">
              <EditableField field="email" label="Email" value={pro.email} />
              <EditableField field="phone" label="Phone" value={pro.phone} />
              <EditableField field="cell_phone" label="Cell" value={pro.cell_phone} />
              <EditableField field="company" label="Company" value={pro.company} />
              <EditableField field="business_city" label="City" value={pro.business_city} />
              <EditableField field="business_state" label="State" value={pro.business_state || pro.state_slug} />
              <EditableField field="business_zip" label="Zip" value={pro.business_zip} />
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader className="py-3 px-4 pb-1"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Status</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tier</span>
                <span className={`px-2 py-0.5 rounded-full font-medium border ${tierColor(pro.current_tier)}`}>{(pro.current_tier || "listed").toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Funnel</span>
                <span className={`px-2 py-0.5 rounded font-medium ${statusPill(pro.funnel_status)}`}>{pro.funnel_status || "none"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Subscription</span>
                <span className={`px-2 py-0.5 rounded font-medium ${statusPill(pro.subscription_status)}`}>{pro.subscription_status || "none"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Badge</span>
                <span>{pro.badge_tier || "-"} / {pro.badge_status || "-"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Unsubscribed</span>
                <span className={pro.email_unsubscribed ? "text-red-600 font-medium" : ""}>{pro.email_unsubscribed ? "Yes" : "No"}</span>
              </div>
              {enrollment && (
                <div className="bg-muted/30 rounded p-2 text-xs space-y-1 mt-2">
                  <div className="font-medium">Sequence: {(enrollment.crm_sequences as any)?.name}</div>
                  <div>Status: <strong>{enrollment.status}</strong> | Step {enrollment.current_step}</div>
                  <div>Account: {(enrollment.assigned_account && String(enrollment.assigned_account).split("@")[0]) || "-"}</div>
                  {enrollment.replied_at && <div>Replied: {format(new Date(enrollment.replied_at), "MMM d, yyyy")}</div>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* License & Stats */}
          <Card>
            <CardHeader className="py-3 px-4 pb-1"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" />License & Stats</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3 divide-y divide-muted/30">
              <EditableField field="license_number" label="License #" value={pro.license_number} />
              <ReadField label="License Status" value={pro.license_status} />
              <EditableField field="years_experience" label="Experience" value={pro.years_experience ? `${pro.years_experience}` : null} />
              <ReadField label="Zillow Rating" value={pro.review_stars_rating ? `${pro.review_stars_rating} (${pro.num_total_reviews})` : null} />
              <ReadField label="Google Rating" value={pro.google_review_rating ? `${pro.google_review_rating} (${pro.google_review_count})` : null} />
              <ReadField label="Sales (All)" value={pro.sales_count_all_time?.toLocaleString() ?? null} />
              <ReadField label="Sales (Last Yr)" value={pro.sales_count_last_year?.toLocaleString() ?? null} />
              <ReadField label="Avg Value (3yr)" value={pro.average_value_3yr ? `$${pro.average_value_3yr.toLocaleString()}` : null} />
              {pro.signal_score != null && <ReadField label="Signal Score" value={`${pro.signal_score}`} />}
            </CardContent>
          </Card>

          {/* Links */}
          <Card>
            <CardHeader className="py-3 px-4 pb-1"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><Link className="h-3.5 w-3.5" />Links</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3 space-y-2 text-xs">
              {pro.magic_link && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Magic Link</span>
                  <button onClick={() => copyText(pro.magic_link, "Magic link")} className="text-primary hover:underline flex items-center gap-1"><Copy className="h-3 w-3" />Copy</button>
                  <a href={pro.magic_link} target="_blank" rel="noopener" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3 w-3" />Open</a>
                </div>
              )}
              {profileUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Profile</span>
                  <a href={profileUrl} target="_blank" rel="noopener" className="text-primary hover:underline truncate">{(profileUrl || "").replace("https://www.top10lists.us", "")}</a>
                </div>
              )}
              {pro.zillow_profile_url && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Zillow</span>
                  <a href={pro.zillow_profile_url} target="_blank" rel="noopener" className="text-primary hover:underline">View</a>
                </div>
              )}
              {pro.google_maps_url && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Google Maps</span>
                  <a href={pro.google_maps_url} target="_blank" rel="noopener" className="text-primary hover:underline">View</a>
                </div>
              )}
              {pro.website && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">Website</span>
                  <a href={(typeof pro.website === "string" && pro.website.startsWith("http")) ? pro.website : `https://${pro.website}`} target="_blank" rel="noopener" className="text-primary hover:underline truncate">{pro.website}</a>
                </div>
              )}
              {[["LinkedIn", pro.social_linkedin], ["Facebook", pro.social_facebook], ["Instagram", pro.social_instagram], ["Twitter", pro.social_twitter]].filter(([, v]) => v).map(([label, url]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-20 shrink-0">{label}</span>
                  <a href={url as string} target="_blank" rel="noopener" className="text-primary hover:underline truncate">{typeof url === "string" ? url.replace(/https?:\/\/(www\.)?/, "").split("/").slice(0, 2).join("/") : ""}</a>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Revenue */}
          <Card>
            <CardHeader className="py-3 px-4 pb-1"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />Revenue</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">MRR</span>
                <span className="font-semibold text-sm">${((pro.monthly_revenue_cents || 0) / 100).toFixed(2)}</span>
              </div>
              {pro.last_payment_at && <ReadField label="Last Payment" value={format(new Date(pro.last_payment_at), "MMM d, yyyy")} />}
              {pro.next_bill_date && <ReadField label="Next Bill" value={format(new Date(pro.next_bill_date), "MMM d, yyyy")} />}
              {pro.paid_cities?.length > 0 && <ReadField label="Paid Cities" value={pro.paid_cities.join(", ")} />}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT CONTENT */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <tab.icon className="h-3.5 w-3.5" />{tab.label}
                {(tab.count ?? 0) > 0 && <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Engagement Stats */}
              {emails.filter(e => e.direction === "outbound").length > 0 && (() => {
                const outbound = emails.filter(e => e.direction === "outbound");
                const opened = outbound.filter(e => e.opened_at);
                const clicked = outbound.filter(e => e.clicked_at);
                return (
                  <Card>
                    <CardHeader className="py-3 px-4 pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Email Engagement</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-muted/30 rounded p-3 text-center">
                          <p className="text-lg font-bold">{outbound.length}</p>
                          <p className="text-xs text-muted-foreground">Sent</p>
                        </div>
                        <div className="bg-muted/30 rounded p-3 text-center">
                          <p className="text-lg font-bold">{opened.length}</p>
                          <p className="text-xs text-muted-foreground">Opened ({outbound.length > 0 ? Math.round(opened.length / outbound.length * 100) : 0}%)</p>
                        </div>
                        <div className="bg-muted/30 rounded p-3 text-center">
                          <p className="text-lg font-bold">{clicked.length}</p>
                          <p className="text-xs text-muted-foreground">Clicked ({outbound.length > 0 ? Math.round(clicked.length / outbound.length * 100) : 0}%)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
              <Card>
                <CardHeader className="py-3 px-4 pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><StickyNote className="h-3.5 w-3.5" />Notes</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  <div className="flex gap-2">
                    <Textarea placeholder="Add a note..." className="text-sm min-h-[60px]" value={newNote} onChange={e => setNewNote(e.target.value)} />
                    <Button size="sm" onClick={addNote} disabled={!newNote.trim()} className="self-end shrink-0"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
                  </div>
                  {notes.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No notes yet</p>}
                  {notes.map(note => (
                    <div key={note.id} className="bg-muted/30 rounded p-3">
                      <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                      <p className="text-xs text-muted-foreground mt-1">{format(new Date(note.created_at), "MMM d, yyyy h:mm a")}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {pro.synthesized_bio && (
                <Card>
                  <CardHeader className="py-3 px-4 pb-2"><CardTitle className="text-sm font-semibold">Bio</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3"><p className="text-sm text-muted-foreground">{pro.synthesized_bio}</p></CardContent>
                </Card>
              )}
              {inboundEmails.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4 pb-2"><CardTitle className="text-sm font-semibold">Recent Inbound Emails</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    {inboundEmails.slice(0, 3).map(email => (
                      <div key={email.id} className="flex items-center justify-between text-sm">
                        <span className="truncate flex-1">{email.subject}</span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{format(new Date(email.sent_at), "MMM d")}</span>
                      </div>
                    ))}
                    {inboundEmails.length > 3 && <button onClick={() => setActiveTab("emails")} className="text-xs text-primary hover:underline">View all {inboundEmails.length} inbound emails</button>}
                  </CardContent>
                </Card>
              )}
              {activities.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4 pb-2"><CardTitle className="text-sm font-semibold">Recent Activity</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    {activities.slice(0, 5).map(event => (
                      <div key={event.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{(event.event_name || "").replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">{format(new Date(event.created_at), "MMM d, h:mm a")}</span>
                      </div>
                    ))}
                    {activities.length > 5 && <button onClick={() => setActiveTab("activity")} className="text-xs text-primary hover:underline">View all {activities.length} events</button>}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* EMAILS */}
          {activeTab === "emails" && (
            <div className="space-y-2">
              {inboundEmails.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No inbound emails</CardContent></Card>}
              {(() => {
                const threads: Record<string, any[]> = {};
                emails.forEach(e => {
                  const tid = e.gmail_thread_id || e.id;
                  if (!threads[tid]) threads[tid] = [];
                  threads[tid].push(e);
                });
                // Only show threads that have at least one inbound message
                const inboundThreads = Object.values(threads)
                  .filter(t => t.some(e => e.direction === "inbound"))
                  .sort((a, b) => new Date(b[0].sent_at).getTime() - new Date(a[0].sent_at).getTime());

                return inboundThreads.map(thread => {
                  const latest = thread[0];
                  const inbound = thread.filter(e => e.direction === "inbound");
                  const outbound = thread.filter(e => e.direction === "outbound");
                  return (
                    <Card key={latest.gmail_thread_id || latest.id} className="border-l-2 border-l-blue-400">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{latest.subject}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {inbound.length} in{outbound.length > 0 ? ` / ${outbound.length} out` : ""}
                              </span>
                              {thread.some(e => e.opened_at) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700">Opened</Badge>}
                              {thread.some(e => e.clicked_at) && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700">Clicked</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">From: {inbound[0]?.from_address}</p>
                            {inbound[0]?.body_text && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{inbound[0].body_text.substring(0, 200)}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{format(new Date(latest.sent_at), "MMM d, h:mm a")}</span>
                        </div>
                        {thread.length > 1 && (
                          <div className="mt-2 pt-2 border-t border-muted/30 space-y-1.5">
                            {thread.slice(1).map(e => (
                              <div key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant={e.direction === "outbound" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                  {e.direction === "outbound" ? "out" : "in"}
                                </Badge>
                                <span className="truncate flex-1">{e.body_text?.substring(0, 80) || e.subject}</span>
                                <span className="shrink-0">{format(new Date(e.sent_at), "MMM d")}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                });
              })()}
            </div>
          )}

          {/* ACTIVITY */}
          {activeTab === "activity" && (
            <div className="space-y-2">
              {activities.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No activity recorded</CardContent></Card>}
              {activities.map((event: any) => {
                if (event._source === "email_engagement") {
                  const isClick = event.event_type === "email_click";
                  const isOpen  = event.event_type === "email_open";
                  return (
                    <Card key={event.id} className={isClick ? "border-blue-200" : "border-green-200"}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 text-base ${isClick ? "text-blue-500" : "text-green-500"}`}>
                              {isClick ? "👆" : "👁"}
                            </span>
                            <div>
                              <span className="text-sm font-semibold">
                                {isClick ? "Clicked link" : "Opened email"}
                              </span>
                              {event.subject && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-medium">{event.subject}</p>
                              )}
                              {isClick && event.link_url && (
                                <a href={event.link_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline truncate block max-w-xs mt-0.5">
                                  {(event.link_url && String(event.link_url).replace(/https?:\/\/[^/]+/, "")) || event.link_url || ""}
                                </a>
                              )}
                              {event.from_account && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  via {event.from_account}
                                  {event.sequence_name && <span className="ml-1 text-muted-foreground/70">· {event.sequence_name}</span>}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{format(new Date(event.created_at), "MMM d, h:mm a")}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                // Funnel events (existing)
                return (
                  <Card key={event.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">{(event.event_name || event.event_type || "").replace(/_/g, " ")}</span>
                          {event.event_data && Object.keys(event.event_data).length > 0 && <span className="text-xs text-muted-foreground">{JSON.stringify(event.event_data).substring(0, 80)}</span>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{format(new Date(event.created_at), "MMM d, h:mm a")}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* TASKS */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {changeRequests.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Field Change Requests</h3>
                  {changeRequests.map(cr => (
                    <Card key={cr.id} className={cr.status !== "pending" ? "opacity-60" : ""}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{cr.field_name}</span>
                              <Badge variant={cr.status === "pending" ? "default" : cr.status === "accepted" || cr.status === "approved" ? "secondary" : "destructive"} className="text-xs">{cr.status}</Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs">
                              <span className="text-muted-foreground">Current: <span className="font-mono">{cr.current_value}</span></span>
                              <span className="text-primary">Proposed: <span className="font-mono">{cr.proposed_value}</span></span>
                            </div>
                            {cr.change_request && <p className="text-xs text-muted-foreground mt-1">Note: {cr.change_request}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{format(new Date(cr.created_at), "MMM d")}</span>
                            {cr.status === "pending" && (
                              <>
                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleChangeRequest(cr.id, "approved")}>Accept</Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => handleChangeRequest(cr.id, "rejected")}>Reject</Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><ListTodo className="h-3.5 w-3.5" />Tasks</h3>
                  <Button size="sm" variant="outline" onClick={() => setShowAddTask(!showAddTask)}>
                    {showAddTask ? <X className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}{showAddTask ? "Cancel" : "Add Task"}
                  </Button>
                </div>
                {showAddTask && (
                  <Card><CardContent className="py-3 px-4 space-y-2">
                    <Input placeholder="Task title..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                    <div className="flex gap-2">
                      <Input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} className="w-40" />
                      <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)} className="border rounded px-2 py-1 text-sm bg-background">
                        <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                      </select>
                      <Button size="sm" onClick={addTask}>Save</Button>
                    </div>
                  </CardContent></Card>
                )}
                {tasks.length === 0 && !showAddTask && <Card><CardContent className="py-4 text-center text-sm text-muted-foreground">No tasks</CardContent></Card>}
                {tasks.map(task => (
                  <Card key={task.id} className={task.status === "completed" ? "opacity-60" : ""}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleTask(task.id, task.status)} className="shrink-0">
                          {task.status === "completed" ? <Check className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${task.status === "completed" ? "line-through" : "font-medium"}`}>{task.title}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.priority !== "normal" && <Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "default" : "secondary"} className="text-xs">{task.priority}</Badge>}
                            {task.due_date && <span className="text-xs text-muted-foreground">Due {format(new Date(task.due_date), "MMM d")}</span>}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{format(new Date(task.created_at), "MMM d")}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* PAYMENTS */}
          {activeTab === "payments" && (
            <div className="space-y-4">
              {/* Stripe Summary */}
              <Card>
                <CardHeader className="py-3 px-4 pb-2"><CardTitle className="text-sm font-semibold">Billing Summary</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted/30 rounded p-3">
                      <p className="text-xs text-muted-foreground">MRR</p>
                      <p className="text-lg font-bold">${((pro.monthly_revenue_cents || 0) / 100).toFixed(2)}</p>
                    </div>
                    <div className="bg-muted/30 rounded p-3">
                      <p className="text-xs text-muted-foreground">Subscription</p>
                      <p className={`text-sm font-semibold ${statusPill(pro.subscription_status)}`}>{pro.subscription_status || "none"}</p>
                    </div>
                    <div className="bg-muted/30 rounded p-3">
                      <p className="text-xs text-muted-foreground">Last Payment</p>
                      <p className="text-sm font-medium">{pro.last_payment_at ? format(new Date(pro.last_payment_at), "MMM d, yyyy") : "-"}</p>
                      {pro.last_payment_status && <p className="text-xs text-muted-foreground">{pro.last_payment_status}</p>}
                    </div>
                    <div className="bg-muted/30 rounded p-3">
                      <p className="text-xs text-muted-foreground">Next Bill</p>
                      <p className="text-sm font-medium">{pro.next_bill_date ? format(new Date(pro.next_bill_date), "MMM d, yyyy") : "-"}</p>
                    </div>
                  </div>
                  {pro.payment_failed_at && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                      Payment failed on {format(new Date(pro.payment_failed_at), "MMM d, yyyy")}
                      {pro.grace_period_ends_at && ` - Grace period ends ${format(new Date(pro.grace_period_ends_at), "MMM d, yyyy")}`}
                    </div>
                  )}
                  {pro.paid_cities?.length > 0 && (
                    <div className="mt-3 text-xs">
                      <span className="text-muted-foreground">Paid cities: </span>
                      <span className="font-medium">{pro.paid_cities.join(", ")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Neighborhood Subscriptions */}
              {subscriptions.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4 pb-2"><CardTitle className="text-sm font-semibold">Neighborhood Subscriptions</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    {subscriptions.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between text-sm bg-muted/20 rounded p-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={sub.is_active ? "default" : "secondary"} className="text-xs">{sub.is_active ? "Active" : "Inactive"}</Badge>
                          <span>Neighborhood #{sub.neighborhood_id?.substring(0, 8)}</span>
                          <span className="text-muted-foreground">{sub.tier_at_purchase}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>${sub.price_paid}/mo</span>
                          {sub.started_at && <span>Since {format(new Date(sub.started_at), "MMM d, yyyy")}</span>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Payment Log */}
              {payments.length > 0 && (
                <Card>
                  <CardHeader className="py-3 px-4 pb-2"><CardTitle className="text-sm font-semibold">Payment History</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    {payments.map(payment => (
                      <div key={payment.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">${(payment.amount_cents / 100).toFixed(2)}</span>
                          <span className="text-muted-foreground">{payment.description}</span>
                          <Badge variant={payment.status === "succeeded" ? "default" : "destructive"} className="text-xs">{payment.status}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{format(new Date(payment.created_at), "MMM d, yyyy")}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {payments.length === 0 && !pro.monthly_revenue_cents && subscriptions.length === 0 && (
                <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No payment activity yet.</CardContent></Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
