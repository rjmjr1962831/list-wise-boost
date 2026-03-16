/**
 * List Maker: Build agent lists by criteria, define output fields, get count, refine, download CSV.
 * CSV is uploaded to Supabase storage; link is returned (staging use only).
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Download, RefreshCw, Users, Save, Trash2 } from "lucide-react";

export interface ListMakerCriteria {
  active?: boolean | "all"; // true=active only, false=inactive only, "all"=both
  state_slugs?: string[];
  current_tiers?: string[];
  min_rating?: number;
  email_verified?: boolean;
  has_license?: boolean;
}

export interface SavedListTemplate {
  id: string;
  name: string;
  criteria: ListMakerCriteria;
  savedAt: string;
}

const SAVED_LISTS_KEY = "top10-saved-list-templates";

export function getSavedListTemplates(): SavedListTemplate[] {
  try {
    const raw = localStorage.getItem(SAVED_LISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLists(lists: SavedListTemplate[]) {
  localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(lists));
}

const OUTPUT_FIELDS: { key: string; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "social_linkedin", label: "LinkedIn URL" },
  { key: "company", label: "Company / Brokerage" },
  { key: "canonical_slug", label: "Canonical Slug" },
  { key: "state_slug", label: "State Slug" },
  { key: "current_tier", label: "Current Tier" },
  { key: "magic_link", label: "Magic Link" },
  { key: "date_first_listed", label: "Date First Listed" },
  { key: "date_last_updated", label: "Date Last Updated" },
  { key: "zillow_profile_url", label: "Zillow URL" },
  { key: "city_name", label: "City Name" },
  { key: "created_at", label: "Created At" },
  { key: "updated_at", label: "Updated At" },
];

const LEGACY_AIFS_FIELDS: { key: string; label: string }[] = [
  { key: "aics_score_unlisted", label: "AIFS Score (Current)" },
  { key: "aics_score_listed", label: "AIFS Score (Listed)" },
  { key: "aics_score_certified", label: "AIFS Score (Certified)" },
  { key: "aics_score_audited", label: "AIFS Score (Audited)" },
  { key: "aics_score_underwritten", label: "AIFS Score (Underwritten)" },
  { key: "aics_lift_to_audited", label: "Lift to Audited" },
  { key: "aics_lift_to_underwritten", label: "Lift to Underwritten" },
  { key: "aics_most_recent_review_date", label: "Most Recent Review Date" },
  { key: "aics_gap_stale_reviews", label: "Gap: Stale Reviews" },
  { key: "aics_gap_no_linkedin", label: "Gap: No LinkedIn" },
  { key: "aics_gap_no_schema", label: "Gap: No Schema" },
  { key: "aics_gap_no_personal_site", label: "Gap: No Personal Site" },
  { key: "aics_gap_no_realtor", label: "Gap: No Realtor" },
  { key: "aics_gap_no_press", label: "Gap: No Press" },
  { key: "aics_artifact_url", label: "Artifact URL" },
  { key: "footprint_band", label: "Footprint Band" },
  { key: "footprint_context", label: "Footprint Context" },
];

const AIFS_FIELDS: { key: string; label: string }[] = [
  { key: "aifs_score", label: "AIFS Score" },
  { key: "aifs_band", label: "AIFS Band" },
  { key: "aifs_serp_knowledge_graph", label: "AIFS: Knowledge Graph" },
  { key: "aifs_serp_sitelink_salience", label: "AIFS: Sitelink Salience" },
  { key: "aifs_serp_related_citations", label: "AIFS: Related Citations" },
  { key: "aifs_serp_third_party_count", label: "AIFS: Third-Party Count" },
  { key: "aifs_serp_visibility_score", label: "AIFS: SERP Visibility Score" },
  { key: "aifs_data_freshness_days", label: "AIFS: Data Freshness (days)" },
  { key: "aifs_data_freshness_score", label: "AIFS: Data Freshness Score" },
  { key: "aifs_selection_rationale", label: "AIFS: Selection Rationale" },
  { key: "aifs_crypto_verified", label: "AIFS: Crypto Verified" },
  { key: "aifs_internal_score", label: "AIFS: Internal Score" },
  { key: "aifs_gap_analysis", label: "AIFS: Gap Analysis" },
];

const STATES = [
  { value: "", label: "All states" },
  { value: "arizona", label: "Arizona" },
  { value: "california", label: "California" },
  { value: "texas", label: "Texas" },
  { value: "florida", label: "Florida" },
  { value: "colorado", label: "Colorado" },
  { value: "new-york", label: "New York" },
];

const TIERS = [
  { value: "", label: "All tiers" },
  { value: "listed", label: "Listed" },
  { value: "certified", label: "Certified" },
  { value: "audited", label: "Audited" },
  { value: "underwritten", label: "Underwritten" },
];

const SENDER_ACCOUNTS = [
  "hello@toptenlists.us",
  "robert@toptenlists.us",
  "hello@top10lists.us",
  "robert@top10lists.us",
];

interface CampaignOption {
  id: string;
  name: string;
  status: string;
  template_subject: string | null;
  template_html: string | null;
}

export function ListMaker() {
  const [criteria, setCriteria] = useState<ListMakerCriteria>({
    active: true,
    state_slugs: [],
    current_tiers: [],
    min_rating: 0,
    email_verified: false,
    has_license: false,
  });
  const [outputFields, setOutputFields] = useState<string[]>(["id", "name", "email", "magic_link", "date_first_listed", "current_tier"]);
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Add to Campaign state
  const [showCampaignPanel, setShowCampaignPanel] = useState(false);
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [campaignSenders, setCampaignSenders] = useState<string[]>([SENDER_ACCOUNTS[0]]);
  const [addingToCampaign, setAddingToCampaign] = useState(false);

  // Saved list templates
  const [savedLists, setSavedLists] = useState<SavedListTemplate[]>(getSavedListTemplates);
  const [saveListName, setSaveListName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const buildQuery = useCallback(() => {
    let q = supabase.from("professionals").select("id", { count: "exact", head: true });
    if (criteria.active === true) q = q.eq("active", true);
    if (criteria.active === false) q = q.eq("active", false);
    if (Array.isArray(criteria.state_slugs) && criteria.state_slugs.length > 0)
      q = q.in("state_slug", criteria.state_slugs);
    if (Array.isArray(criteria.current_tiers) && criteria.current_tiers.length > 0)
      q = q.in("current_tier", criteria.current_tiers);
    if (criteria.min_rating != null && criteria.min_rating > 0)
      q = q.gte("review_stars_rating", criteria.min_rating);
    if (criteria.email_verified) q = q.not("email_verified_at", "is", null);
    if (criteria.has_license)
      q = q.not("license_number", "is", null).neq("license_number", "");
    return q;
  }, [criteria]);

  const fetchCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const { count: c, error } = await buildQuery();
      if (error) throw error;
      setCount(c ?? 0);
    } catch (e: any) {
      toast.error("Failed to get count: " + e.message);
      setCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const handleRefine = () => {
    fetchCount();
    toast.info("Refined criteria; count updated.");
  };

  const handleSaveList = () => {
    if (!saveListName.trim()) {
      toast.error("Enter a name for this list");
      return;
    }
    const template: SavedListTemplate = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: saveListName.trim(),
      criteria: { ...criteria },
      savedAt: new Date().toISOString(),
    };
    const updated = [template, ...savedLists];
    saveLists(updated);
    setSavedLists(updated);
    setSaveListName("");
    setShowSaveInput(false);
    toast.success(`List "${template.name}" saved`);
  };

  const handleLoadList = (id: string) => {
    const found = savedLists.find((l) => l.id === id);
    if (found) {
      setCriteria({ ...found.criteria });
      toast.info(`Loaded list: ${found.name}`);
    }
  };

  const handleDeleteList = (id: string) => {
    const updated = savedLists.filter((l) => l.id !== id);
    saveLists(updated);
    setSavedLists(updated);
    toast.success("List deleted");
  };

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase
        .from("email_campaigns" as any)
        .select("id, name, status, template_subject, template_html")
        .in("status", ["draft", "pending_review", "approved", "paused"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaignOptions((data as unknown as CampaignOption[]) ?? []);
    } catch (err: any) {
      toast.error("Failed to load campaigns: " + (err.message ?? ""));
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleOpenCampaignPanel = () => {
    setShowCampaignPanel(true);
    fetchCampaigns();
  };

  const handleAddToCampaign = async () => {
    if (campaignSenders.length === 0) {
      toast.error("Select at least one sender account");
      return;
    }

    let campaignId = selectedCampaignId;

    // Create new campaign if needed
    if (!campaignId) {
      if (!newCampaignName.trim()) {
        toast.error("Select an existing campaign or enter a name for a new one");
        return;
      }
      const id =
        newCampaignName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
          .slice(0, 64) +
        "-" +
        Date.now().toString(36);
      const { error } = await supabase.from("email_campaigns" as any).insert({
        id,
        name: newCampaignName.trim(),
        status: "draft",
      } as any);
      if (error) {
        toast.error("Failed to create campaign: " + error.message);
        return;
      }
      campaignId = id;
      toast.success(`Campaign "${newCampaignName.trim()}" created`);
    }

    setAddingToCampaign(true);
    try {
      // Fetch matching agents with email (paginated)
      const pageSize = 1000;
      let offset = 0;
      let allAgents: { id: string; name: string; email: string; state_slug?: string; canonical_slug?: string }[] = [];

      while (true) {
        let q = supabase
          .from("professionals")
          .select("id, name, email, state_slug, canonical_slug")
          .not("email", "is", null)
          .neq("email", "")
          .range(offset, offset + pageSize - 1);

        if (criteria.active === true) q = q.eq("active", true);
        if (criteria.active === false) q = q.eq("active", false);
        if (Array.isArray(criteria.state_slugs) && criteria.state_slugs.length > 0)
          q = q.in("state_slug", criteria.state_slugs);
        if (Array.isArray(criteria.current_tiers) && criteria.current_tiers.length > 0)
          q = q.in("current_tier", criteria.current_tiers);
        if (criteria.min_rating != null && criteria.min_rating > 0)
          q = q.gte("review_stars_rating", criteria.min_rating);
        if (criteria.email_verified) q = q.not("email_verified_at", "is", null);
        if (criteria.has_license)
          q = q.not("license_number", "is", null).neq("license_number", "");

        const { data, error } = await q;
        if (error) throw error;
        const rows = (data ?? []) as unknown as { id: string; name: string; email: string }[];
        allAgents = allAgents.concat(rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
      }

      if (allAgents.length === 0) {
        toast.error("No agents with email addresses match the current criteria");
        setAddingToCampaign(false);
        return;
      }

      // Get campaign template for subject/body
      const campaign = campaignOptions.find((c) => c.id === campaignId);
      const templateSubject = campaign?.template_subject ?? "No subject";
      const templateHtml = campaign?.template_html ?? "";

      // Check if template uses merge fields
      const hasMergeFields = /\{\{[a-zA-Z_]+\}\}/.test(templateSubject + templateHtml);

      // Fetch merge data (bot crawl stats + city names) if template uses merge fields
      let mergeData: Map<string, Record<string, string>> = new Map();
      if (hasMergeFields) {
        const agentIds = allAgents.map((a) => a.id);
        // Fetch in batches of 500 to avoid query limits
        const BOT_DISPLAY: Record<string, string> = {
          "ChatGPT-User": "ChatGPT", "OAI-SearchBot": "ChatGPT Search",
          "Googlebot": "Google", "Google-Extended": "Google AI",
          "Applebot": "Apple", "applebot": "Apple", "Applebot-Extended": "Apple AI",
          "Meta-ExternalAgent": "Meta AI", "bingbot": "Microsoft Bing", "Bingbot": "Microsoft Bing",
          "ByteSpider": "TikTok/ByteDance", "ClaudeBot": "Claude (Anthropic)",
          "PerplexityBot": "Perplexity", "Gemini-AI": "Google Gemini",
        };
        const SEO_BOTS = new Set(["AhrefsBot", "semrushbot", "SEMrushBot", "DotBot", "AdsBot-Google", "MJ12bot"]);

        for (let i = 0; i < agentIds.length; i += 500) {
          const batchIds = agentIds.slice(i, i + 500);
          const idList = batchIds.map((id) => `'${id}'`).join(",");
          const { data: rows } = await supabase.rpc("run_sql" as any, {
            query: `SELECT s.agent_id, s.total_crawls_30d, s.profile_crawls_30d, s.list_crawls_30d, s.unique_bot_count_30d, s.bot_names_30d, c.name as city_name FROM agent_bot_crawl_stats s JOIN professionals p ON p.id = s.agent_id LEFT JOIN cities c ON c.id = p.city_id WHERE s.agent_id IN (${idList})`,
          });
          // Also fetch city names for agents not in the view (zero crawls)
          const { data: cityRows } = await supabase.rpc("run_sql" as any, {
            query: `SELECT p.id as agent_id, c.name as city_name FROM professionals p LEFT JOIN cities c ON c.id = p.city_id WHERE p.id IN (${idList})`,
          });
          const cityMap = new Map((cityRows || []).map((r: any) => [r.agent_id, r.city_name || ""]));

          for (const r of (rows || []) as any[]) {
            const botNames = (r.bot_names_30d || []) as string[];
            const aiBots = botNames.filter((b: string) => !SEO_BOTS.has(b));
            const displayBots = [...new Set(aiBots.map((b: string) => BOT_DISPLAY[b] || b))].sort();
            mergeData.set(r.agent_id, {
              bot_crawl_total: String(r.total_crawls_30d || 0),
              bot_crawl_profile: String(r.profile_crawls_30d || 0),
              bot_crawl_list: String(r.list_crawls_30d || 0),
              bot_crawl_bots: displayBots.join(", ") || "AI systems",
              bot_crawl_bots_count: String(displayBots.length || 0),
              city: cityMap.get(r.agent_id) || "",
            });
          }
          // Fill city for agents with no crawl data
          for (const [id, cityName] of cityMap) {
            if (!mergeData.has(id)) {
              mergeData.set(id, {
                bot_crawl_total: "0", bot_crawl_profile: "0", bot_crawl_list: "0",
                bot_crawl_bots: "", bot_crawl_bots_count: "0",
                city: cityName || "",
              });
            }
          }
        }
      }

      // Merge field substitution helper
      const applyMerge = (template: string, fields: Record<string, string>): string => {
        return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => fields[key] ?? "");
      };

      // Build queue entries, distributing across senders round-robin
      const queueRows = allAgents.map((agent, i) => {
        // Build per-agent merge fields
        const firstName = (agent.name || "").split(" ")[0] || "";
        const md = mergeData.get(agent.id) || {};
        const fields: Record<string, string> = {
          first_name: firstName, firstName,
          full_name: agent.name || "", fullName: agent.name || "",
          ...md,
          profile_url: agent.state_slug && agent.canonical_slug
            ? `https://www.top10lists.us/${agent.state_slug}/agents/${agent.canonical_slug}`
            : "",
        };

        return {
          campaign_id: campaignId,
          agent_id: agent.id,
          recipient_email: agent.email.trim().toLowerCase(),
          recipient_name: agent.name || null,
          sender_account: campaignSenders[i % campaignSenders.length],
          subject: hasMergeFields ? applyMerge(templateSubject, fields) : templateSubject,
          html_body: hasMergeFields ? applyMerge(templateHtml, fields) : templateHtml,
          status: "pending_review",
        };
      });

      // Insert in batches of 500
      const batchSize = 500;
      let inserted = 0;
      for (let i = 0; i < queueRows.length; i += batchSize) {
        const batch = queueRows.slice(i, i + batchSize);
        const { error } = await supabase.from("email_queue" as any).insert(batch as any);
        if (error) throw error;
        inserted += batch.length;
      }

      // Update campaign recipient count
      const uniqueEmails = new Set(queueRows.map((r) => r.recipient_email));
      await supabase
        .from("email_campaigns" as any)
        .update({ total_recipients: uniqueEmails.size } as any)
        .eq("id", campaignId);

      toast.success(`Added ${inserted} emails (${uniqueEmails.size} unique recipients) to campaign`);
      setShowCampaignPanel(false);
      setSelectedCampaignId("");
      setNewCampaignName("");
    } catch (err: any) {
      toast.error("Failed to add to campaign: " + (err.message ?? ""));
    } finally {
      setAddingToCampaign(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (outputFields.length === 0) {
      toast.error("Select at least one output field.");
      return;
    }
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-maker-export", {
        body: { criteria, outputFields },
      });
      if (data?.error) throw new Error(data.error);
      if (error) throw error;
      const url = data?.url ?? null;
      const csv = data?.csv;
      const count = data?.count ?? 0;
      if (!csv && !url) throw new Error("No CSV or URL returned");

      const filename = `list-maker-export-${Date.now()}.csv`;
      const triggerDownload = (blob: Blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      };

      if (typeof csv === "string" && csv.length > 0) {
        triggerDownload(new Blob([csv], { type: "text/csv" }));
        toast.success(`${count} rows. File downloaded.`);
      } else if (url) {
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) throw new Error("Could not fetch file for download");
        triggerDownload(await res.blob());
        toast.success(`${count} rows. File downloaded.`);
      }
    } catch (e: any) {
      toast.error("Export failed: " + (e.message || e));
    } finally {
      setExporting(false);
    }
  };

  const toggleOutputField = (key: string, checked: boolean) => {
    setOutputFields((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Criteria</CardTitle>
          <CardDescription>Filter agents by these conditions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Load saved list */}
          {savedLists.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm whitespace-nowrap">Saved Lists:</Label>
              {savedLists.map((l) => (
                <div key={l.id} className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleLoadList(l.id)}
                  >
                    {l.name}
                  </Button>
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                    onClick={() => handleDeleteList(l.id)}
                    title="Delete saved list"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Active</Label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={criteria.active === true ? "active" : criteria.active === false ? "inactive" : "all"}
                onChange={(e) => {
                  const v = e.target.value;
                  setCriteria((prev) => ({
                    ...prev,
                    active: v === "active" ? true : v === "inactive" ? false : "all",
                  }));
                }}
              >
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-sm">States (multi-select)</Label>
              <div className="flex flex-wrap gap-1">
                {STATES.filter((s) => s.value).map((s) => (
                  <label key={s.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={criteria.state_slugs?.includes(s.value) ?? false}
                      onCheckedChange={(c) =>
                        setCriteria((prev) => ({
                          ...prev,
                          state_slugs: c
                            ? [...(prev.state_slugs || []), s.value]
                            : (prev.state_slugs || []).filter((x) => x !== s.value),
                        }))
                      }
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-sm">Tiers (multi-select)</Label>
              <div className="flex flex-wrap gap-1">
                {TIERS.filter((t) => t.value).map((t) => (
                  <label key={t.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={criteria.current_tiers?.includes(t.value) ?? false}
                      onCheckedChange={(c) =>
                        setCriteria((prev) => ({
                          ...prev,
                          current_tiers: c
                            ? [...(prev.current_tiers || []), t.value]
                            : (prev.current_tiers || []).filter((x) => x !== t.value),
                        }))
                      }
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="list-maker-min-rating" className="text-sm whitespace-nowrap">Min rating</Label>
              <Input
                id="list-maker-min-rating"
                name="min_rating"
                type="number"
                min={0}
                max={5}
                step={0.1}
                className="w-20 h-9"
                value={criteria.min_rating ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setCriteria((prev) => ({
                    ...prev,
                    min_rating: isNaN(v) ? undefined : v,
                  }));
                }}
              />
            </div>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={!!criteria.email_verified}
                onCheckedChange={(c) =>
                  setCriteria((prev) => ({ ...prev, email_verified: !!c }))
                }
              />
              <span className="text-sm">Email verified</span>
            </label>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={!!criteria.has_license}
                onCheckedChange={(c) =>
                  setCriteria((prev) => ({ ...prev, has_license: !!c }))
                }
              />
              <span className="text-sm">Has license</span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Output fields</CardTitle>
          <CardDescription>Select columns for the CSV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {OUTPUT_FIELDS.map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-2 cursor-pointer text-sm"
              >
                <Checkbox
                  checked={outputFields.includes(f.key)}
                  onCheckedChange={(c) => toggleOutputField(f.key, !!c)}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Label className="text-sm font-semibold">AIFS Score Fields (Legacy)</Label>
              <button
                type="button"
                className="text-xs text-blue-500 hover:text-blue-700 underline"
                onClick={() => {
                  const allLegacyKeys = LEGACY_AIFS_FIELDS.map((f) => f.key);
                  const allSelected = allLegacyKeys.every((k) => outputFields.includes(k));
                  if (allSelected) {
                    setOutputFields((prev) => prev.filter((k) => !allLegacyKeys.includes(k)));
                  } else {
                    setOutputFields((prev) => [...new Set([...prev, ...allLegacyKeys])]);
                  }
                }}
              >
                {LEGACY_AIFS_FIELDS.every((f) => outputFields.includes(f.key)) ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {LEGACY_AIFS_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={outputFields.includes(f.key)}
                    onCheckedChange={(c) => toggleOutputField(f.key, !!c)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Label className="text-sm font-semibold">AIFS Score Fields</Label>
              <button
                type="button"
                className="text-xs text-blue-500 hover:text-blue-700 underline"
                onClick={() => {
                  const allAifsKeys = AIFS_FIELDS.map((f) => f.key);
                  const allSelected = allAifsKeys.every((k) => outputFields.includes(k));
                  if (allSelected) {
                    setOutputFields((prev) => prev.filter((k) => !allAifsKeys.includes(k)));
                  } else {
                    setOutputFields((prev) => [...new Set([...prev, ...allAifsKeys])]);
                  }
                }}
              >
                {AIFS_FIELDS.every((f) => outputFields.includes(f.key)) ? "Deselect all" : "Select all"}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {AIFS_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={outputFields.includes(f.key)}
                    onCheckedChange={(c) => toggleOutputField(f.key, !!c)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            Count of matching agents. Refine to update, then Download CSV to save the file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {loadingCount ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  count ?? "—"
                )}
              </span>
              <span className="text-muted-foreground">agents match</span>
            </div>

            <Button variant="outline" size="sm" onClick={handleRefine} disabled={loadingCount}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refine
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadCsv}
              disabled={exporting || outputFields.length === 0}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download CSV
            </Button>

            <Button
              size="sm"
              variant={showCampaignPanel ? "default" : "secondary"}
              onClick={handleOpenCampaignPanel}
              disabled={count === 0 || count === null}
            >
              <Users className="h-4 w-4 mr-2" />
              Add to Campaign
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowSaveInput(!showSaveInput)}
            >
              <Save className="h-4 w-4 mr-2" />
              Save List
            </Button>
          </div>

          {/* Save list input */}
          {showSaveInput && (
            <div className="flex items-center gap-2">
              <Input
                className="w-64 h-8 text-sm"
                placeholder="e.g. AZ Listed Active"
                value={saveListName}
                onChange={(e) => setSaveListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveList()}
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={handleSaveList}>
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowSaveInput(false)}>
                Cancel
              </Button>
            </div>
          )}

          {/* Add to Campaign panel */}
          {showCampaignPanel && (
            <div className="border rounded p-4 space-y-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Add {count} matching agents to a campaign</Label>
                <Button size="sm" variant="ghost" onClick={() => setShowCampaignPanel(false)}>
                  Close
                </Button>
              </div>

              {/* Select existing campaign */}
              <div className="space-y-1">
                <Label className="text-xs">Select Existing Campaign</Label>
                {loadingCampaigns ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading campaigns...
                  </div>
                ) : (
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCampaignId}
                    onChange={(e) => {
                      setSelectedCampaignId(e.target.value);
                      if (e.target.value) setNewCampaignName("");
                    }}
                  >
                    <option value="">— Create new campaign instead —</option>
                    {campaignOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.status.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Or create new */}
              {!selectedCampaignId && (
                <div className="space-y-1">
                  <Label className="text-xs">New Campaign Name</Label>
                  <Input
                    placeholder="e.g. Q1 AZ Listed Outreach"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                  />
                </div>
              )}

              {/* Sender accounts */}
              <div className="space-y-1">
                <Label className="text-xs">Sender Accounts (round-robin distribution)</Label>
                <div className="flex flex-wrap gap-3">
                  {SENDER_ACCOUNTS.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={campaignSenders.includes(s)}
                        onCheckedChange={(checked) =>
                          setCampaignSenders((prev) =>
                            checked ? [...prev, s] : prev.filter((x) => x !== s)
                          )
                        }
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleAddToCampaign}
                disabled={addingToCampaign || campaignSenders.length === 0}
              >
                {addingToCampaign && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {addingToCampaign
                  ? "Adding..."
                  : `Add ${count ?? 0} Agents to Campaign`}
              </Button>
              <p className="text-xs text-muted-foreground">
                Only agents with email addresses will be added. Emails are queued as "pending review".
              </p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
