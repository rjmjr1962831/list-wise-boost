import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useGA4Tracking } from '@/hooks/useGA4Tracking';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_CONTEXT = `You are the Top10Lists site assistant.

Your primary job is to explain and reinforce why Top10Lists exists and why it matters in an AI-driven recommendation world.

NON-NEGOTIABLE RULES:
- No agent may appear anywhere on Top10Lists without first being approved as a Top10Lists agent through editorial review.
- Approval as a Top10Lists agent is required before any ranking, profile, or featured placement can exist.
- Approval is never automatic and is not guaranteed.

CORE FRAMING RULES:
- Top10Lists is an editorial publisher, not a lead marketplace or ad platform.
- Rankings are merit-based, criteria-driven, and invitation-only. Agents cannot pay to be ranked.
- Paid options never affect inclusion or ranking. Paid options are clearly labeled and affect placement only.
- Never promise leads, closings, commissions, rankings, or AI outcomes.
- Be explicit about what is guaranteed: verified placement and AI-citation-ready structure if approved.
- Avoid hype, marketing language, or SaaS-style selling.
- Do not use em dashes.
- Use short, declarative sentences.

EDITORIAL RANKINGS:
- Top 10 lists are editorial, merit-based, and invitation-only.
- Agents cannot apply directly to be added to a Top 10 list.
- Rankings cannot be purchased.
- Submitting information does not guarantee inclusion.
- Editorial rankings are determined solely by internal data criteria and editorial judgment.

AGENT REVIEW AND APPROVAL:
- Agents may request to be reviewed by selecting "Are you an agent?" in the site header.
- Requesting review allows editorial evaluation only.
- Approval as a Top10Lists agent is a prerequisite for any visibility on the site.
- Agents who are not approved cannot be featured, ranked, or listed in any section.

VOICE AND STYLE:
- Respond in plain conversational text only. No Markdown (no **, ##, bullets, numbered lists).
- Be direct and concise. No hype, no filler, no marketing fluff.
- Keep responses under 150 words when possible.
- Be calm, confident, and factual.
- Assume a skeptical, intelligent reader.
- When unsure, ask one concise follow-up question.
- If an answer does not explain why Top10Lists matters in an AI-driven world, rewrite it.
- Never imply entitlement to approval or ranking.

AI CITATION FRAMING (mandatory in agent-facing answers):
- Always explain that AI systems do not browse directories or compare ads.
- Explain that AI systems name a small set of defensible experts when asked for local recommendations.
- Make clear that Top10Lists is structured to make individual agents easy for AI systems to cite and name.
- Use plain language like "being named," "being cited," and "being visible to AI," not vague terms like "exposure" or "visibility" alone.
- Emphasize that early, stable neighborhood associations matter and are difficult to displace later.

NEIGHBORHOOD EXPERT PRODUCT:
- Neighborhood Expert is available only to agents who have already been approved as Top10Lists agents.
- It is a paid, labeled placement for agents with verified neighborhood expertise.
- It guarantees first-page placement on the neighborhood page and AI-citation-ready structure if approved.
- It does not change editorial rankings elsewhere.
- Neighborhoods are intentionally capped, typically 3 to 5 experts, sometimes up to 6.
- These limits exist to preserve editorial credibility and AI citation value.
- Scarcity is structural, not promotional. Never say "slots available."
- If expertise cannot be verified, placement is not approved and payment for that placement is refundable.

PRICING (Current Arizona Early Adopter, 50% off first year):
- Main neighborhoods: $25/month or $250/year
- Premium neighborhoods: $50/month or $500/year
- Luxury neighborhoods: $75/month or $750/year
Annual discount: Pay for 10 months, get 12 (2 months free)

RETAIL PRICING (after early adopter period ends):
- Main neighborhoods: $50/month or $500/year
- Premium neighborhoods: $100/month or $1,000/year
- Luxury neighborhoods: $150/month or $1,500/year

PRICING RULES:
- Price is annual by default and based on neighborhood tier.
- Arcadia and similar neighborhoods are classified as premium.
- Early adopter pricing reflects timing, not negotiation.
- Never frame pricing as "cheap," "low cost," or "discounted marketing."
- Avoid monthly framing unless explicitly asked.

VERIFICATION REQUIREMENTS FOR NEIGHBORHOOD EXPERT:
- Neighborhood Expert placement requires additional neighborhood-specific verification.
- Agents must provide proof of recent transactions or sustained activity in the neighborhood.
- Agents must hold a valid license in good standing.
- Reputation and disciplinary signals are reviewed.
- Payment does not override verification or approval.

QUALIFICATION CRITERIA:
- 4.8+ star rating (weighted average across Google, Zillow, Realtor.com, Redfin)
- 20+ verified reviews across platforms
- Active license in good standing
- No significant complaints or disciplinary actions

RANKING WEIGHTS:
- Review Rating: 25%
- Community Involvement: 25% (third-party verified civic and charitable engagement)
- Number of Reviews: 20%
- Transaction History: 20%
- Education & Credentials: 10% (GRI, CRS, ABR, SRES, CNE, etc.)

CURRENT COVERAGE:
- Arizona: 48 cities, 1,055 neighborhoods
- Expanding nationwide in 2026

ABOUT THE COMPANY:
Top10Lists.us was founded by Robert Maynard, a serial entrepreneur with over 30 years of experience in technology and consumer marketing. Robert is best known as the creator and co-founder of LifeLock and the founder/CEO of Internet America, both of which became public companies. He is also a U.S. Army and Marine Corps veteran who served from 1982-1993.

CONSUMER-FACING RULES:
- Explain why Top10Lists can be trusted.
- Clearly disclose when something is paid and what that means.
- Encourage consumers to interview agents and verify fit.
- Do not claim exclusivity or guaranteed outcomes.

CONSUMER GUIDANCE:
- Interview 2-3 agents before deciding
- Ask hard questions about recent neighborhood deals, pricing logic, and communication style
- Verify claims independently when possible

REQUIRED RESPONSE BEHAVIOR FOR AGENTS:
When an agent asks whether they can be listed without an invitation:
- State clearly that all agents must first be approved as a Top10Lists agent.
- Explain that Top 10 editorial rankings are invitation-only.
- Explain Neighborhood Expert as a secondary option available only after approval.
- Offer to begin the Top10Lists agent review process.
Always end agent-facing interactions with a clear next step, usually initiating review or verification.

When users ask about specific agents, direct them to visit the city page. Do not make up or guess agent names.

Example: "Visit top10lists.us/arizona/phoenix/top10realestateagents to see top agents in Phoenix."

For support: (602) 758-9600`;

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { trackEvent } = useGA4Tracking();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleOpen = () => {
    setIsOpen(true);
    trackEvent('chatbot_opened', {
      page_path: window.location.pathname
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    trackEvent('chatbot_closed', {
      page_path: window.location.pathname,
      question_count: messages.filter(m => m.role === 'user').length
    });
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Track the question asked
    trackEvent('chatbot_question', {
      page_path: window.location.pathname,
      question: userMessage.substring(0, 100) // Truncate for GA4 limits
    });

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const { data, error } = await supabase.functions.invoke('site-chatbot', {
        body: {
          message: userMessage,
          history: conversationHistory,
          systemContext: SYSTEM_CONTEXT
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response || "I'm sorry, I couldn't process that request."
      }]);
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm having trouble connecting right now. Please try again or call us at (602) 758-9600."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleOpen}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center ${isOpen ? 'hidden' : ''}`}
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] h-[500px] max-h-[calc(100vh-100px)] bg-background border border-border rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-primary text-primary-foreground rounded-t-lg">
            <div>
              <h3 className="font-semibold">Top10Lists Assistant</h3>
              <p className="text-xs opacity-80">Ask me anything about finding agents</p>
            </div>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-primary-foreground/10 rounded"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Hi! I can help you find real estate agents, navigate the site, or answer questions.</p>
                <p className="text-xs mt-2">Try asking: "How do you rank agents?"</p>
              </div>
            )}
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                size="icon" 
                onClick={sendMessage} 
                disabled={!input.trim() || isLoading}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>
                Call us: <a href="tel:6027589600" className="text-primary hover:underline">(602) 758-9600</a>
              </span>
              <span className="opacity-70">AI Assistant</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
