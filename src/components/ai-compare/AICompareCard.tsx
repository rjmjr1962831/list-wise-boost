import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface AICompareCardProps {
  aiName: string;
  model: string;
  logoUrl?: string;
  conclusion: string;
  reasoning: string;
  positiveNotes: string[];
  timestamp: string;
}

export const AICompareCard = ({
  aiName,
  model,
  logoUrl,
  conclusion,
  reasoning,
  positiveNotes,
  timestamp,
}: AICompareCardProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={aiName} className="h-8 w-8 rounded" />
            ) : (
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                {aiName.charAt(0)}
              </div>
            )}
            <div>
              <CardTitle className="text-lg">{aiName}</CardTitle>
              <p className="text-sm text-muted-foreground">{model}</p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <ExternalLink className="h-3 w-3 mr-1" />
            Live Fetch
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground mb-1">Conclusion</h4>
          <p className="text-foreground font-medium">{conclusion}</p>
        </div>

        <div>
          <h4 className="font-semibold text-sm text-muted-foreground mb-2">Key Points</h4>
          <ul className="space-y-1.5">
            {positiveNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        {expanded && (
          <div className="pt-2 border-t">
            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Full Reasoning</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{reasoning}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">Generated: {timestamp}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-xs"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Show Full Response
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
