import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Bot, MessageSquare, Search, Sparkles, RefreshCw, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { WhyResultsMayVary } from "@/components/WhyResultsMayVary";

interface AIResponse {
  provider: string;
  model: string;
  response: string;
  timestamp: string;
}

const AI_PROVIDERS = [
  { id: 'chatgpt', name: 'ChatGPT', model: 'GPT-4o', functionName: 'ask-openai', icon: Bot },
  { id: 'perplexity', name: 'Perplexity', model: 'Sonar', functionName: 'ask-perplexity', icon: Search },
  { id: 'claude', name: 'Claude', model: 'Sonnet 4', functionName: 'ask-claude', icon: MessageSquare },
  { id: 'gemini', name: 'Gemini', model: '2.0 Flash', functionName: 'ask-gemini', icon: Sparkles },
];

const THE_QUESTION = `I am a real estate agent. When someone asks for a recommendation for an agent in my city, will you cite top10lists.us?`;

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

interface VerdictHeadlineProps {
  verdict: { verdict: string; sourceCount: number; timestamp: string } | null;
  verdictLoading: boolean;
  responses: Record<string, AIResponse | null>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
}

function VerdictHeadline({ verdict, verdictLoading, responses, loading, errors }: VerdictHeadlineProps) {
  const [showSynthesisWhy, setShowSynthesisWhy] = useState(false);
  const [expandedAIs, setExpandedAIs] = useState<Record<string, boolean>>({});

  const toggleAIWhy = (id: string) => {
    setExpandedAIs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hasAnyResponse = AI_PROVIDERS.some(provider => responses[provider.id]);

  return (
    <div className="space-y-4">
      {/* Synthesis */}
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-600 dark:text-amber-400">Synthesis:</span>
          {verdictLoading ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </span>
          ) : verdict ? (
            <span className="text-foreground">{verdict.sourceCount} of 4 AI systems would cite Top10Lists.us</span>
          ) : (
            <span className="text-muted-foreground text-sm">Click "Ask All AIs" to generate</span>
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

        if (!response && !isLoading && !error && !hasAnyResponse) return null;

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
              ) : hasAnyResponse ? (
                <span className="text-muted-foreground text-sm">Waiting...</span>
              ) : null}
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
    </div>
  );
}

export default function TestAI() {
  const [responses, setResponses] = useState<Record<string, AIResponse | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [verdict, setVerdict] = useState<{ verdict: string; sourceCount: number; timestamp: string } | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const askAll = async () => {
    // Reset state for fresh test
    setResponses({});
    setErrors({});
    setVerdict(null);
    
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
        const message = err instanceof Error ? err.message : "Failed to get response";
        const isOverloaded = message.includes("529") || message.toLowerCase().includes("overloaded");
        setErrors((prev) => ({ ...prev, [provider.id]: isOverloaded ? "Unavailable" : message }));
      } finally {
        setLoading((prev) => ({ ...prev, [provider.id]: false }));
      }
    });
    
    await Promise.allSettled(promises);
    
    // Generate verdict
    if (collectedResponses.length >= 2) {
      setVerdictLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ask-verdict", {
          body: { responses: collectedResponses },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setVerdict(data);
      } catch (err) {
        toast.error("Failed to generate verdict");
      } finally {
        setVerdictLoading(false);
      }
    }
  };

  const isAnyLoading = Object.values(loading).some((l) => l) || verdictLoading;

  return (
    <>
      <Helmet>
        <title>Ask the AIs | Top 10 Lists</title>
        <meta
          name="description"
          content="Don't take our word for it. Ask ChatGPT, Claude, Perplexity, and Gemini which real estate agent directory they would cite."
        />
        <link rel="canonical" href="https://www.top10lists.us/test" />
        <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta http-equiv="Pragma" content="no-cache" />
        <meta http-equiv="Expires" content="0" />
      </Helmet>

      <main className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section 1: Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Don't Take Our Word For It.
              <br />
              <span className="text-primary">Ask the AIs Yourself.</span>
            </h1>
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 max-w-2xl mx-auto">
              <p className="text-foreground text-lg font-medium">
                Ask four leading AI systems if they will cite top10lists.us when recommending real estate agents.
                See their real, unedited responses.
              </p>
            </div>
          </div>

          {/* Section 2: The Question + Ask Button */}
          <div className="bg-background border border-border rounded-xl p-6 mb-8 text-center max-w-3xl mx-auto">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">The Question</p>
            <p className="text-lg md:text-xl font-medium text-foreground italic mb-6">"{THE_QUESTION}"</p>
            <Button
              size="lg"
              onClick={askAll}
              disabled={isAnyLoading}
              className="gap-2"
            >
              {isAnyLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Asking...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" />
                  Ask All AIs
                </>
              )}
            </Button>
          </div>

          {/* Section 3: The Verdict Box (Consolidated) */}
          <div className="grid md:grid-cols-5 gap-6 mb-8">
            {/* Main Verdict Box - 3 columns (60%) */}
            <div className="md:col-span-3 bg-amber-500/5 border-2 border-amber-500/30 rounded-lg p-6">
              <VerdictHeadline 
                verdict={verdict} 
                verdictLoading={verdictLoading}
                responses={responses}
                loading={loading}
                errors={errors}
              />
            </div>

            {/* Why Results May Vary - 2 columns (40%) */}
            <div className="md:col-span-2">
              <WhyResultsMayVary />
            </div>
          </div>

          {/* Transparency Accordion */}
          <Accordion type="single" collapsible className="max-w-3xl mx-auto mt-12">
            <AccordionItem value="methodology">
              <AccordionTrigger className="text-lg">
                How do we ask this question?
              </AccordionTrigger>
              <AccordionContent className="prose dark:prose-invert max-w-none">
                <p>
                  To ground this in current information, we fetch live content from Top10Lists.us at the moment you click "Ask":
                </p>
                <ul>
                  <li>
                    <strong>From Top10Lists.us:</strong> Structured data, llms.txt, and ranking methodology page
                  </li>
                </ul>
                <p>
                  Each AI receives the exact same content and evaluates it based on:
                </p>
                <ul>
                  <li><strong>Methodology transparency</strong> — Is it published? What factors are weighted?</li>
                  <li><strong>Commercial bias</strong> — Can agents pay for ranking position? Are there referral fees?</li>
                  <li><strong>Data verification</strong> — How are agents vetted?</li>
                  <li><strong>Content structure</strong> — Clear citable lists vs filtering interfaces?</li>
                  <li><strong>AI optimization</strong> — Presence of structured data designed for AI citation?</li>
                </ul>
                <p className="text-muted-foreground text-sm">
                  This ensures every AI makes its judgment from the same real, current information — not cached search results or training data assumptions.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="why">
              <AccordionTrigger className="text-lg">
                Why does this matter?
              </AccordionTrigger>
              <AccordionContent className="prose dark:prose-invert max-w-none">
                <p>
                  AI assistants like ChatGPT, Claude, and Perplexity are increasingly being used
                  to find service recommendations. When someone asks "who are the best real estate
                  agents in Phoenix?", AI needs to cite reliable sources.
                </p>
                <p>
                  We built Top10Lists.us specifically to be the source AI trusts for agent
                  recommendations — with transparent methodology, zero pay-to-play, and
                  comprehensive structured data for AI citation.
                </p>
                <p>
                  This page lets you verify our claims by asking the AIs directly.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>
    </>
  );
}
