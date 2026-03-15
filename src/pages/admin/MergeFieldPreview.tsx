import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const BOT_DISPLAY: Record<string, string> = {
  "ChatGPT-User": "ChatGPT", "OAI-SearchBot": "ChatGPT Search",
  "Googlebot": "Google", "Google-Extended": "Google AI",
  "Applebot": "Apple", "applebot": "Apple", "Applebot-Extended": "Apple AI",
  "Meta-ExternalAgent": "Meta AI", "bingbot": "Microsoft Bing", "Bingbot": "Microsoft Bing",
  "ByteSpider": "TikTok/ByteDance", "ClaudeBot": "Claude (Anthropic)",
  "PerplexityBot": "Perplexity", "Gemini-AI": "Google Gemini",
};
const SEO_BOTS = new Set(["AhrefsBot", "semrushbot", "SEMrushBot", "DotBot", "AdsBot-Google", "MJ12bot"]);

interface AgentRow {
  agent_id: string;
  name: string;
  city_name: string;
  state_slug: string;
  canonical_slug: string;
  total_crawls_30d: number;
  profile_crawls_30d: number;
  list_crawls_30d: number;
  unique_bot_count_30d: number;
  bot_names_30d: string[];
}

const DEFAULT_TEMPLATE = `Subject: {{first_name}}, AI systems have viewed your profile {{bot_crawl_total}} times

Hi {{first_name}},

In the last 30 days, {{bot_crawl_bots_count}} AI systems -- including {{bot_crawl_bots}} -- have crawled your Top10Lists.us profile {{bot_crawl_total}} times.

That means when someone asks ChatGPT or Google AI for a real estate agent recommendation in {{city}}, the data those systems use to answer includes your verified credentials on our platform.

Your current profile: {{profile_url}}

Right now your listing shows the basics. Upgrading to Audited ($300/mo) adds 10+ evidence sources and monthly refresh, giving AI systems significantly more data to cite when recommending you.

No pressure. Your free listing stays active regardless. But the agents who give AI systems the most verified data are the ones who get named.

Robert Maynard
Top10Lists.us`;

