import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { RefreshCw, Send, Mail, Inbox, ArrowLeft, ChevronDown, Plus, Trash2, Save } from "lucide-react";

interface Email {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  account_email: string;
  direction: "inbound" | "outbound";
  from_address: string;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  contact_id: string | null;
  sent_at: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface ConnectedAccount {
  email: string;
  display_name: string | null;
}

interface Contact {
  id: string;
  full_name: string;
  email: string;
}

const TEMPLATE_VARS = [
  { key: "{{first_name}}", label: "First Name" },
  { key: "{{agent_name}}", label: "Full Name" },
  { key: "{{tier}}", label: "Tier" },
  { key: "{{city}}", label: "City" },
  { key: "{{profile_url}}", label: "Magic Link" },
  { key: "{{aifs_score}}", label: "AIFS Score" },
];

const BASE_URL = "https://www.top10lists.us";
function profileUrlForTier(professional: any | null): string {
  if (!professional?.verification_token) return professional?.profile_link || professional?.magic_link || BASE_URL;
  const tier = (professional?.current_tier || professional?.badge_tier || "listed").toLowerCase();
  const token = professional.verification_token;
  if (tier === "certified" || tier === "audited" || tier === "underwritten") {
    return professional?.magic_link?.includes("/dashboard/") ? professional.magic_link : `${BASE_URL}/dashboard/${token}`;
  }
  return `${BASE_URL}/funnel/${token}`;
}

function applyTemplate(text: string, contact: Contact | null, professional: any | null): string {
  const firstName = contact?.full_name?.split(" ")[0] || "";
  const profileUrl = profileUrlForTier(professional);
  return text
    .replace(/{{first_name}}/g, firstName)
    .replace(/{{agent_name}}/g, contact?.full_name || "")
    .replace(/{{tier}}/g, professional?.current_tier || professional?.badge_tier || "")
    .replace(/{{city}}/g, professional?.business_city || "")
    .replace(/{{profile_url}}/g, profileUrl)
    .replace(/{{aifs_score}}/g, professional?.certified_projected_signal || professional?.signal_score || "");
}

export const EmailManager = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadEmails, setThreadEmails] = useState<Email[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [professional, setProfessional] = useState<any | null>(null);
  const [filter, setFilter] = useState<"all" | "inbound" | "outbound">("inbound");
  const [search, setSearch] = useState("");
  const [activeAccounts, setActiveAccounts] = useState<Set<string>>(new Set());

  // Compose state
  const [composing, setComposing] = useState(false);
  const [fromAccount, setFromAccount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sending, setSending] = useState(false);

  // Template management
  const [managingTemplates, setManagingTemplates] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [newTplName, setNewTplName] = useState("");
  const [newTplSubject, setNewTplSubject] = useState("");
  const [newTplBody, setNewTplBody] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!composing || !toAddress || !toAddress.includes("@")) return;
    const email = toAddress.trim().toLowerCase();
    if (!email) return;
    supabase.from("professionals").select("*").ilike("email", email).limit(1).maybeSingle().then(({ data }) => {
      setProfessional(data || null);
    });
  }, [composing, toAddress]);

  const loadAll = async () => {
    setLoading(true);
    const [emailsRes, templatesRes, accountsRes] = await Promise.all([
      supabase.from("crm_emails").select("*").order("sent_at", { ascending: false }).limit(200),
      supabase.from("crm_email_templates").select("*").order("name"),
      supabase.from("crm_email_accounts").select("email, display_name"),
    ]);
    setEmails(emailsRes.data || []);
    setTemplates(templatesRes.data || []);
    setAccounts(accountsRes.data || []);
    if (accountsRes.data?.length) setFromAccount(accountsRes.data[0].email);
    // Initialize active account filter with all connected accounts
    if (accountsRes.data?.length && activeAccounts.size === 0) {
      setActiveAccounts(new Set(accountsRes.data.map((a: any) => a.email)));
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-sync");
      if (error) throw error;
      const total = data?.results?.reduce((s: number, r: any) => s + (r.synced || 0), 0) || 0;
      toast.success(`Synced ${total} new message${total !== 1 ? "s" : ""}`);
      await loadAll();
    } catch (e: any) {
      toast.error("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectAccount = (email: string) => {
    window.open(
      `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/gmail-oauth-callback?account=${encodeURIComponent(email)}`,
      "_blank",
      "width=600,height=700"
    );
  };

  const openThread = async (threadId: string, firstEmail: Email) => {
    setSelectedThread(threadId);
    const thread = emails.filter(e => e.gmail_thread_id === threadId)
      .sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
    setThreadEmails(thread);

    // Load contact
    if (firstEmail.contact_id) {
      const { data } = await supabase.from("contacts").select("*").eq("id", firstEmail.contact_id).single();
      setContact(data);
      if (data) {
        const { data: pro } = await supabase.from("professionals").select("*").ilike("name", `%${data.full_name}%`).limit(1).single();
        setProfessional(pro || null);
      }
    } else {
      setContact(null);
      setProfessional(null);
    }

    // Pre-fill reply - skip bounce notifications and find actual contact
    const last = thread[thread.length - 1];
    let replyTo = "";
    const bounceSenders = ["mailer-daemon@googlemail.com", "postmaster@", "mailer-daemon@"];
    const isBounce = bounceSenders.some(b => last.from_address.toLowerCase().includes(b));
    if (isBounce) {
      // Find the last outbound email in thread to get the original recipient
      const lastOutbound = [...thread].reverse().find(e => e.direction === "outbound");
      replyTo = lastOutbound ? lastOutbound.to_address : "";
    } else {
      replyTo = last.direction === "inbound" ? (last.from_address.match(/<(.+)>/)?.[1] || last.from_address) : last.to_address;
    }
    setToAddress(replyTo);
    setSubject(last.subject?.startsWith("Re:") ? (last.subject || "") : `Re: ${last.subject || ""}`);
    setFromAccount(firstEmail.account_email || (accounts[0]?.email ?? ""));
    setMessageBody("");
    setComposing(true);
  };

  const handleTemplateSelect = (templateId: string) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplate(templateId);
    setSubject(applyTemplate(tpl.subject, contact, professional));
    setMessageBody(applyTemplate(tpl.body, contact, professional));
  };

  const handleSend = async () => {
    if (!fromAccount || !toAddress || !subject || !messageBody) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    try {
      const last = threadEmails[threadEmails.length - 1];
      const { data, error } = await supabase.functions.invoke("gmail-send", {
        body: {
          from_account: fromAccount,
          to: toAddress,
          subject,
          message_body: messageBody,
          thread_id: selectedThread || undefined,
          contact_id: contact?.id || undefined,
        },
      });
      if (error) throw error;
      toast.success("Email sent");
      setMessageBody("");
      setSelectedTemplate("");
      await loadAll();
    } catch (e: any) {
      let msg = e?.message ?? "Unknown error";
      if (e?.context && typeof e.context.json === "function") {
        try {
          const body = await e.context.json();
          if (body?.error) msg = body.error;
        } catch (_) {}
      }
      toast.error("Failed to send: " + msg);
    } finally {
      setSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTplName || !newTplSubject || !newTplBody) { toast.error("Fill in all template fields"); return; }
    setSavingTpl(true);
    if (editTemplate) {
      await supabase.from("crm_email_templates").update({ name: newTplName, subject: newTplSubject, body: newTplBody, updated_at: new Date().toISOString() }).eq("id", editTemplate.id);
      toast.success("Template updated");
    } else {
      await supabase.from("crm_email_templates").insert({ name: newTplName, subject: newTplSubject, body: newTplBody });
      toast.success("Template saved");
    }
    setEditTemplate(null); setNewTplName(""); setNewTplSubject(""); setNewTplBody("");
    setSavingTpl(false);
    await loadAll();
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from("crm_email_templates").delete().eq("id", id);
    toast.success("Template deleted");
    await loadAll();
  };

  // Deduplicate by thread, show most recent per thread
  const threads = Object.values(
    emails.reduce((acc: Record<string, Email>, e) => {
      if (!acc[e.gmail_thread_id] || new Date(e.sent_at) > new Date(acc[e.gmail_thread_id].sent_at)) {
        acc[e.gmail_thread_id] = e;
      }
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

  const filtered = threads.filter(e => {
    if (filter === "inbound" && e.direction !== "inbound") return false;
    if (filter === "outbound" && e.direction !== "outbound") return false;
    // Filter by active accounts
    if (activeAccounts.size > 0) {
      const matchesAccount = activeAccounts.has(e.account_email) ||
        activeAccounts.has(e.from_address) || activeAccounts.has(e.to_address);
      if (!matchesAccount) return false;
    }
    const q = search.toLowerCase();
    if (q && !e.subject?.toLowerCase().includes(q) && !e.from_address.toLowerCase().includes(q) && !e.to_address.toLowerCase().includes(q)) return false;
    return true;
  });

  const MANAGED_ACCOUNTS = [
    "robert@top10lists.us",
    "hello@top10lists.us",
    "robert@toptenlists.us",
    "hello@toptenlists.us",
    "mark@toptenlists.us",
  ];

  if (managingTemplates) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => { setManagingTemplates(false); setEditTemplate(null); setNewTplName(""); setNewTplSubject(""); setNewTplBody(""); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Email
          </Button>
          <h2 className="font-semibold">Email Templates</h2>
        </div>

        {/* Template list */}
        <div className="space-y-2">
          {templates.map(tpl => (
            <Card key={tpl.id} className={editTemplate?.id === tpl.id ? "border-primary" : ""}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{tpl.name}</p>
                    <p className="text-xs text-muted-foreground truncate">Subject: {tpl.subject}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditTemplate(tpl); setNewTplName(tpl.name); setNewTplSubject(tpl.subject); setNewTplBody(tpl.body); }}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={() => handleDeleteTemplate(tpl.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit / New form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editTemplate ? "Edit Template" : "New Template"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1 mb-1">
              {TEMPLATE_VARS.map(v => (
                <button key={v.key} onClick={() => setNewTplBody(b => b + v.key)}
                  className="text-xs px-2 py-0.5 rounded border hover:bg-muted transition-colors">
                  {v.label}
                </button>
              ))}
            </div>
            <label htmlFor="tpl-name" className="sr-only">Template name</label>
            <Input id="tpl-name" name="template_name" placeholder="Template name" value={newTplName} onChange={e => setNewTplName(e.target.value)} />
            <label htmlFor="tpl-subject" className="sr-only">Subject line</label>
            <Input id="tpl-subject" name="template_subject" placeholder="Subject line" value={newTplSubject} onChange={e => setNewTplSubject(e.target.value)} />
            <label htmlFor="tpl-body" className="sr-only">Email body</label>
            <Textarea id="tpl-body" name="template_body" placeholder="Email body" className="min-h-[160px] font-mono text-sm" value={newTplBody} onChange={e => setNewTplBody(e.target.value)} />
            <div className="flex gap-2">
              {editTemplate && <Button variant="outline" size="sm" onClick={() => { setEditTemplate(null); setNewTplName(""); setNewTplSubject(""); setNewTplBody(""); }}>Cancel</Button>}
              <Button size="sm" onClick={handleSaveTemplate} disabled={savingTpl}>
                <Save className="h-3 w-3 mr-1" />{editTemplate ? "Update" : "Save Template"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSelectedThread(null); setComposing(true); setToAddress(""); setSubject(""); setMessageBody(""); setSelectedTemplate(""); }}>
            <Plus className="h-4 w-4 mr-1" />Compose
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManagingTemplates(true)}>
            Templates
          </Button>
        </div>

        {/* Account connection status */}
        <div className="flex flex-wrap gap-1">
          {MANAGED_ACCOUNTS.map(acct => {
            const connected = accounts.some(a => a.email === acct);
            const active = activeAccounts.has(acct);
            return (
              <button key={acct} onClick={() => {
                if (!connected) { handleConnectAccount(acct); return; }
                const next = new Set(activeAccounts);
                if (active) next.delete(acct); else next.add(acct);
                setActiveAccounts(next);
              }}
                className={`text-xs px-2 py-1 rounded-full border transition-colors cursor-pointer ${
                  !connected ? "bg-muted hover:bg-muted/80" :
                  active ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100" :
                  "bg-muted border-muted-foreground/30 text-muted-foreground hover:bg-muted/80 line-through"
                }`}>
                {!connected ? "+" : active ? "✓" : "○"} {acct}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <label htmlFor="email-search" className="sr-only">Search emails</label>
        <Input id="email-search" name="search" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs text-sm h-8" />
        {(["all", "inbound", "outbound"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {f}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${selectedThread ? "lg:grid-cols-2" : ""}`}>
        {/* Thread list */}
        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>}
          {!loading && accounts.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No accounts connected</p>
                <p className="text-xs text-muted-foreground mb-4">Click the + button next to each address above to connect your mailboxes.</p>
              </CardContent>
            </Card>
          )}
          {!loading && accounts.length > 0 && filtered.length === 0 && (
            <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No emails found. Click Sync Now to fetch your latest mail.</CardContent></Card>
          )}
          {filtered.map(email => {
            const isSelected = selectedThread === email.gmail_thread_id;
            const threadCount = emails.filter(e => e.gmail_thread_id === email.gmail_thread_id).length;
            return (
              <Card key={email.gmail_thread_id} className={`cursor-pointer transition-colors hover:border-primary/50 ${isSelected ? "border-primary ring-1 ring-primary/20" : ""}`}
                onClick={() => openThread(email.gmail_thread_id, email)}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium truncate">
                          {email.direction === "inbound" ? email.from_address : `To: ${email.to_address}`}
                        </p>
                        {threadCount > 1 && <span className="text-xs text-muted-foreground shrink-0">({threadCount})</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{email.subject || "(no subject)"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{email.account_email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{format(new Date(email.sent_at), "MMM d")}</p>
                      <Badge variant={email.direction === "inbound" ? "outline" : "secondary"} className="text-[10px] mt-1">
                        {email.direction === "inbound" ? <Inbox className="h-2.5 w-2.5 mr-0.5" /> : <Send className="h-2.5 w-2.5 mr-0.5" />}
                        {email.direction}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Thread detail + reply */}
        {selectedThread && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedThread(null); setComposing(false); }}>
                <ArrowLeft className="h-4 w-4 mr-1" />Back
              </Button>
              {contact && (
                <div className="text-xs text-muted-foreground">
                  Contact: <span className="font-medium">{contact.full_name}</span>
                </div>
              )}
            </div>

            {/* Thread messages */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {threadEmails.map(e => (
                <Card key={e.id} className={e.direction === "outbound" ? "border-primary/20 bg-primary/5" : ""}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium">{e.direction === "outbound" ? `From: ${e.from_address}` : `From: ${e.from_address}`}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(e.sent_at), "MMM d, h:mm a")}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">To: {e.to_address}</p>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {e.body_html
                        ? <div dangerouslySetInnerHTML={{ __html: e.body_html }} className="prose prose-sm max-w-none" />
                        : e.body_text || "(no content)"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Reply compose */}
            {composing && (
              <Card className="border-primary/30">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm">Reply</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Template selector */}
                  {templates.length > 0 && (
                    <div>
                      <label htmlFor="reply-template" className="text-xs text-muted-foreground mb-1 block">Use template</label>
                      <select id="reply-template" name="template" className="w-full text-sm border rounded-md px-2 py-1.5 bg-background"
                        value={selectedTemplate} onChange={e => handleTemplateSelect(e.target.value)}>
                        <option value="">Select a template...</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="reply-from" className="text-xs text-muted-foreground mb-1 block">From</label>
                    <select id="reply-from" name="from" className="w-full text-sm border rounded-md px-2 py-1.5 bg-background"
                      value={fromAccount} onChange={e => setFromAccount(e.target.value)}>
                      {accounts.map(a => <option key={a.email} value={a.email}>{a.display_name ? `${a.display_name} <${a.email}>` : a.email}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reply-to" className="text-xs text-muted-foreground mb-1 block">To</label>
                    <Input id="reply-to" name="to" className="text-sm h-8" value={toAddress} onChange={e => setToAddress(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="reply-subject" className="text-xs text-muted-foreground mb-1 block">Subject</label>
                    <Input id="reply-subject" name="subject" className="text-sm h-8" value={subject} onChange={e => setSubject(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="reply-message" className="text-xs text-muted-foreground">Message</label>
                      <div className="flex flex-wrap gap-1">
                        {TEMPLATE_VARS.map(v => (
                          <button key={v.key} onClick={() => setMessageBody(b => b + v.key)}
                            className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-muted transition-colors">
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea id="reply-message" name="message" className="min-h-[120px] text-sm font-mono" value={messageBody} onChange={e => setMessageBody(e.target.value)} placeholder="Write your reply..." />
                  </div>
                  <Button className="w-full" onClick={handleSend} disabled={sending}>
                    <Send className="h-4 w-4 mr-2" />{sending ? "Sending..." : "Send"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Standalone compose (not a reply) */}
        {composing && !selectedThread && (
          <Card className="border-primary/30">
            <CardHeader className="pb-2 pt-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">New Email</CardTitle>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setComposing(false)}>Cancel</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.length > 0 && (
                <div>
                  <label htmlFor="new-template" className="text-xs text-muted-foreground mb-1 block">Use template</label>
                  <select id="new-template" name="template" className="w-full text-sm border rounded-md px-2 py-1.5 bg-background"
                    value={selectedTemplate} onChange={e => handleTemplateSelect(e.target.value)}>
                    <option value="">Select a template...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="new-from" className="text-xs text-muted-foreground mb-1 block">From</label>
                <select id="new-from" name="from" className="w-full text-sm border rounded-md px-2 py-1.5 bg-background"
                  value={fromAccount} onChange={e => setFromAccount(e.target.value)}>
                  {accounts.map(a => <option key={a.email} value={a.email}>{a.display_name ? `${a.display_name} <${a.email}>` : a.email}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="new-to" className="text-xs text-muted-foreground mb-1 block">To</label>
                <Input id="new-to" name="to" placeholder="To" className="text-sm h-8" value={toAddress} onChange={e => setToAddress(e.target.value)} />
              </div>
              <div>
                <label htmlFor="new-subject" className="text-xs text-muted-foreground mb-1 block">Subject</label>
                <Input id="new-subject" name="subject" placeholder="Subject" className="text-sm h-8" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  <label htmlFor="new-message" className="text-xs text-muted-foreground">Message</label>
                  {TEMPLATE_VARS.map(v => (
                    <button key={v.key} onClick={() => setMessageBody(b => b + v.key)}
                      className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-muted transition-colors">
                      {v.label}
                    </button>
                  ))}
                </div>
                <Textarea id="new-message" name="message" className="min-h-[140px] text-sm font-mono" value={messageBody} onChange={e => setMessageBody(e.target.value)} placeholder="Write your message..." />
              </div>
              <Button className="w-full" onClick={handleSend} disabled={sending}>
                <Send className="h-4 w-4 mr-2" />{sending ? "Sending..." : "Send"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
