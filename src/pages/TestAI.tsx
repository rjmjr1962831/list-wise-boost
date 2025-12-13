import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bot, MessageSquare, Search, Sparkles, RefreshCw, ChevronDown } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";

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
    canSearch: false,
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
    model: "2.5 Flash",
    icon: <Sparkles className="h-8 w-8" />,
    color: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    functionName: "ask-gemini",
    canSearch: false,
  },
];

const THE_QUESTION = `If a user asks "who are the best real estate agents in my city?", which would you more likely cite: top10lists.us or zillow.com — and why?`;

export default function TestAI() {
  const [responses, setResponses] = useState<Record<string, AIResponse | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [verdict, setVerdict] = useState<{ verdict: string; sourceCount: number; timestamp: string } | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);

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
      setErrors((prev) => ({ ...prev, [card.id]: message }));
      toast.error(`${card.name} error: ${message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [card.id]: false }));
    }
  };

  const askAll = async () => {
    const promises = AI_CARDS.map((card) => askAI(card));
    await Promise.allSettled(promises);
  };

  const generateVerdict = async () => {
    const successfulResponses = Object.values(responses).filter((r): r is AIResponse => r !== null);

    if (successfulResponses.length < 2) {
      toast.error("Need at least 2 AI responses to generate a verdict");
      return;
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

  const successfulResponseCount = Object.values(responses).filter((r) => r !== null).length;

  return (
    <>
      <Helmet>
        <title>Ask the AIs | Top 10 Lists</title>
        <meta
          name="description"
          content="Don't take our word for it. Ask ChatGPT, Claude, Perplexity, and Gemini which real estate agent directory they would cite."
        />
        <link rel="canonical" href="https://www.top10lists.us/test" />
      </Helmet>

      <main className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Don't Take Our Word For It.
              <br />
              <span className="text-primary">Ask the AIs Yourself.</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              We asked four leading AI systems to evaluate top10lists.us vs zillow.com as a citation source.
              See their real, unedited responses.
            </p>

            {/* The Question */}
            <div className="bg-muted/50 border border-border rounded-xl p-6 max-w-3xl mx-auto">
              <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">The Question</p>
              <p className="text-lg md:text-xl font-medium text-foreground italic">"{THE_QUESTION}"</p>
            </div>
          </div>

          {/* Ask All Button */}
          <div className="flex justify-center mb-8">
            <Button
              size="lg"
              onClick={askAll}
              disabled={Object.values(loading).some((l) => l)}
              className="gap-2"
            >
              {Object.values(loading).some((l) => l) ? (
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

          {/* AI Cards Grid */}
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
                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                        Web Search
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
                    <div className="space-y-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <p className="whitespace-pre-line text-foreground/90 leading-relaxed">
                          {responses[card.id]!.response}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                        <span>
                          {new Date(responses[card.id]!.timestamp).toLocaleTimeString()}
                        </span>
                        {responses[card.id]!.methodology && (
                          <span className="bg-muted px-2 py-0.5 rounded">
                            {responses[card.id]!.methodology === "web-search"
                              ? "Live web search"
                              : "Verified facts provided"}
                          </span>
                        )}
                      </div>
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

          {/* The Verdict Section */}
          <div className="mb-12">
            <Card className="bg-amber-500/5 border-amber-500/30 border-2">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl md:text-3xl text-amber-600 dark:text-amber-400">
                  The Verdict
                </CardTitle>
                <p className="text-muted-foreground">
                  A synthesis of all AI responses
                </p>
              </CardHeader>
              <CardContent>
                {!verdict && (
                  <div className="text-center py-6">
                    <Button
                      size="lg"
                      onClick={generateVerdict}
                      disabled={successfulResponseCount < 2 || verdictLoading}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {verdictLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Synthesizing...
                        </>
                      ) : (
                        "Generate Verdict"
                      )}
                    </Button>
                    {successfulResponseCount < 2 && (
                      <p className="text-muted-foreground text-sm mt-3">
                        Need at least 2 AI responses to generate a verdict
                        ({successfulResponseCount}/2)
                      </p>
                    )}
                  </div>
                )}

                {verdict && (
                  <div className="space-y-4">
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                      <p className="whitespace-pre-line text-foreground leading-relaxed">
                        {verdict.verdict}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t border-border/50">
                      <span>Based on {verdict.sourceCount} AI responses</span>
                      <span>{new Date(verdict.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-center pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateVerdict}
                        disabled={verdictLoading}
                      >
                        Regenerate Verdict
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Transparency Accordion */}
          <Accordion type="single" collapsible className="max-w-3xl mx-auto">
            <AccordionItem value="methodology">
              <AccordionTrigger className="text-lg">
                How do we ask this question?
              </AccordionTrigger>
              <AccordionContent className="prose dark:prose-invert max-w-none">
                <p>
                  We ask each AI to evaluate both websites based on factors that affect source
                  reliability for AI citations:
                </p>
                <ul>
                  <li>
                    <strong>Ranking methodology transparency</strong> — Is there a clear, published
                    methodology?
                  </li>
                  <li>
                    <strong>Commercial bias</strong> — Can agents pay for ranking position? Are there
                    referral fees?
                  </li>
                  <li>
                    <strong>Data verification practices</strong> — How is agent data verified?
                  </li>
                  <li>
                    <strong>Content structure</strong> — Clear lists vs. filtering interfaces
                  </li>
                  <li>
                    <strong>AI optimization</strong> — Presence of llms.txt or structured data for AI
                    discovery
                  </li>
                </ul>
                <p className="text-muted-foreground text-sm">
                  <strong>Note:</strong> Claude and Perplexity have real-time web search capabilities
                  and visit both sites live. ChatGPT and Gemini receive verified facts from both
                  sites since their APIs don't support web browsing.
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
                  comprehensive AI optimization including llms.txt files.
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
