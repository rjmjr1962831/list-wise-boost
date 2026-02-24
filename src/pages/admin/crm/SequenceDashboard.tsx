import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SequenceStats {
  sequence_id: string;
  name: string;
  enrolled: number;
  sent: number;
  opens: number;
  clicks: number;
  replies: number;
  unsubscribed: number;
}

interface RecentEmail {
  id: string;
  to_address: string;
  subject: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  account_email: string;
}

export default function SequenceDashboard() {
  const [sequences, setSequences] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("3bed1ae8-61d9-49d8-8349-610e738c47d2");
  const [stats, setStats] = useState<SequenceStats | null>(null);
  const [recentEmails, setRecentEmails] = useState<RecentEmail[]>([]);
  const [accountBreakdown, setAccountBreakdown] = useState<any[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const loadSequences = useCallback(async () => {
    const { data } = await supabase
      .from("crm_sequences")
      .select("id, name, status, created_at")
      .order("created_at", { ascending: false });
    setSequences(data ?? []);
  }, []);

  const loadStats = useCallback(async (seqId: string) => {
    // Enrollments count
    const { count: enrolled } = await supabase
      .from("crm_sequence_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("sequence_id", seqId);

    // Sent emails for this sequence (via crm_emails joined through enrollment)
    // We tag emails with sequence info via account + timing — use crm_emails joined on enrollment email match
    const { data: enrollmentEmails } = await supabase
      .from("crm_sequence_enrollments")
      .select("email, assigned_account, status, replied_at")
      .eq("sequence_id", seqId);

    const emailSet = new Set((enrollmentEmails ?? []).map(e => e.email));
    const repliedCount = (enrollmentEmails ?? []).filter(e => e.replied_at).length;
    const unsubCount = (enrollmentEmails ?? []).filter(e => e.status === "unsubscribed").length;

    // Get sent/open/click counts for enrolled emails
    // Fetch crm_emails for these recipient addresses
    const emailList = Array.from(emailSet).slice(0, 1000);
    let sent = 0, opens = 0, clicks = 0;
    const recentRows: RecentEmail[] = [];
    const acctMap: Record<string, { sent: number; opens: number; clicks: number }> = {};

    if (emailList.length > 0) {
      // Query in batches of 100
      for (let i = 0; i < emailList.length; i += 100) {
        const batch = emailList.slice(i, i + 100);
        const { data: emails } = await supabase
          .from("crm_emails")
          .select("id, to_address, subject, sent_at, opened_at, clicked_at, account_email")
          .in("to_address", batch)
          .eq("direction", "outbound")
          .order("sent_at", { ascending: false });

        for (const e of emails ?? []) {
          sent++;
          if (e.opened_at) opens++;
          if (e.clicked_at) clicks++;
          const acct = e.account_email || "unknown";
          if (!acctMap[acct]) acctMap[acct] = { sent: 0, opens: 0, clicks: 0 };
          acctMap[acct].sent++;
          if (e.opened_at) acctMap[acct].opens++;
          if (e.clicked_at) acctMap[acct].clicks++;
          if (recentRows.length < 50) recentRows.push(e);
        }
      }
    }

    const seqName = sequences.find(s => s.id === seqId)?.name ?? seqId;

    setStats({
      sequence_id: seqId,
      name: seqName,
      enrolled: enrolled ?? 0,
      sent,
      opens,
      clicks,
      replies: repliedCount,
      unsubscribed: unsubCount,
    });

    setRecentEmails(recentRows.slice(0, 30));

    setAccountBreakdown(
      Object.entries(acctMap).map(([acct, data]) => ({
        account: acct,
        ...data,
        open_rate: data.sent > 0 ? ((data.opens / data.sent) * 100).toFixed(1) + "%" : "—",
        click_rate: data.sent > 0 ? ((data.clicks / data.sent) * 100).toFixed(1) + "%" : "—",
      }))
    );

    setLastRefresh(new Date());
    setLoading(false);
  }, [sequences]);

  useEffect(() => { loadSequences(); }, [loadSequences]);
  useEffect(() => {
    if (selected && sequences.length > 0) {
      setLoading(true);
      loadStats(selected);
    }
  }, [selected, sequences]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (selected && sequences.length > 0) loadStats(selected);
    }, 30000);
    return () => clearInterval(interval);
  }, [selected, sequences, loadStats]);

  const pct = (num: number, den: number) =>
    den > 0 ? ((num / den) * 100).toFixed(1) + "%" : "—";

  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "24px", maxWidth: "1100px", margin: "0 auto", color: "#1a1a1a" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "700", margin: "0 0 4px" }}>Sequence Dashboard</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#666" }}>
            Last refresh: {lastRefresh.toLocaleTimeString()} &nbsp;·&nbsp; Auto-refreshes every 30s
          </p>
        </div>
        <button
          onClick={() => loadStats(selected)}
          style={{ padding: "8px 16px", background: "#1a1a1a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
          Refresh Now
        </button>
      </div>

      {/* Sequence selector */}
      <div style={{ marginBottom: "24px" }}>
        <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "6px" }}>Sequence</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", fontSize: "14px", width: "100%", maxWidth: "500px" }}>
          {sequences.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading && <div style={{ color: "#666", fontSize: "14px" }}>Loading...</div>}

      {!loading && stats && (
        <>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", marginBottom: "28px" }}>
            {[
              { label: "Enrolled", value: stats.enrolled, sub: null },
              { label: "Sent", value: stats.sent, sub: null },
              { label: "Opens", value: stats.opens, sub: pct(stats.opens, stats.sent) },
              { label: "Clicks", value: stats.clicks, sub: pct(stats.clicks, stats.sent) },
              { label: "Replies", value: stats.replies, sub: pct(stats.replies, stats.sent) },
              { label: "Unsubs", value: stats.unsubscribed, sub: pct(stats.unsubscribed, stats.sent) },
            ].map(card => (
              <div key={card.label} style={{
                background: "#f9f9f9", border: "1px solid #e5e5e5", borderRadius: "10px",
                padding: "16px", textAlign: "center"
              }}>
                <div style={{ fontSize: "28px", fontWeight: "700", lineHeight: 1 }}>{card.value}</div>
                {card.sub && <div style={{ fontSize: "14px", color: "#059669", fontWeight: "600", marginTop: "4px" }}>{card.sub}</div>}
                <div style={{ fontSize: "12px", color: "#888", marginTop: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
              <span style={{ fontWeight: "600" }}>Send Progress</span>
              <span style={{ color: "#666" }}>{stats.sent} / {stats.enrolled} ({pct(stats.sent, stats.enrolled)})</span>
            </div>
            <div style={{ height: "10px", background: "#e5e5e5", borderRadius: "5px", overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "#1a1a1a", borderRadius: "5px",
                width: `${stats.enrolled > 0 ? (stats.sent / stats.enrolled) * 100 : 0}%`,
                transition: "width 0.5s ease"
              }} />
            </div>
          </div>

          {/* Account breakdown */}
          {accountBreakdown.length > 0 && (
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 12px" }}>By Account</h2>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f5f5f5" }}>
                    {["Account", "Sent", "Opens", "Open %", "Clicks", "Click %"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: "600", fontSize: "12px", color: "#555", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accountBreakdown.map(row => (
                    <tr key={row.account} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "13px" }}>{row.account}</td>
                      <td style={{ padding: "10px 12px" }}>{row.sent}</td>
                      <td style={{ padding: "10px 12px" }}>{row.opens}</td>
                      <td style={{ padding: "10px 12px", color: "#059669", fontWeight: "600" }}>{row.open_rate}</td>
                      <td style={{ padding: "10px 12px" }}>{row.clicks}</td>
                      <td style={{ padding: "10px 12px", color: "#059669", fontWeight: "600" }}>{row.click_rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent sends */}
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 12px" }}>Recent Sends</h2>
            {recentEmails.length === 0
              ? <p style={{ color: "#888", fontSize: "14px" }}>No emails sent yet. Processor runs every 5 minutes.</p>
              : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      {["Recipient", "From", "Sent", "Opened", "Clicked"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: "600", fontSize: "12px", color: "#555", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentEmails.map(e => (
                      <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "9px 12px" }}>{e.to_address}</td>
                        <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: "12px", color: "#666" }}>
                          {e.account_email?.split("@")[0]}@...
                        </td>
                        <td style={{ padding: "9px 12px", color: "#666" }}>{fmt(e.sent_at)}</td>
                        <td style={{ padding: "9px 12px" }}>
                          {e.opened_at
                            ? <span style={{ color: "#059669", fontWeight: "600" }}>✓ {fmt(e.opened_at)}</span>
                            : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          {e.clicked_at
                            ? <span style={{ color: "#2563eb", fontWeight: "600" }}>✓ {fmt(e.clicked_at)}</span>
                            : <span style={{ color: "#ccc" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </>
      )}
    </div>
  );
}
