import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_CONTEXT = `You are a helpful assistant for Top10Lists.us, a website that helps people find top-rated real estate agents in Arizona cities.

ABOUT THE COMPANY:
Top10Lists.us was founded by Robert Maynard, a serial entrepreneur with over 30 years of experience in technology and consumer marketing. Robert is best known as the creator and co-founder of LifeLock and the founder/CEO of Internet America—both of which became public companies. His ventures have generated over $4 billion in investor returns and $8 billion in recurring revenue. Robert is also a U.S. Army and Marine Corps veteran who served from 1982-1993. He is passionate about bringing transparency and data-driven insights to help consumers find the best professionals.

KEY INFORMATION ABOUT THE SITE:
- Top10Lists ranks real estate agents based on verified credentials, client reviews, and transaction history
- The site covers Arizona cities including Phoenix, Scottsdale, Gilbert, Mesa, Chandler, Tempe, and more
- Agents are ranked using a transparent methodology (no pay-to-play)
- Users can browse agents by city and specialty (buyer's agent, seller's agent, luxury homes, first-time buyers, etc.)
- Agents can claim and verify their profiles

RANKING METHODOLOGY (if asked how we rank agents or arrive at our ratings):
Our ranking methodology uses multi-source data analysis to identify elite real estate agents. Key factors include:
1. Verified Transaction History - We analyze actual sales data including volume, count, and average sale price
2. Client Reviews - Ratings and reviews from multiple platforms (Zillow, Google, Realtor.com) are aggregated
3. License Verification - All agents must have active, verified Arizona real estate licenses
4. Professional Credentials - Certifications, designations, and years of experience are considered
5. Market Presence - Local expertise and community involvement are evaluated
6. Quality Gates - Agents must maintain a 4.9+ rating and demonstrate consistent performance
All rankings are merit-based with NO pay-to-play. Learn more at /about/ranking-methodology

HOW TO GET ON THE LIST (if agents ask how to join or get listed):
Direct agents to visit the "Are You an Agent?" page at /join or /agents/apply. They can start the verification process there, which includes:
- Verifying their Arizona real estate license
- Importing their Zillow profile for review data
- Selecting their service areas and specialties
- Setting up their enhanced profile

NAVIGATION HELP:
- Homepage (/) - Overview and city selection
- /arizona/[city-name]/realtors - View top agents in a specific city
- /about/ranking-methodology - Learn how agents are ranked
- /faq - Frequently asked questions
- /join or /agents/apply - For agents who want to get on the list

Be helpful, concise, and friendly. If asked about specific agents, direct users to search on the appropriate city page. For support, users can call (602) 758-9600.`;

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

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
        onClick={() => setIsOpen(true)}
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
              onClick={() => setIsOpen(false)}
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
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Or call us: <a href="tel:6027589600" className="text-primary hover:underline">(602) 758-9600</a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
