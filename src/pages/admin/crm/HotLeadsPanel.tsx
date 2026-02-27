import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ContactDetail } from "@/components/crm/ContactDetail";

const FUNNEL_STEPS: Record<string, { label: string; order: number }> = {
  funnel_started:         { label: "Opened funnel",         order: 1 },
  step0_viewed:           { label: "Viewed intro",           order: 2 },
  step0_completed:        { label: "Completed intro",        order: 3 },
  accuracy_review_viewed: { label: "Reviewing profile",      order: 4 },
  accuracy_confirmed:     { label: "Profile confirmed",      order: 5 },
  profile_edit_viewed:    { label: "Viewing edits",          order: 6 },
  profile_edited:         { label: "Edited profile",         order: 7 },
  profile_verified:       { label: "Profile verified",       order: 8 },
  profile_approved:       { label: "Profile approved",       order: 9 },
  card_preview_viewed:    { label: "Viewed card preview",    order: 10 },
  see_listing_clicked:    { label: "Clicked listing",        order: 11 },
  cities_selected:        { label: "Selected cities",        order: 12 },
  neighborhoods_selected: { label: "Selected neighborhoods", order: 13 },
  pricing_viewed:         { label: "Viewed pricing",         order: 14 },
  checkout_started:       { label: "Started checkout",       order: 15 },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getFurthestStep(agentId: string, events: any[]) {
  const ranked = events
    .filter(e => e.professional_id === agentId && FUNNEL_STEPS[e.event_name])
    .sort((a, b) => FUNNEL_STEPS[b.event_name].order - FUNNEL_STEPS[a.event_name].order);
  return ranked[0] ?? null;
}

function getLastActivity(agentId: string, activity: any[]) {
  return activity.find(a => a.professional_id === agentId) ?? null;
}

function getPendingTasks(agentId: string, tasks: any[]) {
  return tasks.filter(t => t.professional_id === agentId && t.status === "pending");
}

interface Template { id: string; subject: string; body: string; label: string; }
interface SendModal { lead: any; open: boolean; }

export default function HotLeadsPanel() {
  const [leads, setLeads]           = useState<any[]>([]);
  const [activity, setActivity]     = useState<any[]>([]);
  const [funnelEvents, setFunnelEvents] = useState<any[]>([]);
  const [tasks, setTasks]           = useState<any[]>([]);
  const [templates, setTemplates]   = useState<Template[]>([]);
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter]         = useState<"all" | "hot" | "warm">("all");
  const [completingTask, setCompletingTask] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<{
    id: string; name: string; email: string; phone: string | null;
    company: string | null; business_city: string | null; state_slug: string | null;
    current_tier: string | null; review_stars_rating: number | null;
    num_total_reviews: number | null; canonical_slug: string | null;
  } | null>(null);

  // Send email modal state
  const [modal, setModal]           = useState<SendModal>({ lead: null, open: false });
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [fromAccount, setFromAccount] = useState<string>("robert@toptenlists.us");
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const SAFE_ACCOUNTS = ["robert@toptenlists.us", "hello@toptenlists.us"];

  const load = useCallback(async () => {
    setLoading(true);
    const { data: pros } = await supabase
      .from("professionals")
      .select("id, name, email, phone, business_city, lead_status, current_tier, magic_link, verification_token")
      .in("lead_status", ["warm", "hot"])
      .order("lead_status", { ascending: true })
      .order("name");

    if (!pros?.length) {
      setLeads([]);
      setLoading(false);
      setLastRefresh(new Date());
      return;
    }

    const ids = pros.map((p: any) => p.id);
    const [{ data: activityData }, { data: funnelData }, { data: taskData }, { data: stepData }] = await Promise.all([
      supabase.from("crm_contact_activity")
        .select("professional_id, event_type, created_at, link_url, sequence_name")
        .in("professional_id", ids).order("created_at", { ascending: false }),
      supabase.from("funnel_events")
        .select("professional_id, event_name, created_at")
        .in("professional_id", ids).order("created_at", { ascending: false }),
      supabase.from("crm_tasks")
        .select("id, professional_id, task_type, title, description, status, priority, created_at")
        .in("professional_id", ids).order("created_at", { ascending: false }),
      supabase.from("crm_email_templates")
        .select("id, name, subject, body")
        .order("name"),
    ]);

    setLeads(pros);
    setActivity(activityData ?? []);
    setFunnelEvents(funnelData ?? []);
    setTasks(taskData ?? []);

    const tpls: Template[] = (stepData ?? []).map((t: any) => ({
      id: t.id,
      subject: t.subject ?? "",
      body: t.body ?? "",
      label: t.name ?? t.subject ?? "Template",
    }));
    setTemplates(tpls);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  async function markTaskDone(taskId: string) {
    setCompletingTask(taskId);
    await supabase.from("crm_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "completed" } : t));
    setCompletingTask(null);
  }

  function openSendModal(lead: any) {
    setModal({ lead, open: true });
    setSelectedTemplate("");
    setFromAccount("robert@toptenlists.us");
    setSendResult(null);
  }

  function closeSendModal() {
    setModal({ lead: null, open: false });
    setSendResult(null);
    setSending(false);
  }

  async function sendEmail() {
    if (!modal.lead || !selectedTemplate) return;
    const tpl = templates.find(t => t.id === selectedTemplate);
    if (!tpl) return;

    setSending(true);
    setSendResult(null);

    const firstName = modal.lead.name?.split(" ")[0] ?? modal.lead.name;
    const sub = (s: string) => s.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{first_name\}\}/g, firstName);
    const subject = sub(tpl.subject);
    const body    = sub(tpl.body);

    try {
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: modal.lead.email,
          subject,
          message_body: body,
          from_account: fromAccount,
          professional_id: modal.lead.id,
        },
      });
      if (error) throw error;
      setSendResult({ ok: true, msg: `Sent to ${modal.lead.email}` });
    } catch (e: any) {
      setSendResult({ ok: false, msg: e.message ?? "Send failed" });
    }
    setSending(false);
  }

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const displayed       = leads.filter(l => filter === "all" ? true : l.lead_status === filter);
  const hotCount        = leads.filter(l => l.lead_status === "hot").length;
  const warmCount       = leads.filter(l => l.lead_status === "warm").length;
  const pendingTaskCount = tasks.filter(t => t.status === "pending").length;

  const taskBadge: Record<string, { bg: string; label: string }> = {
    email_clicked: { bg: "#ef4444", label: "Clicked" },
    email_opened:  { bg: "#f59e0b", label: "Opened" },
    email_bounced: { bg: "#6b7280", label: "Bounced" },
  };

  const btnStyle = (bg: string) => ({
    padding: "5px 10px", background: bg, color: "#fff", borderRadius: "5px",
    textDecoration: "none", fontSize: "12px", whiteSpace: "nowrap" as const,
    border: "none", cursor: "pointer" as const, display: "inline-block",
  });

  const filterBtn = (val: "all" | "hot" | "warm") => ({
    padding: "6px 14px", borderRadius: "6px", border: "1px solid",
    fontSize: "13px", fontWeight: "500" as const, cursor: "pointer" as const,
    background: filter === val ? "#1a1a1a" : "#fff",
    color: filter === val ? "#fff" : "#555",
    borderColor: filter === val ? "#1a1a1a" : "#ddd",
  });

  const selectedTpl = templates.find(t => t.id === selectedTemplate);
  const firstForPreview = modal.lead?.name?.split(" ")[0] ?? "";
  const previewBody = selectedTpl
    ? selectedTpl.body.replace(/\{\{firstName\}\}/g, firstForPreview).replace(/\{\{first_name\}\}/g, firstForPreview)
    : "";

  const latestActivityAt = (() => {
    const activityTimes = (activity ?? []).map((a: any) => a.created_at).filter(Boolean);
    const taskTimes = (tasks ?? []).map((t: any) => t.created_at).filter(Boolean);
    const all = [...activityTimes, ...taskTimes];
    if (all.length === 0) return null;
    return all.reduce((latest: string, t: string) => (t > latest ? t : latest), all[0]);
  })();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "24px", maxWidth: "1400px", margin: "0 auto", color: "#1a1a1a" }}>

      {/* Contact Detail inline */}
      {selectedContact && (
        <ContactDetail
          professional={selectedContact}
          onBack={() => setSelectedContact(null)}
        />
      )}

      {/* Send Email Modal */}
      {modal.open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "600px", maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700" }}>Send Email</h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#666" }}>
                  To: {modal.lead?.name} &lt;{modal.lead?.email}&gt;
                </p>
              </div>
              <button onClick={closeSendModal} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#999", lineHeight: 1 }}>x</button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                From
              </label>
              <select
                value={fromAccount}
                onChange={e => setFromAccount(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", background: "#fff" }}
              >
                {SAFE_ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Select Template
              </label>
              <select
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "13px", background: "#fff" }}
              >
                <option value="">-- Choose a template --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
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
              <button onClick={closeSendModal} style={{ ...btnStyle("#888") }}>Cancel</button>
              <button
                onClick={sendEmail}
                disabled={!selectedTemplate || sending || !!sendResult?.ok}
                style={{ ...btnStyle(!selectedTemplate || sending || !!sendResult?.ok ? "#ccc" : "#1a1a1a") }}
              >
                {sending ? "Sending..." : sendResult?.ok ? "Sent" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px" }}>Hot Leads</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
            Last refresh: {lastRefresh.toLocaleTimeString()}
            {latestActivityAt != null && (
              <span> &middot; Latest activity: {relativeTime(latestActivityAt)}</span>
            )}
            {" "}&middot; Auto-refreshes every 30s
            {pendingTaskCount > 0 && (
              <span style={{ marginLeft: "12px", background: "#ef4444", color: "#fff", borderRadius: "10px", padding: "1px 8px", fontSize: "11px", fontWeight: "700" }}>
                {pendingTaskCount} pending task{pendingTaskCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <button onClick={load} style={btnStyle("#1a1a1a")}>Refresh</button>
      </div>

      {loading && <div style={{ color: "#666", fontSize: "14px" }}>Loading...</div>}
      {!loading && leads.length === 0 && (
        <div style={{ color: "#888", fontSize: "14px", padding: "40px 0", textAlign: "center" }}>No warm or hot leads yet.</div>
      )}

      {!selectedContact && !loading && leads.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button style={filterBtn("all")}  onClick={() => setFilter("all")}>All ({leads.length})</button>
            <button style={filterBtn("hot")}  onClick={() => setFilter("hot")}>HOT ({hotCount})</button>
            <button style={filterBtn("warm")} onClick={() => setFilter("warm")}>Warm ({warmCount})</button>
          </div>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: "10px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  {["Status", "Name", "Contact", "City", "Last Activity", "Tasks", "Funnel Progress", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: "600", fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((lead, i) => {
                  const lastAct      = getLastActivity(lead.id, activity);
                  const furthest     = getFurthestStep(lead.id, funnelEvents);
                  const pendingTasks = getPendingTasks(lead.id, tasks);
                  const isHot        = lead.lead_status === "hot";

                  return (
                    <tr key={lead.id} style={{ borderBottom: i < displayed.length - 1 ? "1px solid #eee" : "none", background: isHot ? "#fffbf0" : "#fff" }}>

                      {/* Status */}
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", background: isHot ? "#ef4444" : "#f59e0b", color: "#fff" }}>
                          {isHot ? "HOT" : "WARM"}
                        </span>
                      </td>

                      {/* Name */}
                      <td style={{ padding: "12px 14px" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedContact({
                            id: lead.id,
                            name: lead.name ?? "",
                            email: lead.email ?? "",
                            phone: lead.phone ?? null,
                            company: null,
                            business_city: lead.business_city ?? null,
                            state_slug: null,
                            current_tier: lead.current_tier ?? null,
                            review_stars_rating: null,
                            num_total_reviews: null,
                            canonical_slug: null,
                          })}
                          style={{ fontWeight: "600", color: "#1a1a1a", textDecoration: "none", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                        >
                          {lead.name}
                        </button>
                        <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{lead.email}</div>
                      </td>

                      {/* Contact (phone plain text + email) */}
                      <td style={{ padding: "12px 14px" }}>
                        {lead.phone
                          ? <span style={{ display: "block", color: "#1a1a1a", fontWeight: "600", fontSize: "13px" }}>{lead.phone}</span>
                          : <span style={{ color: "#bbb", fontSize: "12px" }}>No phone</span>}
                        {lead.email && (
                          <button onClick={() => openSendModal(lead)}
                            style={{ marginTop: "4px", background: "none", border: "none", padding: 0, color: "#6366f1", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>
                            Send email
                          </button>
                        )}
                      </td>

                      {/* City */}
                      <td style={{ padding: "12px 14px", color: "#555" }}>{lead.business_city || ""}</td>

                      {/* Last Activity */}
                      <td style={{ padding: "12px 14px" }}>
                        {lastAct ? (
                          <>
                            <div style={{ fontWeight: "500", color: isHot ? "#ef4444" : "#555" }}>
                              {lastAct.event_type === "email_click" ? "Clicked link" : "Opened email"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{relativeTime(lastAct.created_at)}</div>
                          </>
                        ) : <span style={{ color: "#bbb" }}>No activity</span>}
                      </td>

                      {/* Tasks */}
                      <td style={{ padding: "12px 14px", minWidth: "180px" }}>
                        {pendingTasks.length === 0
                          ? <span style={{ color: "#bbb", fontSize: "12px" }}>No tasks</span>
                          : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              {pendingTasks.map(task => {
                                const badge = taskBadge[task.task_type] ?? { bg: "#6366f1", label: task.task_type };
                                return (
                                  <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                    <span style={{ background: badge.bg, color: "#fff", borderRadius: "4px", padding: "1px 6px", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap", marginTop: "1px" }}>
                                      {badge.label}
                                    </span>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: "12px", fontWeight: "500", lineHeight: "1.3" }}>{(task.title || "").replace("Follow up: ", "")}</div>
                                      <div style={{ fontSize: "10px", color: "#999", marginTop: "1px" }}>{relativeTime(task.created_at)}</div>
                                    </div>
                                    <button onClick={() => markTaskDone(task.id)} disabled={completingTask === task.id}
                                      style={{ background: "none", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", padding: "2px 6px", fontSize: "10px", color: "#059669", whiteSpace: "nowrap" }}>
                                      {completingTask === task.id ? "..." : "Done"}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                      </td>

                      {/* Funnel Progress */}
                      <td style={{ padding: "12px 14px" }}>
                        {furthest ? (
                          <>
                            <div style={{ fontWeight: "500", color: "#059669" }}>{FUNNEL_STEPS[furthest.event_name]?.label ?? furthest.event_name}</div>
                            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{relativeTime(furthest.created_at)}</div>
                          </>
                        ) : <span style={{ color: "#bbb" }}>Not entered</span>}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "12px 14px" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedContact({
                            id: lead.id,
                            name: lead.name ?? "",
                            email: lead.email ?? "",
                            phone: lead.phone ?? null,
                            company: null,
                            business_city: lead.business_city ?? null,
                            state_slug: null,
                            current_tier: lead.current_tier ?? null,
                            review_stars_rating: null,
                            num_total_reviews: null,
                            canonical_slug: null,
                          })}
                          style={btnStyle("#1a1a1a")}
                        >
                          Contact
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
