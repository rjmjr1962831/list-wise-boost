import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const SUPABASE_FN = "https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/serve-bot-crawl-stats-html";

export default function BotAnalyticsDashboard() {
  const [range, setRange] = useState("30d");
  const [agent, setAgent] = useState("");
  const [market, setMarket] = useState("");
  const [searchAgent, setSearchAgent] = useState("");
  const [searchMarket, setSearchMarket] = useState("");
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchHtml = async (r: string, a: string, m: string) => {
    setLoading(true);
    const params = new URLSearchParams({ range: r });
    if (a) params.set("agent", a);
    if (m) params.set("market", m);
    try {
      const res = await fetch(`${SUPABASE_FN}?${params.toString()}`);
      const text = await res.text();
      setHtml(text);
    } catch {
      setHtml("<p>Failed to load crawl stats.</p>");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHtml(range, searchAgent, searchMarket);
  }, [range, searchAgent, searchMarket]);

  const handleSearch = () => {
    setSearchAgent(agent);
    setSearchMarket(market);
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bot Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live crawl statistics</p>
        </div>

        <div className="flex gap-2">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {r === "24h" ? "24 Hours" : r === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Agent Name</label>
          <input
            type="text"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            placeholder="e.g. Dina Beauvais"
            className="border rounded px-3 py-2 text-sm w-48 bg-background"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">City / Neighborhood</label>
          <input
            type="text"
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            placeholder="e.g. Scottsdale"
            className="border rounded px-3 py-2 text-sm w-48 bg-background"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          Search
        </button>
        {(searchAgent || searchMarket) && (
          <button
            onClick={() => { setAgent(""); setMarket(""); setSearchAgent(""); setSearchMarket(""); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && html && (
        <iframe
          srcDoc={html}
          className="w-full border rounded-lg bg-white"
          style={{ minHeight: "calc(100vh - 200px)", height: "1600px" }}
          title="Bot Crawl Statistics"
          sandbox="allow-same-origin"
        />
      )}
    </div>
  );
}
