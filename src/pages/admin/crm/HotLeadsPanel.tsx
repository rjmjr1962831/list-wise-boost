import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const FUNNEL_STEPS: Record<string, { label: string; order: number }> = {
  funnel_started:         { label: "Opened funnel",         order: 1 },
  step0_viewed:           { label: "Viewed intro",           order: 2 },
  step0_completed:        { label: "Completed intro",        order: 3 },
  accuracy_review_viewed: { label: "Reviewing profile",      order: 4 },
  accuracy_confirmed:     { label: "Profile confirmed",      order: 5 },
  profile_edit_viewed:    { label: "Viewing edits",          order: 6 },
  profile_edited:         { label: "Edited profile",         order: 7 },
  profile_verified:       { label: "Profile verified",      order: 8 },
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
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getFurthestStep(agentId: string, events: any[]) {
  const agentEvents = events.filter(e => e.professional_id === agentId);
  if (!agentEvents.length) return null;
  const ranked = agentEvents
    .filter(e => FUNNEL_STEPS[e.event_name])
    .sort((a, b) => FUNNEL_STEPS[b.event_name].order - FUNNEL_STEPS[a.event_name].order);
  return ranked[0] ?? null;
}

function getLastActivity(agentId: string, activity: any[]) {
  return activity.find(a => a.professional_id === agentId) ?? null;
}

function getPendingTasks(agentId: string, tasks: any[]) {
  return tasks.filter(t => t.professional_id === agentId && t.status === "pending");
}

export default function HotLeadsPanel() {
  const [leads, setLeads] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [funnelEvents, setFunnelEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "hot" | "warm">("all");
  const [completingTask, setCompletingTask] = useState<string | null>(null);

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

    const [{ data: activityData }, { data: funnelData }, { data: taskData }] = await Promise.all([
      supabase
        .from("crm_contact_activity")
        .select("professional_id, event_type, created_at, link_url, sequence_name")
        .in("professional_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("funnel_events")
        .select("professional_id, event_name, created_at")
        .in("professional_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_tasks")
        .select("id, professional_id, task_type, title, description, status, priority, created_at")
        .in("professional_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    setLeads(pros);
    setActivity(activityData ?? []);
    setFunnelEvents(funnelData ?? []);
    setTasks(taskData ?? []);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  async function markTaskDone(taskId: string) {
    setCompletingTask(taskId);
    await supabase
      .from("crm_tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "completed" } : t));
    setCompletingTask(null);
  }

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const displayed = leads.filter(l => filter === "all" ? true : l.lead_status === filter);
  const hotCount  = leads.filter(l => l.lead_status === "hot").length;
  const warmCount = leads.filter(l => l.lead_status === "warm").length;
  const pendingTaskCount = tasks.filter(t => t.status === "pending").length;

  const hotBadge = {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };

  const taskTypeBadge: Record<string, { bg: string; label: string }> = {
    email_clicked: { bg: "#ef4444", label: "Clicked" },
    email_opened:  { bg: "#f59e0b", label: "Opened" },
    email_bounced: { bg: "#6b7280", label: "Bounced" },
  };

  const filterBtn = (val: "all" | "hot" | "warm", label: string) => ({
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid",
    fontSize: "13px",
    fontWeight: "500" as const,
    cursor: "pointer" as const,
    background: filter === val ? "#1a1a1a" : "#fff",
    color: filter === val ? "#fff" : "#555",
    borderColor: filter === val ? "#1a1a1a" : "#ddd",
  });

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "24px", maxWidth: "1400px", margin: "0 auto", color: "#1a1a1a" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px" }}>Hot Leads</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
            Last refresh: {lastRefresh.toLocaleTimeString()} &middot; Auto-refreshes every 30s
            {pendingTaskCount > 0 && (
              <span style={{ marginLeft: "12px", background: "#ef4444", color: "#fff", borderRadius: "10px", padding: "1px 8px", fontSize: "11px", fontWeight: "700" }}>
                {pendingTaskCount} pending task{pendingTaskCount !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <button onClick={load}
          style={{ padding: "8px 16px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
          Refresh
        </button>
      </div>

      {loading && <div style={{ color: "#666", fontSize: "14px" }}>Loading...</div>}

      {!loading && leads.length === 0 && (
        <div style={{ color: "#888", fontSize: "14px", padding: "40px 0", textAlign: "center" }}>
          No warm or hot leads yet. Keep sending.
        </div>
      )}

      {!loading && leads.length > 0 && (
        <>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "center" }}>
            <button style={filterBtn("all",  `All (${leads.length})`)}  onClick={() => setFilter("all")}>All ({leads.length})</button>
            <button style={filterBtn("hot",  `HOT (${hotCount})`)}      onClick={() => setFilter("hot")}>HOT ({hotCount})</button>
            <button style={filterBtn("warm", `Warm (${warmCount})`)}    onClick={() => setFilter("warm")}>Warm ({warmCount})</button>
          </div>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: "10px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  {["Status", "Name", "Phone", "City", "Last Activity", "Tasks", "Funnel Progress", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: "600", fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((lead, i) => {
                  const lastAct     = getLastActivity(lead.id, activity);
                  const furthest    = getFurthestStep(lead.id, funnelEvents);
                  const pendingTasks = getPendingTasks(lead.id, tasks);
                  const isHot       = lead.lead_status === "hot";
                  const profileUrl  = lead.verification_token
                    ? `https://staging.top10lists.us/funnel/${lead.verification_token}`
                    : null;

                  return (
                    <tr key={lead.id} style={{ borderBottom: i < displayed.length - 1 ? "1px solid #eee" : "none", background: isHot ? "#fffbf0" : "#fff" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ ...hotBadge, background: isHot ? "#ef4444" : "#f59e0b", color: "#fff" }}>
                          {isHot ? "HOT" : "WARM"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: "600" }}>{lead.name}</div>
                        <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{lead.email}</div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {lead.phone
                          ? <a href={`tel:${lead.phone}`} style={{ color: "#1a1a1a", textDecoration: "none", fontWeight: "600", fontSize: "14px" }}>{lead.phone}</a>
                          : <span style={{ color: "#bbb" }}>No phone</span>}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#555" }}>{lead.business_city || ""}</td>
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
                      <td style={{ padding: "12px 14px", minWidth: "200px" }}>
                        {pendingTasks.length === 0 ? (
                          <span style={{ color: "#bbb", fontSize: "12px" }}>No tasks</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {pendingTasks.map(task => {
                              const badge = taskTypeBadge[task.task_type] ?? { bg: "#6366f1", label: task.task_type };
                              return (
                                <div key={task.id} style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                  <span style={{ background: badge.bg, color: "#fff", borderRadius: "4px", padding: "1px 6px", fontSize: "10px", fontWeight: "700", whiteSpace: "nowrap", marginTop: "1px" }}>
                                    {badge.label}
                                  </span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: "12px", fontWeight: "500", lineHeight: "1.3" }}>{task.title.replace("Follow up: ", "")}</div>
                                    <div style={{ fontSize: "10px", color: "#999", marginTop: "1px" }}>{relativeTime(task.created_at)}</div>
                                  </div>
                                  <button
                                    onClick={() => markTaskDone(task.id)}
                                    disabled={completingTask === task.id}
                                    style={{ background: "none", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer", padding: "2px 6px", fontSize: "10px", color: "#059669", whiteSpace: "nowrap" }}>
                                    {completingTask === task.id ? "..." : "Done"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {furthest ? (
                          <>
                            <div style={{ fontWeight: "500", color: "#059669" }}>{FUNNEL_STEPS[furthest.event_name]?.label ?? furthest.event_name}</div>
                            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{relativeTime(furthest.created_at)}</div>
                          </>
                        ) : <span style={{ color: "#bbb" }}>Not entered</span>}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`}
                              style={{ padding: "5px 10px", background: "#059669", color: "#fff", borderRadius: "5px", textDecoration: "none", fontSize: "12px", whiteSpace: "nowrap" }}>
                              Call
                            </a>
                          )}
                          {profileUrl && (
                            <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                              style={{ padding: "5px 10px", background: "#1a1a1a", color: "#fff", borderRadius: "5px", textDecoration: "none", fontSize: "12px", whiteSpace: "nowrap" }}>
                              Contact
                            </a>
                          )}
                          {lead.magic_link && (
                            <a href={lead.magic_link} target="_blank" rel="noopener noreferrer"
                              style={{ padding: "5px 10px", background: "#6366f1", color: "#fff", borderRadius: "5px", textDecoration: "none", fontSize: "12px", whiteSpace: "nowrap" }}>
                              Funnel
                            </a>
                          )}
                        </div>
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
