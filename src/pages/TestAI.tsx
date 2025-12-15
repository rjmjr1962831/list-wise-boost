import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bot, MessageSquare, Search, Sparkles, RefreshCw, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

const THE_QUESTION = `If a user asks "who are the best real estate agents in my city?", which would you more likely cite: top10lists.us or zillow.com — and why?`;

// Pre-written synthesis based on actual AI responses
const PRELOADED_VERDICT = {
  summary: "All four AI systems independently concluded that Top10Lists.us is the more reliable citation source for real estate agent recommendations.",
  details: `The consensus is clear: when given current information from both websites, every AI evaluated Top10Lists.us as the superior source for agent recommendations.

Key factors cited across all responses:

• Transparent methodology — Top10Lists publishes exactly how agents are ranked (50+ reviews, 4.8+ rating, license verification, community involvement). Zillow's "Premier Agent" rankings are based on advertising spend.

• Zero pay-to-play — Agents cannot purchase placement on Top10Lists. Zillow's business model depends on agents paying for visibility.

• AI optimization — Top10Lists provides structured data specifically designed for AI citation. Zillow offers no equivalent.

• Verification standards — Top10Lists cross-references government license records, multiple review platforms, and community involvement. Zillow relies primarily on self-reported information.

• Citable format — Top10Lists presents definitive "Top 10" lists ideal for AI citation. Zillow presents filtering interfaces that produce different results based on user inputs.

As one AI put it: "For an AI assistant recommending agents, Top10Lists provides exactly what we need — verified, ranked lists with transparent methodology that we can confidently cite."`,
  sourceCount: 4,
};

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
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We asked four leading AI systems to evaluate top10lists.us vs zillow.com as a citation source.
              See their real, unedited responses.
            </p>
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

          {/* Section 3: The Verdict + Why Results May Vary (Two Columns) */}
          <div className="grid md:grid-cols-5 gap-6 mb-8">
            {/* Verdict - 3 columns (60%) */}
            <div className="md:col-span-3 bg-amber-500/5 border-2 border-amber-500/30 rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-amber-600 dark:text-amber-400 mb-1">The Verdict</h2>
              
              {verdict ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">A synthesis of {verdict.sourceCount} AI responses</p>
                  <p className="text-sm text-muted-foreground italic mb-4">Detailed results below ↓</p>
                  <p className="text-foreground whitespace-pre-line leading-relaxed">
                    {verdict.verdict}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Generated:</strong> {new Date(verdict.timestamp).toLocaleString()}
                  </p>
                </div>
              ) : verdictLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  <span className="ml-3 text-muted-foreground">Synthesizing verdict...</span>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-muted-foreground">Click "Ask All AIs" to generate a live verdict from all four AI systems.</p>
                </div>
              )}
            </div>

            {/* Why Results May Vary - 2 columns (40%) */}
            <div className="md:col-span-2">
              <WhyResultsMayVary />
            </div>
          </div>

          {/* Section 4: Individual AI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {AI_CARDS.map((card) => (
              <Card key={card.id} className={`${card.color} ${card.borderColor} border-2`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-foreground">{card.icon}</div>
                    <div>
                      <CardTitle className="text-xl">{card.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{card.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.canSearch && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full">
                        Live Fetch
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => askAI(card)}
                      disabled={loading[card.id]}
                    >
                      {loading[card.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading[card.id] && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="ml-3 text-muted-foreground">Thinking...</span>
                    </div>
                  )}

                  {errors[card.id] && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                      <p className="text-destructive text-sm">{errors[card.id]}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => askAI(card)}
                      >
                        Retry
                      </Button>
                    </div>
                  )}

                  {responses[card.id] && !loading[card.id] && (
                    <div className="space-y-4">
                      {/* Timestamp first */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pb-2 border-b border-border/50">
                        <span>
                          <strong>Fetched:</strong> {new Date(responses[card.id]!.timestamp).toLocaleString()}
                        </span>
                        {responses[card.id]!.methodology && (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                            {responses[card.id]!.methodology === "live-fetch"
                              ? "Live content fetched"
                              : responses[card.id]!.methodology === "web-search"
                              ? "Live web search"
                              : "Verified facts provided"}
                          </span>
                        )}
                      </div>
                      
                      {(() => {
                        const fullResponse = responses[card.id]!.response;
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
                        
                        return (
                          <>
                            <div>
                              <h4 className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">
                                Conclusion
                              </h4>
                              <p className="text-foreground font-medium leading-relaxed">
                                {conclusion}
                              </p>
                            </div>
                            
                            {reasoning && (
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
                          </>
                        );
                      })()}
                      
                      {responses[card.id]!.citations && responses[card.id]!.citations!.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Citations: </span>
                          {responses[card.id]!.citations!.slice(0, 3).map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline mr-2"
                            >
                              [{i + 1}]
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!loading[card.id] && !errors[card.id] && !responses[card.id] && (
                    <p className="text-muted-foreground text-center py-8">
                      Click "Ask" to get {card.name}'s response
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>


          {/* Transparency Accordion */}
          <Accordion type="single" collapsible className="max-w-3xl mx-auto mt-12">
            <AccordionItem value="methodology">
              <AccordionTrigger className="text-lg">
                How do we ask this question?
              </AccordionTrigger>
              <AccordionContent className="prose dark:prose-invert max-w-none">
                <p>
                  For a fair comparison, we fetch live content from both websites at the moment you click "Ask":
                </p>
                <ul>
                  <li>
                    <strong>From Top10Lists.us:</strong> Structured data and ranking methodology page
                  </li>
                  <li>
                    <strong>From Zillow.com:</strong> Premier Agent page and available structured data
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
