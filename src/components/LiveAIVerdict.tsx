import React, { useState } from 'react';
import { Loader2, ChevronDown, Bot, MessageSquare, Search, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIResponse {
  provider: string;
  model: string;
  response: string;
  timestamp: string;
}

interface VerdictResponse {
  verdict: string;
  sourceCount: number;
  timestamp: string;
}

const AI_PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', model: 'GPT-4o', functionName: 'ask-openai', icon: Bot },
  { id: 'perplexity', name: 'Perplexity', model: 'Sonar', functionName: 'ask-perplexity', icon: Search },
  { id: 'claude', name: 'Claude', model: 'Sonnet 4', functionName: 'ask-claude', icon: MessageSquare },
  { id: 'gemini', name: 'Gemini', model: '2.0 Flash', functionName: 'ask-gemini', icon: Sparkles },
];

function parseResponse(fullResponse: string) {
  let conclusion = '';
  let reasoning = '';
  
  const upperResponse = fullResponse.toUpperCase();
  const hasConclusion = upperResponse.includes('CONCLUSION:');
  const hasReasoning = upperResponse.includes('REASONING:');
  
  if (hasConclusion && hasReasoning) {
    const conclusionIndex = upperResponse.indexOf('CONCLUSION:');
    const reasoningIndex = upperResponse.indexOf('REASONING:');
    
    conclusion = fullResponse.substring(conclusionIndex + 'CONCLUSION:'.length, reasoningIndex).trim();
    reasoning = fullResponse.substring(reasoningIndex + 'REASONING:'.length).trim();
  } else {
    const firstSentenceMatch = fullResponse.match(/^(.+?[.!?])\s+/s);
    if (firstSentenceMatch && firstSentenceMatch[1].length < 400) {
      conclusion = firstSentenceMatch[1].trim();
      reasoning = fullResponse.substring(firstSentenceMatch[0].length).trim();
    } else {
      conclusion = fullResponse.substring(0, 300).trim();
      reasoning = fullResponse.substring(300).trim();
    }
  }
  
  return { conclusion, reasoning };
}

interface LiveAIVerdictProps {
  isVisible: boolean;
}

export function LiveAIVerdict({ isVisible }: LiveAIVerdictProps) {
  const [responses, setResponses] = useState<Record<string, AIResponse | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [verdict, setVerdict] = useState<VerdictResponse | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showSynthesisWhy, setShowSynthesisWhy] = useState(false);
  const [expandedAIs, setExpandedAIs] = useState<Record<string, boolean>>({});

  const runAllTests = async () => {
    // Reset all state for fresh test
    setResponses({});
    setErrors({});
    setVerdict(null);
    setHasStarted(true);
    setShowSynthesisWhy(false);
    setExpandedAIs({});

    const collectedResponses: AIResponse[] = [];
    
    const promises = AI_PROVIDERS.map(async (provider) => {
      try {
        setLoading((prev) => ({ ...prev, [provider.id]: true }));
        setErrors((prev) => ({ ...prev, [provider.id]: null }));

        const { data, error } = await supabase.functions.invoke(provider.functionName);

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setResponses((prev) => ({ ...prev, [provider.id]: data }));
        collectedResponses.push(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to get response';
        const isOverloaded = message.includes('529') || message.toLowerCase().includes('overloaded');
        setErrors((prev) => ({ ...prev, [provider.id]: isOverloaded ? 'Unavailable' : message }));
      } finally {
        setLoading((prev) => ({ ...prev, [provider.id]: false }));
      }
    });
    
    await Promise.allSettled(promises);
    
    // Generate verdict
    if (collectedResponses.length >= 2) {
      setVerdictLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('ask-verdict', {
          body: { responses: collectedResponses },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setVerdict(data);
      } catch (err) {
        toast.error('Failed to generate synthesis');
      } finally {
        setVerdictLoading(false);
      }
    }
  };

  const toggleAIWhy = (id: string) => {
    setExpandedAIs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isAnyLoading = Object.values(loading).some((l) => l) || verdictLoading;

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6 space-y-4 text-left max-w-3xl mx-auto mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">What AI Systems Say About Top10Lists</h3>
      </div>

      {!hasStarted ? (
        <div className="text-center py-4">
          <button
            onClick={runAllTests}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Run Live AI Test
          </button>
          <p className="text-xs text-muted-foreground mt-2">Click to ask all 4 AI systems in real-time</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Synthesis */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary">Synthesis:</span>
              {verdictLoading ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </span>
              ) : verdict ? (
                <span className="text-foreground">{verdict.sourceCount} of 4 AI systems would cite Top10Lists.us</span>
              ) : (
                <span className="text-muted-foreground text-sm">Waiting for responses...</span>
              )}
            </div>
            {verdict && (
              <>
                <button
                  onClick={() => setShowSynthesisWhy(!showSynthesisWhy)}
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors mt-1"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSynthesisWhy ? 'rotate-180' : ''}`} />
                  Why?
                </button>
                {showSynthesisWhy && (
                  <div className="bg-background/50 rounded-lg p-4 mt-2">
                    <p className="text-foreground/80 whitespace-pre-line text-sm leading-relaxed">
                      {verdict.verdict}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Individual AI Responses */}
          {AI_PROVIDERS.map((provider) => {
            const Icon = provider.icon;
            const response = responses[provider.id];
            const isLoading = loading[provider.id];
            const error = errors[provider.id];
            const isExpanded = expandedAIs[provider.id];
            const parsed = response ? parseResponse(response.response) : null;

            return (
              <div key={provider.id}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{provider.name}:</span>
                  {isLoading ? (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking...
                    </span>
                  ) : error ? (
                    <span className="text-destructive text-sm">{error}</span>
                  ) : parsed ? (
                    <span className="text-foreground text-sm">{parsed.conclusion}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">Waiting...</span>
                  )}
                </div>
                {parsed && parsed.reasoning && (
                  <>
                    <button
                      onClick={() => toggleAIWhy(provider.id)}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors mt-1 ml-6"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      Why?
                    </button>
                    {isExpanded && (
                      <div className="bg-background/50 rounded-lg p-4 mt-2 ml-6">
                        <p className="text-foreground/80 whitespace-pre-line text-sm leading-relaxed">
                          {parsed.reasoning}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Re-run button */}
          {!isAnyLoading && (
            <div className="pt-2">
              <button
                onClick={runAllTests}
                className="text-sm text-primary hover:text-primary/80 underline"
              >
                Run again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
