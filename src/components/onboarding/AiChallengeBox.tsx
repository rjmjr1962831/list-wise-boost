import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, ExternalLink, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const AI_TOOLS = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Gemini', url: 'https://gemini.google.com/' },
  { name: 'Claude', url: 'https://claude.ai/' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai/' },
];

const CHALLENGE_PROMPT = 'I am a real estate agent.  Look at top10lists.us and tell me whether being listed there matters.';

const STORAGE_KEY_RESPONSE = 'ai_challenge_response';
const STORAGE_KEY_LAST_AI = 'ai_challenge_last_opened';
const STORAGE_KEY_TIMESTAMP = 'ai_challenge_timestamp';

interface AiChallengeBoxProps {
  professionalId: string;
  token: string;
  onContinue: (response: string, lastAiOpened: string | null) => void;
  onSkip: () => void;
}

export function AiChallengeBox({ professionalId, token, onContinue, onSkip }: AiChallengeBoxProps) {
  const { toast } = useToast();
  const [response, setResponse] = useState('');
  const [lastAiOpened, setLastAiOpened] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storageKey = `${STORAGE_KEY_RESPONSE}_${token}`;
    const savedResponse = localStorage.getItem(storageKey);
    const savedAi = localStorage.getItem(`${STORAGE_KEY_LAST_AI}_${token}`);
    
    if (savedResponse) {
      setResponse(savedResponse);
    }
    if (savedAi) {
      setLastAiOpened(savedAi);
    }
  }, [token]);

  // Save to localStorage when response changes
  useEffect(() => {
    if (response) {
      localStorage.setItem(`${STORAGE_KEY_RESPONSE}_${token}`, response);
      localStorage.setItem(`${STORAGE_KEY_TIMESTAMP}_${token}`, new Date().toISOString());
    }
  }, [response, token]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CHALLENGE_PROMPT);
      setCopied(true);
      toast({
        title: 'Copied to clipboard',
        description: 'Paste this question into any AI tool.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Could not copy',
        description: 'Please select and copy the text manually.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenAi = (toolName: string, url: string) => {
    setLastAiOpened(toolName);
    localStorage.setItem(`${STORAGE_KEY_LAST_AI}_${token}`, toolName);
    setShowHelper(true);

    // Try to open in new tab
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    
    // If popup was blocked, ask user before opening in same tab
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      const confirmed = window.confirm(
        `Your browser blocked the popup.  Open ${toolName} in this tab instead?  You can come back using your browser's back button.`
      );
      if (confirmed) {
        window.location.href = url;
      }
    }
  };

  const handleContinue = () => {
    onContinue(response, lastAiOpened);
  };

  const isValid = response.trim().length >= 40;

  return (
    <section className="border border-gray-200 bg-gray-50/50 rounded-xl p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">
          Want to verify this for yourself?
        </h3>
        <p className="text-sm text-gray-600">
          Ask any AI tool the question below.  Then paste the answer here.
        </p>
      </div>

      {/* Prompt field */}
      <div className="space-y-2">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800 font-medium leading-relaxed">
          {CHALLENGE_PROMPT}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyPrompt}
          className="text-sm"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-1.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-1.5" />
              Copy question
            </>
          )}
        </Button>
      </div>

      {/* AI tool buttons */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {AI_TOOLS.map((tool) => (
            <Button
              key={tool.name}
              variant="outline"
              size="sm"
              onClick={() => handleOpenAi(tool.name, tool.url)}
              className="text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open {tool.name}
            </Button>
          ))}
        </div>
        {showHelper && (
          <p className="text-xs text-gray-500 italic">
            After you get an answer, come back and paste it here.
          </p>
        )}
      </div>

      {/* Response textarea */}
      <div className="space-y-2">
        <label htmlFor="ai-response" className="text-sm font-medium text-gray-700">
          Paste the AI answer here
        </label>
        <Textarea
          id="ai-response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Paste what the AI said.  A few sentences is enough."
          className="min-h-[100px] text-sm resize-none"
        />
        {response.length > 0 && response.length < 40 && (
          <p className="text-xs text-gray-500">
            {40 - response.length} more characters needed
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
        <Button
          onClick={handleContinue}
          disabled={!isValid}
          className="bg-gray-900 hover:bg-gray-800 text-white px-6 h-10 text-sm font-semibold"
        >
          Continue
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          Skip for now
        </button>
      </div>

      {/* Why this works disclosure */}
      <Collapsible open={whyOpen} onOpenChange={setWhyOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          {whyOpen ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          Why this works
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <p className="text-xs text-gray-600 leading-relaxed">
            AI tools prefer sources they can verify and explain.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