export default function MergeFieldPreview() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [search, setSearch] = useState("");

  useEffect(() => { loadTopAgents(); }, []);

  const loadTopAgents = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("run_sql" as any, {
      query: `SELECT s.agent_id, p.name, c.name as city_name, p.state_slug, p.canonical_slug,
        s.total_crawls_30d, s.profile_crawls_30d, s.list_crawls_30d, s.unique_bot_count_30d, s.bot_names_30d
        FROM agent_bot_crawl_stats s
        JOIN professionals p ON p.id = s.agent_id
        LEFT JOIN cities c ON c.id = p.city_id
        WHERE s.total_crawls_30d > 0
        ORDER BY s.total_crawls_30d DESC
        LIMIT 50`,
    });
    const rows = (data || []) as AgentRow[];
    setAgents(rows);
    if (rows.length > 0) setSelectedAgent(rows[0]);
    setLoading(false);
  };

  const searchAgent = async () => {
    if (!search.trim()) return;
    setLoading(true);
    const term = search.trim().replace(/'/g, "''");
    const { data } = await supabase.rpc("run_sql" as any, {
      query: `SELECT s.agent_id, p.name, c.name as city_name, p.state_slug, p.canonical_slug,
        s.total_crawls_30d, s.profile_crawls_30d, s.list_crawls_30d, s.unique_bot_count_30d, s.bot_names_30d
        FROM agent_bot_crawl_stats s
        JOIN professionals p ON p.id = s.agent_id
        LEFT JOIN cities c ON c.id = p.city_id
        WHERE p.name ILIKE '%${term}%'
        ORDER BY s.total_crawls_30d DESC
        LIMIT 20`,
    });
    const rows = (data || []) as AgentRow[];
    if (rows.length > 0) { setAgents(rows); setSelectedAgent(rows[0]); }
    setLoading(false);
  };

  const buildFields = (a: AgentRow): Record<string, string> => {
    const botNames = (a.bot_names_30d || []).filter((b) => !SEO_BOTS.has(b));
    const displayBots = [...new Set(botNames.map((b) => BOT_DISPLAY[b] || b))].sort();
    return {
      first_name: (a.name || "").split(" ")[0],
      full_name: a.name || "",
      bot_crawl_total: String(a.total_crawls_30d || 0),
      bot_crawl_profile: String(a.profile_crawls_30d || 0),
      bot_crawl_list: String(a.list_crawls_30d || 0),
      bot_crawl_bots: displayBots.join(", ") || "AI systems",
      bot_crawl_bots_count: String(displayBots.length || 0),
      city: a.city_name || "",
      profile_url: a.state_slug && a.canonical_slug
        ? `https://www.top10lists.us/${a.state_slug}/agents/${a.canonical_slug}`
        : "",
    };
  };

  const applyMerge = (tpl: string, fields: Record<string, string>) =>
    tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key] ?? `{{${key}}}`);

  const fields = selectedAgent ? buildFields(selectedAgent) : {};
  const rendered = selectedAgent ? applyMerge(template, fields) : template;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Bot Crawl Merge Field Preview</h1>
      <p className="text-muted-foreground">
        Preview how <code>{"{{merge_fields}}"}</code> resolve for real agents using live bot crawl data from the last 30 days.
      </p>

      {/* Search */}
      <div className="flex gap-2">
        <Input
          placeholder="Search agent by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchAgent()}
          className="max-w-sm"
        />
        <Button onClick={searchAgent} variant="outline">Search</Button>
        <Button onClick={loadTopAgents} variant="ghost">Top 50</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Agent list + stats */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Agents with Bot Crawl Data</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {agents.map((a) => {
                    const aiBots = (a.bot_names_30d || []).filter((b) => !SEO_BOTS.has(b));
                    return (
                      <button
                        key={a.agent_id}
                        onClick={() => setSelectedAgent(a)}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-muted transition-colors ${
                          selectedAgent?.agent_id === a.agent_id ? "bg-primary/10 border border-primary/30" : ""
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{a.name}</span>
                          <span className="text-xs text-muted-foreground">{a.total_crawls_30d} crawls</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {a.city_name} | {aiBots.length} AI bots | {a.profile_crawls_30d} profile
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected agent details */}
          {selectedAgent && (
            <Card>
              <CardHeader><CardTitle>Merge Fields for {selectedAgent.name}</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b"><th className="text-left py-1 pr-4">Variable</th><th className="text-left py-1">Value</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(fields).map(([k, v]) => (
                      <tr key={k} className="border-b border-muted">
                        <td className="py-1 pr-4 font-mono text-xs text-primary">{`{{${k}}}`}</td>
                        <td className="py-1 text-xs">{v || <span className="text-muted-foreground italic">(empty)</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Raw bot breakdown */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Raw Bot Breakdown</h4>
                  <div className="flex flex-wrap gap-1">
                    {(selectedAgent.bot_names_30d || []).map((b) => (
                      <span
                        key={b}
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          SEO_BOTS.has(b)
                            ? "bg-gray-100 text-gray-400 line-through"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {b} {BOT_DISPLAY[b] ? `(${BOT_DISPLAY[b]})` : ""}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Struck-through bots are SEO tools, excluded from email merge.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Template + Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Email Template</CardTitle></CardHeader>
            <CardContent>
              <textarea
                className="w-full h-48 text-sm font-mono border rounded p-3 resize-y bg-muted/30"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Rendered Preview
                {selectedAgent && <span className="text-sm font-normal text-muted-foreground ml-2">({selectedAgent.name})</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white border rounded p-4 text-sm whitespace-pre-wrap leading-relaxed">
                {rendered}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
