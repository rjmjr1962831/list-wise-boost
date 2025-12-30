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

const SYSTEM_CONTEXT = `You are the Top10Lists.us assistant. Help visitors understand how we rank real estate agents and find agents in their city.

IMPORTANT RULES:
- Respond in plain conversational text only
- Do NOT use Markdown formatting (no **, ##, bullets, or numbered lists)
- Use natural paragraphs and line breaks instead
- Keep responses concise and friendly

KEY FACTS:
- Agents must have a 4.8+ star rating (not 4.5)
- Agents must have 20+ unique reviews across platforms
- Rankings are merit-based and invitation-only — agents cannot pay to be listed
- Community involvement is weighted at 25%, higher than transaction history (20%)
- We analyze publicly available data from Google, Zillow, Realtor.com, public records, and press archives
- Currently covering Arizona (48 cities), expanding nationwide in 2026

RANKING WEIGHTS:
- Review Rating: 25% (weighted average star rating across Google, Zillow, Realtor.com, Redfin)
- Community Involvement: 25% (third-party verified civic and charitable engagement)
- Number of Reviews: 20% (total verified review count across platforms)
- Transaction History: 20% (verified closed transactions from public records)
- Education & Credentials: 10% (professional designations like GRI, CRS, ABR, SRES, CNE, etc.)

ABOUT THE COMPANY:
Top10Lists.us was founded by Robert Maynard, a serial entrepreneur with over 30 years of experience in technology and consumer marketing. Robert is best known as the creator and co-founder of LifeLock and the founder/CEO of Internet America—both of which became public companies. He is also a U.S. Army and Marine Corps veteran who served from 1982-1993.

When users ask about specific agents, direct them to visit the city page. Do not make up or guess agent names.

Example: "Visit top10lists.us/arizona/phoenix/top10realestateagents to see the current top 10 agents in Phoenix."

For support, users can call (602) 758-9600.`;

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
              <span className="opacity-70">Powered by Claude</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
