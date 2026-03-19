import { useState } from "react";
import { Copy, Check, ExternalLink, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const AUDIT_PROMPT =
  "Analyze the top10lists.us live site. What does the Underwritten tier on Top10Lists.us add beyond Certified, and do those additions meaningfully change how AI systems would treat that agent?";

const AI_VERDICTS = [
  {
    model: "ChatGPT",
    date: "2026-03-18",
    verdict: "Material Difference",
    takeaway:
      '"It can make a material difference if the added verification, freshness, and data access are actually visible to AI systems."',
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
      '"In my view, Underwritten does materially change the likelihood that I would name or endorse someone."',
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
      '"Underwriting turns a \'Likely\' citation into a Definitive Endorsement, though it is not a guarantee you will be named."',
    url: "https://gemini.google.com",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
  },
  {
    model: "Claude",
    date: "2026-03-18",
    verdict: "Pending",
    takeaway: "Placeholder for system recovery.",
    url: "https://claude.ai",
    color: "text-zinc-400",
    bg: "bg-zinc-400/10",
    border: "border-zinc-400/20",
  },
];

interface LiveAuditProps {
  professional: {
    certification_tier?: string | null;
    updated_at?: string | null;
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

  const lastIngestion = professional.updated_at
    ? Math.round((Date.now() - new Date(professional.updated_at).getTime()) / 60000)
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
          {AI_VERDICTS.filter((v) => v.verdict !== "Pending").map((v) => (
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
      </div>

      {/* Visible Infrastructure */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold text-white mb-3">The Machine's Requirement: Visibility</h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          ChatGPT confirms that Underwriting makes a{" "}
          <span className="font-bold text-white">material difference</span> ONLY if the data is
          visible to the system. Our Underwritten tier is the only one that enables{" "}
          <span className="font-bold text-white">Direct Ingestion Protocols</span> (API access and
          Priority Data Feeds). While the Certified tier puts you on the map, the Underwritten tier
          ensures your data is{" "}
          <span className="font-bold text-white">visible, fresh, and high-fidelity</span> enough for
          the AI to risk a recommendation.
        </p>
      </div>

      {/* Machine-Trust Status (Underwritten only) */}
      {isUnderwritten && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CircleDot className="h-5 w-5 text-emerald-400 animate-pulse" />
              <div>
                <p className="text-sm font-bold text-white">Machine-Trust Status</p>
                <p className="text-xs text-zinc-400">Direct Ingestion Protocol</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-emerald-400">PAYLOAD VISIBLE & ACTIVE</p>
              {lastIngestion !== null && (
                <p className="text-xs text-zinc-500">
                  Last ingestion check: {lastIngestion < 60 ? `${lastIngestion} minutes ago` : `${Math.round(lastIngestion / 60)} hours ago`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
