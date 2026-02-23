import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Star, ArrowLeft, Plus, Check, Clock, CreditCard, Send, Activity, ListTodo, X, AlertCircle } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"email" | "activity" | "tasks" | "payments">("email");
  const [emails, setEmails] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [certification, setCertification] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");
  const [showAddTask, setShowAddTask] = useState(false);

  useEffect(() => {
    loadAll();
  }, [professional.id]);

  const loadAll = async () => {
    setIsLoading(true);
    await Promise.all([loadEmails(), loadActivities(), loadTasks(), loadChangeRequests(), loadPayments(), loadEnrollment(), loadCertification()]);
    setIsLoading(false);
  };

  const loadEmails = async () => {
    if (!professional.email || professional.email === "pending@123.com") { setEmails([]); return; }
    const { data } = await supabase
      .from("crm_emails")
      .select("*")
      .or(`to_address.ilike.%${professional.email}%,from_address.ilike.%${professional.email}%`)
      .order("sent_at", { ascending: false })
      .limit(50);
    setEmails(data || []);
  };

  const loadActivities = async () => {
    const { data } = await supabase
      .from("funnel_events")
      .select("*")
      .eq("professional_id", professional.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivities(data || []);
  };

  const loadTasks = async () => {
    const { data } = await supabase
      .from("crm_tasks" as any)
      .select("*")
      .eq("professional_id", professional.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTasks(data || []);
  };

  const loadChangeRequests = async () => {
    const { data } = await supabase
      .from("field_change_requests")
      .select("*")
      .eq("professional_id", professional.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setChangeRequests(data || []);
  };

  const loadPayments = async () => {
    const { data } = await supabase
      .from("crm_payment_log" as any)
      .select("*")
      .eq("professional_id", professional.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setPayments(data || []);
  };

  const loadEnrollment = async () => {
    const { data } = await supabase
      .from("crm_sequence_enrollments")
      .select("*, crm_sequences(name)")
      .eq("professional_id", professional.id)
      .order("enrolled_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setEnrollment(data);
  };

  const loadCertification = async () => {
    const { data } = await supabase
      .from("certifications")
      .select("*")
      .eq("professional_id", professional.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCertification(data);
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    const { error } = await supabase.from("crm_tasks" as any).insert({
      professional_id: professional.id,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      due_date: newTaskDue || null,
    });
    if (error) { toast.error("Failed to add task"); return; }
    toast.success("Task added");
    setNewTaskTitle("");
    setNewTaskDue("");
    setShowAddTask(false);
    loadTasks();
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    await supabase.from("crm_tasks" as any).update({
      status: newStatus,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    loadTasks();
  };

  const handleChangeRequest = async (requestId: string, action: "approved" | "rejected") => {
    const cr = changeRequests.find(r => r.id === requestId);
    if (!cr) return;

    if (action === "approved") {
      const fieldMap: Record<string, string> = {
        "License Number": "license_number",
        "Phone": "phone",
        "Email": "email",
        "Company": "company",
        "Name": "name",
      };
      const dbField = fieldMap[cr.field_name] || cr.field_name.toLowerCase().replace(/ /g, "_");
      await supabase.from("professionals").update({ [dbField]: cr.proposed_value }).eq("id", professional.id);
    }

    await supabase.from("field_change_requests").update({
      status: action,
      reviewed_at: new Date().toISOString(),
      reviewed_by: "admin",
    }).eq("id", requestId);

    // Send notification email to agent
    const { data: proData } = await supabase
      .from("professionals")
      .select("email, name, magic_link")
      .eq("id", professional.id)
      .single();

    if (proData?.email && proData.email !== "pending@123.com") {
      const firstName = (proData.name || "").split(" ")[0] || "there";

      let subject = "";
      let body = "";

      if (action === "approved") {
        subject = "Your review request at top10lists.us";
        body = `Hi ${firstName} -

We have reviewed your request to update your ${cr.field_name}. We have updated the information as you have requested.

To see the change, click here: ${proData.magic_link || "https://www.top10lists.us"}

Best Regards,

Robert Maynard
Founder`;
      } else {
        subject = "We need more information";
        body = `Hi ${firstName} -

We are reviewing your request to update your ${cr.field_name}. Before we can approve it, we need more information.

Please provide a more detailed explanation justifying the change. Please include any links that will support your request.

Just reply here with the information.

Robert Maynard
Founder`;
      }

      try {
        await supabase.functions.invoke("gmail-send", {
          body: {
            from_account: "hello@top10lists.us",
            to: proData.email,
            subject,
            message_body: body,
          },
        });
      } catch (e) {
        console.error("Failed to send notification email:", e);
      }
    }

    toast.success(`Change request ${action} - notification sent`);
    loadChangeRequests();
    loadEmails();
  };

  const tierBadge = (tier: string | null) => {
    const colors: Record<string, string> = {
      underwritten: "bg-purple-100 text-purple-800 border-purple-200",
      audited: "bg-blue-100 text-blue-800 border-blue-200",
      certified: "bg-green-100 text-green-800 border-green-200",
      listed: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return colors[tier || "listed"] || colors.listed;
  };

  const pendingChangeCount = changeRequests.filter(r => r.status === "pending").length;
  const pendingTaskCount = tasks.filter(t => t.status === "pending").length;

  const tabs = [
    { key: "email" as const, label: "Emails", icon: Mail, count: emails.length },
    { key: "activity" as const, label: "Activity", icon: Activity, count: activities.length },
    { key: "tasks" as const, label: "Tasks", icon: ListTodo, count: pendingTaskCount + pendingChangeCount },
    { key: "payments" as const, label: "Payments", icon: CreditCard, count: payments.length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="mt-1 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold">{professional.name}</h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${tierBadge(professional.current_tier)}`}>
                  {(professional.current_tier || "listed").toUpperCase()}
                </span>
              </div>
              {professional.company && <p className="text-sm text-muted-foreground mt-1">{professional.company}</p>}
              <div className="flex items-center gap-6 mt-2 flex-wrap text-sm">
                {professional.email && professional.email !== "pending@123.com" && (
                  <a href={`mailto:${professional.email}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5" />{professional.email}
                  </a>
                )}
                {professional.email === "pending@123.com" && (
                  <span className="flex items-center gap-1 text-destructive"><Mail className="h-3.5 w-3.5" />Bounced</span>
                )}
                {professional.phone && (
                  <a href={`tel:${professional.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" />{professional.phone}
                  </a>
                )}
                {professional.business_city && (
                  <span className="text-muted-foreground">{professional.business_city}, {professional.state_slug?.toUpperCase()}</span>
                )}
                {professional.review_stars_rating && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {professional.review_stars_rating} ({professional.num_total_reviews})
                  </span>
                )}
              </div>
              {enrollment && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Sequence: {(enrollment.crm_sequences as any)?.name || "Unknown"} | Status: <Badge variant="outline" className="text-xs">{enrollment.status}</Badge> | Step {enrollment.current_step}
                  {enrollment.replied_at && ` | Replied ${format(new Date(enrollment.replied_at), "MMM d")}`}
                </div>
              )}
              {certification && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Certified: {format(new Date(certification.issued_at), "MMM d, yyyy")} | Methodology: {certification.methodology_version}
                  {certification.subscription_status && ` | Subscription: ${certification.subscription_status}`}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b pb-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count > 0 && (
              <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Emails Tab */}
          {activeTab === "email" && (
            <div className="space-y-2">
              {emails.length === 0 && (
                <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No email correspondence</CardContent></Card>
              )}
              {emails.map(email => (
                <Card key={email.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={email.direction === "outbound" ? "default" : "secondary"} className="text-xs shrink-0">
                            {email.direction === "outbound" ? <Send className="h-2.5 w-2.5 mr-1" /> : <Mail className="h-2.5 w-2.5 mr-1" />}
                            {email.direction}
                          </Badge>
                          <span className="text-sm font-medium truncate">{email.subject}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {email.direction === "outbound" ? `To: ${email.to_address}` : `From: ${email.from_address}`}
                          {" via "}{email.account_email}
                        </p>
                        {email.body_text && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{email.body_text.substring(0, 200)}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                        {format(new Date(email.sent_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div className="space-y-2">
              {activities.length === 0 && (
                <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No activity recorded</CardContent></Card>
              )}
              {activities.map(event => (
                <Card key={event.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{event.event_name.replace(/_/g, " ")}</span>
                        {event.event_data && Object.keys(event.event_data).length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {JSON.stringify(event.event_data).substring(0, 80)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(event.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="space-y-4">
              {/* Field Change Requests */}
              {changeRequests.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />Field Change Requests
                  </h3>
                  {changeRequests.map(cr => (
                    <Card key={cr.id} className={cr.status !== "pending" ? "opacity-60" : ""}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{cr.field_name}</span>
                              <Badge variant={cr.status === "pending" ? "default" : cr.status === "approved" ? "secondary" : "destructive"} className="text-xs">
                                {cr.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs">
                              <span className="text-muted-foreground">Current: <span className="font-mono">{cr.current_value}</span></span>
                              <span className="text-primary">Proposed: <span className="font-mono">{cr.proposed_value}</span></span>
                            </div>
                            {cr.change_request && (
                              <p className="text-xs text-muted-foreground mt-1">Note: {cr.change_request}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{format(new Date(cr.created_at), "MMM d")}</span>
                            {cr.status === "pending" && (
                              <>
                                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleChangeRequest(cr.id, "approved")}>
                                  Accept
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => handleChangeRequest(cr.id, "rejected")}>
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Manual Tasks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                    <ListTodo className="h-3.5 w-3.5" />Tasks
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => setShowAddTask(!showAddTask)}>
                    {showAddTask ? <X className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                    {showAddTask ? "Cancel" : "Add Task"}
                  </Button>
                </div>
                {showAddTask && (
                  <Card>
                    <CardContent className="py-3 px-4 space-y-2">
                      <Input placeholder="Task title..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} />
                      <div className="flex gap-2">
                        <Input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} className="w-40" />
                        <select
                          value={newTaskPriority}
                          onChange={e => setNewTaskPriority(e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                        <Button size="sm" onClick={addTask}>Save</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {tasks.length === 0 && !showAddTask && (
                  <Card><CardContent className="py-4 text-center text-sm text-muted-foreground">No tasks</CardContent></Card>
                )}
                {tasks.map(task => (
                  <Card key={task.id} className={task.status === "completed" ? "opacity-60" : ""}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleTask(task.id, task.status)} className="shrink-0">
                          {task.status === "completed"
                            ? <Check className="h-4 w-4 text-green-600" />
                            : <Clock className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${task.status === "completed" ? "line-through" : "font-medium"}`}>
                            {task.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.priority !== "normal" && (
                              <Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "default" : "secondary"} className="text-xs">
                                {task.priority}
                              </Badge>
                            )}
                            {task.due_date && (
                              <span className="text-xs text-muted-foreground">Due {format(new Date(task.due_date), "MMM d")}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(task.created_at), "MMM d")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === "payments" && (
            <div className="space-y-2">
              {payments.length === 0 && (
                <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No payment history. Payments will appear here once Stripe is connected.</CardContent></Card>
              )}
              {payments.map(payment => (
                <Card key={payment.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">${(payment.amount_cents / 100).toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground">{payment.description}</span>
                        <Badge variant={payment.status === "succeeded" ? "default" : "destructive"} className="text-xs">{payment.status}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(payment.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
