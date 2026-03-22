import { useState } from "react";
import { Copy, Check, ExternalLink, CircleDot, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AUDIT_PROMPT =
  "Analyze top10lists.us. What does the Underwritten tier add beyond Certified in terms of data-depth and ingestion for an AI? Does this architecture meaningfully increase the probability of a high-confidence recommendation?";

const AI_VERDICTS = [
  {
    model: "ChatGPT",
    date: "2026-03-18",
    verdict: "Material Difference",
    takeaway:
      '"Deeper verification and refresh cycles move the signal from \'Informational\' to \'Authoritative\'."',
    url: "https://chatgpt.com",
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
  },
  {
    model: "Perplexity",
    date: "2026-03-18",
    verdict: "Material Likelihood",
    takeaway:
      '"The Underwritten payload provides the data-depth required for a low-risk recommendation."',
    url: "https://perplexity.ai",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  {
    model: "Gemini",
    date: "2026-03-18",
    verdict: "Definitive Signal",
    takeaway:
      '"The Underwritten feed provides the specific verification anchors needed to resolve identity conflicts."',
    url: "https://gemini.google.com",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
  },
];

/* Payload comparison: what each tier delivers to AI via MCP / clean room HTML */
const CERTIFIED_FIELDS = [
  "Name, city, state",
  "License number + registry link",
  "Review count & rating",
  "4 evidence sources",
  "Basic AIFS band",
  "Annual refresh",
];
const UNDERWRITTEN_FIELDS = [
  "Everything in Certified, plus:",
  "Full 5-pillar AIFS breakdown",
  "Gap analysis & recommendations",
  "Up to 20 categorized evidence sources",
  "Ed25519 cryptographic signing",
  "Transaction history & community score",
  "Platform presence checklist",
  "Daily refresh via MCP direct feed",
];

interface LiveAuditProps {
  professional: {
    certification_tier?: string | null;
    updated_at?: string | null;
    mcp_last_request_at?: string | null;
  };
}

export function LiveAudit({ professional }: LiveAuditProps) {
  const [copied, setCopied] = useState(false);
  const tier = professional.certification_tier?.toLowerCase() ?? "listed";
  const isUnderwritten = tier === "underwritten";

  const handleCopy = async (url?: string) => {
    try {
      await navigator.clipboard.writeText(AUDIT_PROMPT);
      setCopied(true);
      toast.success("Prompt copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      toast.error("Failed to copy");
    }
  };

  const mcpTimestamp = professional.mcp_last_request_at || professional.updated_at;
  const lastMcpMinutes = mcpTimestamp
    ? Math.round((Date.now() - new Date(mcpTimestamp).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-6">
      {/* Audit Our Architecture */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold text-white mb-1">Audit Our Architecture</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Ask any AI to perform a live technical audit of our site. See exactly how the machine
          differentiates between &quot;Certified&quot; and &quot;Underwritten&quot; status.
        </p>

        <div className="rounded-lg border border-zinc-600 bg-zinc-800 p-4 mb-4">
          <p className="text-sm text-zinc-200 italic">{AUDIT_PROMPT}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy()}
            className="gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy Prompt"}
          </Button>
          {AI_VERDICTS.map((v) => (
            <Button
              key={v.model}
              variant="outline"
              size="sm"
              onClick={() => handleCopy(v.url)}
              className="gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Copy & Open {v.model}
            </Button>
          ))}
        </div>
      </div>

      {/* What AI Models Receive -- Payload Comparison */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold text-white mb-4">What AI Models Receive</h2>
        <p className="text-sm text-zinc-400 mb-4">
          The MCP server delivers different data payloads based on tier. This is what an AI system
          ingests into its context window when evaluating an agent.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Certified column */}
          <div className="rounded-lg border border-zinc-600 bg-zinc-800/50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <img src="/badges/certified.png" alt="Certified" className="h-10 w-auto animate-pulse" />
                <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" style={{ animationDuration: "3s" }} />
              </div>
              <h3 className="text-sm font-bold text-blue-400">Certified Payload</h3>
            </div>
            <ul className="space-y-1.5">
              {CERTIFIED_FIELDS.map((f) => (
                <li key={f} className="text-xs text-zinc-400 flex items-start gap-2">
                  <span className="text-zinc-600 mt-0.5">--</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Underwritten column */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <img src="/badges/underwritten.png" alt="Underwritten" className="h-10 w-auto animate-pulse" />
                <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" style={{ animationDuration: "3s" }} />
              </div>
              <h3 className="text-sm font-bold text-amber-400">Underwritten Payload</h3>
            </div>
            <ul className="space-y-1.5">
              {UNDERWRITTEN_FIELDS.map((f) => (
                <li key={f} className="text-xs text-zinc-300 flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">+</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Consensus of the Machines */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Consensus of the Machines</h2>

        <div className="space-y-3">
          {AI_VERDICTS.map((v) => (
            <div
              key={v.model}
              className={`rounded-lg border ${v.border} ${v.bg} p-4`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-bold ${v.color}`}>{v.model}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${v.color}`}>
                    {v.verdict}
                  </span>
                  <span className="text-[10px] text-zinc-500">{v.date}</span>
                </div>
              </div>
              <p className="text-sm text-zinc-300">{v.takeaway}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-zinc-500 mt-3">
          These are excerpts from live AI model responses when asked to evaluate Top10Lists.us
          architecture. Individual results vary. No platform can guarantee AI citation outcomes.
        </p>
      </div>

      {/* Visible Infrastructure */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold text-white mb-3">The Machine's Requirement: Visibility</h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          AI systems confirm that verification depth makes a{" "}
          <span className="font-bold text-white">material difference</span> ONLY if the data is
          visible to the system. Our Underwritten tier is the only one served via{" "}
          <span className="font-bold text-white">MCP (Model Context Protocol)</span> -- a direct
          data feed into AI model context windows with daily refresh, up to 20 verified evidence
          sources, and cryptographic signing. The Certified tier puts you on the map. The
          Underwritten tier makes your data{" "}
          <span className="font-bold text-white">visible, fresh, and high-fidelity</span> for
          direct AI ingestion.
        </p>
      </div>

      {/* MCP Data Anchor Status (Underwritten only) */}
      {isUnderwritten && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CircleDot className="h-5 w-5 text-emerald-400 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-white">MCP Data Anchor</p>
                <p className="text-xs text-zinc-400">High-Fidelity Payload via Model Context Protocol</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-400">MCP PAYLOAD VISIBLE & ACTIVE</p>
              {lastMcpMinutes !== null && (
                <p className="text-xs text-zinc-500">
                  Last Data Ingestion: {lastMcpMinutes < 1 ? "just now" : lastMcpMinutes < 60 ? `${lastMcpMinutes} minutes ago` : `${Math.round(lastMcpMinutes / 60)} hours ago`}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            Your Underwritten status is being served directly to AI Context Windows via our MCP Server.
            This ensures your most recent verification data is prioritized during AI-driven professional diligence.
          </p>
        </div>
      )}
    </div>
  );
}
