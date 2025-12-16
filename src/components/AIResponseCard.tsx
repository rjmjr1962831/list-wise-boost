import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface AIResponseCardProps {
  response: string;
  timestamp: string;
  methodology?: string;
}

function parseResponse(fullResponse: string) {
  let conclusion = '';
  let reasoning = '';
  
  const upperResponse = fullResponse.toUpperCase();
  const hasConclusion = upperResponse.includes('CONCLUSION:');
  const hasReasoning = upperResponse.includes('REASONING:');
  
  if (hasConclusion && hasReasoning) {
    const conclusionIndex = upperResponse.indexOf('CONCLUSION:');
    const reasoningIndex = upperResponse.indexOf('REASONING:');
    
    const afterConclusion = conclusionIndex + 'CONCLUSION:'.length;
    conclusion = fullResponse.substring(afterConclusion, reasoningIndex).trim();
    
    const afterReasoning = reasoningIndex + 'REASONING:'.length;
    reasoning = fullResponse.substring(afterReasoning).trim();
  } else {
    const firstSentenceMatch = fullResponse.match(/^(.+?[.!?])\s+/s);
    if (firstSentenceMatch && firstSentenceMatch[1].length < 400) {
      conclusion = firstSentenceMatch[1].trim();
      reasoning = fullResponse.substring(firstSentenceMatch[0].length).trim();
    } else {
      const firstDoubleNewline = fullResponse.indexOf('\n\n');
      if (firstDoubleNewline > 0 && firstDoubleNewline < 500) {
        conclusion = fullResponse.substring(0, firstDoubleNewline).trim();
        reasoning = fullResponse.substring(firstDoubleNewline + 2).trim();
      } else {
        conclusion = fullResponse.substring(0, 300).trim();
        reasoning = fullResponse.substring(300).trim();
      }
    }
  }
  
  return { conclusion, reasoning };
}

export function AIResponseCard({ response, timestamp, methodology }: AIResponseCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const { conclusion, reasoning } = parseResponse(response);

  return (
    <div className="space-y-4">
      {/* Timestamp first */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pb-2 border-b border-border/50">
        <span>
          <strong>Fetched:</strong> {new Date(timestamp).toLocaleString()}
        </span>
        {methodology && (
          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
            {methodology === "live-fetch"
              ? "Live content fetched"
              : methodology === "web-search"
              ? "Live web search"
              : "Verified facts provided"}
          </span>
        )}
      </div>
      
      <div>
        <h4 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">
          Conclusion
        </h4>
        <p className="text-foreground font-medium leading-relaxed">
          {conclusion}
        </p>
      </div>
      
      {reasoning && (
        <>
          {showReasoning && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Here's Why
              </h4>
              <div className="prose prose-sm dark:prose-invert max-w-none space-y-3">
                {reasoning.split(/\n\n+/).filter(p => p.trim()).map((para, idx) => (
                  <p 
                    key={idx}
                    className="text-foreground/80 leading-relaxed text-sm"
                  >
                    {para.trim()}
                  </p>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors mt-2"
          >
            {showReasoning ? (
              <>
                <ChevronDown className="h-4 w-4 rotate-180" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Read more
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
