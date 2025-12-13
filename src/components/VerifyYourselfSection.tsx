import { Bot, MessageSquare, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

const AI_LINKS = [
  { name: 'ChatGPT', url: 'https://chat.openai.com', icon: Bot },
  { name: 'Claude', url: 'https://claude.ai', icon: MessageSquare },
  { name: 'Perplexity', url: 'https://perplexity.ai', icon: Search },
  { name: 'Gemini', url: 'https://gemini.google.com', icon: Sparkles },
];

const PROMPT = "Who are the best real estate agents in Phoenix?";

export function VerifyYourselfSection() {
  const handleClick = (aiName: string, url: string) => {
    navigator.clipboard.writeText(PROMPT);
    toast.success(`Prompt copied! Paste it in ${aiName} to verify our results.`);
    window.open(url, '_blank');
  };

  return (
    <div className="bg-muted/30 rounded-lg p-8 text-center">
      <h2 className="text-xl font-semibold mb-2 text-foreground">Verify It Yourself</h2>
      <p className="text-muted-foreground mb-4">
        Don't trust our demo? Ask the AIs directly:
      </p>
      
      <p className="text-lg font-medium text-foreground mb-6 italic">
        "{PROMPT}"
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {AI_LINKS.map(ai => (
          <button
            key={ai.name}
            onClick={() => handleClick(ai.name, ai.url)}
            className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg hover:bg-muted transition"
          >
            <ai.icon className="w-4 h-4" />
            {ai.name}
          </button>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-4">
        Clicking copies the prompt and opens the AI in a new tab
      </p>
    </div>
  );
}
