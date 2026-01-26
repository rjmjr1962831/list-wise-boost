import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

export function AiChallengeBox() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);

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
    setShowHelper(true);
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      const confirmed = window.confirm(
        `Your browser blocked the popup.  Open ${toolName} in this tab instead?  You can come back using your browser's back button.`
      );
      if (confirmed) {
        window.location.href = url;
      }
    }
  };

  return (
    <section className="border border-gray-200 bg-gray-50/50 rounded-xl p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">
          Want to verify this for yourself?
        </h3>
        <p className="text-sm text-gray-600">
          Ask any AI tool you already use the question below.
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
            After you get an answer, return here to continue.
          </p>
        )}
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
