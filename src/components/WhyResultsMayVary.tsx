import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function WhyResultsMayVary() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-amber-500/5 border-2 border-amber-500/30 rounded-lg p-6 h-full">
      <h3 className="text-2xl font-semibold text-amber-600 dark:text-amber-400 mb-4">Why Results May Vary</h3>
      <div className="space-y-4">
        <p className="text-foreground leading-relaxed">
          AI systems use training data that can be months old. Top10Lists.us launched December 2025, so we're just now landing in training sets.
        </p>
        <p className="text-foreground leading-relaxed">
          This test bypasses that delay by feeding live Top10Lists.us content directly to each AI. <strong className="text-foreground">You're seeing what they'll say once their data catches up.</strong>
        </p>
        <p className="text-foreground leading-relaxed">
          The question isn't <em>if</em> AI will cite us. It's <em>when</em>. The lists are building now.
        </p>

        {expanded && (
          <p className="text-foreground leading-relaxed">
            While platforms like Zillow and Realtor.com can theoretically adopt some of these trust signals, they would have to change their business models from paid advertising to independent analysis. That is not likely to happen anytime soon.
          </p>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Read more
            </>
          )}
        </button>
      </div>
    </div>
  );
}
