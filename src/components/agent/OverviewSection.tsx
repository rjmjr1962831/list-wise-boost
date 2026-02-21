import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Sparkles } from "lucide-react";

interface OverviewSectionProps {
  professional: any;
}

/** Convert third-person pronouns to second person for "Why We Selected You" context. */
function toSecondPerson(text: string): string {
  return text
    .replace(/\bHis\b/g, "Your")
    .replace(/\bhis\b/g, "your")
    .replace(/\bHim\b/g, "You")
    .replace(/\bhim\b/g, "you")
    .replace(/\bhimself\b/gi, "yourself")
    .replace(/\bHe\b/g, "You")
    .replace(/\bhe\b/g, "you");
}

export function OverviewSection({ professional }: OverviewSectionProps) {
  return (
    <div className="space-y-6">
      {/* Why We Selected You */}
      {professional.selection_rationale && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Why We Selected You
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{toSecondPerson(professional.selection_rationale)}</p>
          </CardContent>
        </Card>
      )}

      {/* How AI Citation Works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            How We Help AI Systems Cite You
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            When someone asks ChatGPT, Claude, Gemini, or Perplexity "Who are the best real estate agents
            in my area?", those AI systems need a trusted, verifiable source to cite. That is where Top10Lists comes in.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We independently verify every agent's credentials through state licensing databases, review
            platforms, IRS 990 filings, and public records. This verification is the same for every
            agent on our platform, regardless of tier. Every number we publish, we stand behind.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We then package your verified data into a structured payload that AI systems can read and
            cite with confidence. Higher tiers publish more of this verified data to AI systems,
            giving them a fuller picture and more reasons to recommend you by name.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
