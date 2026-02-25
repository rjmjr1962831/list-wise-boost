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

export default function HotLeadsPanel() {
  const [leads, setLeads] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [funnelEvents, setFunnelEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);

    const { data: pros } = await supabase
      .from("professionals")
      .select("id, name, email, phone, business_city, lead_status, current_tier, magic_link")
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

    const [{ data: activityData }, { data: funnelData }] = await Promise.all([
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
    ]);

    setLeads(pros);
    setActivity(activityData ?? []);
    setFunnelEvents(funnelData ?? []);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const s: React.CSSProperties = {
    fontFamily: "system-ui, sans-serif",
    padding: "24px",
    maxWidth: "1200px",
    margin: "0 auto",
    color: "#1a1a1a",
  };

  const hotBadge = {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  };

  return (
    <div style={s}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px" }}>Hot Leads</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
            Last refresh: {lastRefresh.toLocaleTimeString()} &middot; Auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={load}
          style={{ padding: "8px 16px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
        >
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
          <div style={{ marginBottom: "12px", fontSize: "13px", color: "#666" }}>
            {leads.filter(l => l.lead_status === "hot").length} hot &middot; {leads.filter(l => l.lead_status === "warm").length} warm
          </div>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: "10px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  {["Status", "Name", "Phone", "City", "Last Activity", "Funnel Progress", ""].map(h => (
                    <th key={h} style={{
                      padding: "10px 14px", textAlign: "left", fontWeight: "600",
                      fontSize: "11px", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => {
                  const lastAct = getLastActivity(lead.id, activity);
                  const furthest = getFurthestStep(lead.id, funnelEvents);
                  const isHot = lead.lead_status === "hot";

                  return (
                    <tr key={lead.id} style={{ borderBottom: i < leads.length - 1 ? "1px solid #eee" : "none", background: isHot ? "#fffbf0" : "#fff" }}>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{
                          ...hotBadge,
                          background: isHot ? "#ef4444" : "#f59e0b",
                          color: "#fff",
                        }}>
                          {isHot ? "HOT" : "WARM"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: "600" }}>{lead.name}</div>
                        <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>{lead.email}</div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {lead.phone ? (
                          <a href={`tel:${lead.phone}`} style={{ color: "#1a1a1a", textDecoration: "none", fontWeight: "500" }}>
                            {lead.phone}
                          </a>
                        ) : (
                          <span style={{ color: "#bbb" }}>No phone</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#555" }}>
                        {lead.business_city || ""}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {lastAct ? (
                          <>
                            <div style={{ fontWeight: "500", color: isHot ? "#ef4444" : "#555" }}>
                              {lastAct.event_type === "email_click" ? "Clicked link" : "Opened email"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                              {relativeTime(lastAct.created_at)}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: "#bbb" }}>No activity</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {furthest ? (
                          <>
                            <div style={{ fontWeight: "500", color: "#059669" }}>
                              {FUNNEL_STEPS[furthest.event_name]?.label ?? furthest.event_name}
                            </div>
                            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                              {relativeTime(furthest.created_at)}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: "#bbb" }}>Not entered</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {lead.magic_link && (
                          <a
                            href={lead.magic_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "5px 12px", background: "#1a1a1a", color: "#fff",
                              borderRadius: "5px", textDecoration: "none", fontSize: "12px", whiteSpace: "nowrap",
                            }}
                          >
                            Open funnel
                          </a>
                        )}
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
