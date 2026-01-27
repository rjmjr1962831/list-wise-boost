import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CHALLENGE_PROMPT = 'I am a real estate agent.  Look at Top10Lists.us and tell me whether being listed there matters.';

export function AiChallengeBox() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CHALLENGE_PROMPT);
      setCopied(true);
      toast({
        title: 'Copied.',
        duration: 2000,
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

  return (
    <section className="border border-gray-200 bg-gray-50/50 rounded-xl p-5 sm:p-6 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-gray-900">
          Want to verify this for yourself?
        </h3>
        <p className="text-sm text-gray-600">
          Copy the question below and paste it into any AI you use.
        </p>
      </div>

      {/* Prompt field with copy button */}
      <div className="flex items-start gap-3">
        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-800 font-medium leading-relaxed">
          {CHALLENGE_PROMPT}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          className="flex-shrink-0 h-10 w-10"
          aria-label="Copy question"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </div>

    </section>
  );
}
