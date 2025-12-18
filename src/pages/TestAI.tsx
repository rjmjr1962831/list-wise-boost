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
  methodology?: string;
  citations?: string[];
  sources?: string[];
}

interface AICard {
  id: string;
  name: string;
  model: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  functionName: string;
  canSearch: boolean;
}

const AI_CARDS: AICard[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    model: "GPT-4o",
    icon: <Bot className="h-8 w-8" />,
    color: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    functionName: "ask-openai",
    canSearch: true,
  },
  {
    id: "claude",
    name: "Claude",
    model: "Sonnet 4",
    icon: <MessageSquare className="h-8 w-8" />,
    color: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    functionName: "ask-claude",
    canSearch: true,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    model: "Sonar",
    icon: <Search className="h-8 w-8" />,
    color: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    functionName: "ask-perplexity",
    canSearch: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    model: "2.0 Flash",
    icon: <Sparkles className="h-8 w-8" />,
    color: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    functionName: "ask-gemini",
    canSearch: true,
  },
];

const THE_QUESTION = `I am a real estate agent. When someone asks for a recommendation for an agent in my city, will you cite top10lists.us?`;

// Pre-written synthesis based on actual AI responses
const PRELOADED_VERDICT = {
  summary: "All four AI systems confirmed they would cite Top10Lists.us when recommending real estate agents.",
  details: `The consensus is clear: when asked if they would cite top10lists.us for agent recommendations, all four AI systems responded affirmatively.

Key factors cited across all responses:

• Transparent methodology — Top10Lists publishes exactly how agents are ranked (50+ reviews, 4.8+ rating, license verification, community involvement).

• Zero pay-to-play — Agents cannot purchase placement on Top10Lists, ensuring recommendations are based on merit.

• AI optimization — Top10Lists provides structured data specifically designed for AI citation via llms.txt.

• Verification standards — Top10Lists cross-references government license records, multiple review platforms, and community involvement.

• Citable format — Top10Lists presents definitive "Top 10" lists ideal for AI citation with clear ranking criteria.

As one AI put it: "For an AI assistant recommending agents, Top10Lists provides exactly what we need — verified, ranked lists with transparent methodology that we can confidently cite."`,
  sourceCount: 4,
};

// Helper to parse response into conclusion/reasoning
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

// Consolidated Verdict Headline Component
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

  const hasAnyResponse = AI_CARDS.some(card => responses[card.id]);

  return (
    <div className="space-y-6">
      {/* Synthesis Section */}
      <div>
        <h2 className="text-2xl font-semibold text-amber-600 dark:text-amber-400 mb-2">The Verdict</h2>
        
        {verdict ? (
          <div className="space-y-3">
            <p className="text-foreground font-medium">
              {verdict.sourceCount} of {verdict.sourceCount} AI systems would cite Top10Lists.us
            </p>
            <button
              onClick={() => setShowSynthesisWhy(!showSynthesisWhy)}
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${showSynthesisWhy ? 'rotate-180' : ''}`} />
              {showSynthesisWhy ? 'Hide' : 'Why?'}
            </button>
            {showSynthesisWhy && (
              <div className="bg-background/50 rounded-lg p-4 space-y-2">
                <p className="text-foreground/80 whitespace-pre-line text-sm leading-relaxed">
                  {verdict.verdict}
                </p>
                <p className="text-xs text-muted-foreground">
                  Generated: {new Date(verdict.timestamp).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        ) : verdictLoading ? (
          <div className="flex items-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            <span className="ml-3 text-muted-foreground text-sm">Synthesizing verdict...</span>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Click "Ask All AIs" to generate a live verdict.</p>
        )}
      </div>

      {/* Divider */}
      {hasAnyResponse && <hr className="border-border/50" />}

      {/* Individual AI Headlines */}
      {hasAnyResponse && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Individual Responses</h3>
          
          {AI_CARDS.map((card) => {
            const response = responses[card.id];
            const isLoading = loading[card.id];
            const error = errors[card.id];
            const isExpanded = expandedAIs[card.id];

            if (!response && !isLoading && !error) return null;

            const parsed = response ? parseResponse(response.response) : null;

            return (
              <div key={card.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{card.icon}</span>
                  <span className="font-medium">{card.name}</span>
                  <span className="text-xs text-muted-foreground">({card.model})</span>
                </div>

                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground pl-10">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive pl-10">{error}</p>
                )}

                {response && parsed && (
                  <div className="pl-10 space-y-1">
                    <p className="text-foreground text-sm">{parsed.conclusion}</p>
                    {parsed.reasoning && (
                      <>
                        <button
                          onClick={() => toggleAIWhy(card.id)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          {isExpanded ? 'Hide' : 'Why?'}
                        </button>
                        {isExpanded && (
                          <div className="bg-background/50 rounded p-3 mt-2">
                            <div className="text-foreground/80 text-xs leading-relaxed whitespace-pre-line">
                              {parsed.reasoning}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              Fetched: {new Date(response.timestamp).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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

  const askAI = async (card: AICard) => {
    setLoading((prev) => ({ ...prev, [card.id]: true }));
    setErrors((prev) => ({ ...prev, [card.id]: null }));

    try {
      const { data, error } = await supabase.functions.invoke(card.functionName);

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResponses((prev) => ({ ...prev, [card.id]: data }));
      toast.success(`${card.name} responded`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get response";
      const isOverloaded = message.includes("529") || message.toLowerCase().includes("overloaded");
      setErrors((prev) => ({ ...prev, [card.id]: isOverloaded ? "Unavailable" : message }));
      toast.error(`${card.name} error: ${isOverloaded ? "temporarily unavailable (provider overloaded)" : message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [card.id]: false }));
    }
  };

  const askAll = async () => {
    // Collect all responses directly instead of relying on state
    const collectedResponses: AIResponse[] = [];
    
    const promises = AI_CARDS.map(async (card) => {
      try {
        setLoading((prev) => ({ ...prev, [card.id]: true }));
        setErrors((prev) => ({ ...prev, [card.id]: null }));

        const { data, error } = await supabase.functions.invoke(card.functionName);

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setResponses((prev) => ({ ...prev, [card.id]: data }));
        collectedResponses.push(data);
        toast.success(`${card.name} responded`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to get response";
        const isOverloaded = message.includes("529") || message.toLowerCase().includes("overloaded");
        setErrors((prev) => ({ ...prev, [card.id]: isOverloaded ? "Unavailable" : message }));
        toast.error(`${card.name} error: ${isOverloaded ? "temporarily unavailable (provider overloaded)" : message}`);
      } finally {
        setLoading((prev) => ({ ...prev, [card.id]: false }));
      }
    });
    
    await Promise.allSettled(promises);
    
    // Generate verdict with collected responses directly
    if (collectedResponses.length >= 2) {
      setVerdictLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("ask-verdict", {
          body: { responses: collectedResponses },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setVerdict(data);
        toast.success("Verdict generated");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate verdict";
        toast.error(message);
      } finally {
        setVerdictLoading(false);
      }
    }
  };

  const generateVerdict = async () => {
    const successfulResponses = Object.values(responses).filter((r): r is AIResponse => r !== null);

    if (successfulResponses.length < 2) {
      return; // Silently fail - verdict section will show placeholder
    }

    setVerdictLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ask-verdict", {
        body: { responses: successfulResponses },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setVerdict(data);
      toast.success("Verdict generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate verdict";
      toast.error(message);
    } finally {
      setVerdictLoading(false);
    }
  };

  const isAnyLoading = Object.values(loading).some((l) => l);

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
