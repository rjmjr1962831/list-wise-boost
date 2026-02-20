import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, Signal, Sparkles } from "lucide-react";

interface OverviewSectionProps {
  professional: any;
}

export function OverviewSection({ professional }: OverviewSectionProps) {
  const tierLabel = (professional.current_tier || "certified").replace(/^\w/, (c: string) => c.toUpperCase());

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
            <p className="text-sm leading-relaxed">{professional.selection_rationale}</p>
          </CardContent>
        </Card>
      )}

      {/* Tier & Signal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Signal className="h-5 w-5 text-primary" />
            Your AI Visibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Tier</p>
              <p className="text-lg font-semibold">{tierLabel}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">AI Confident Score (AICS)</p>
              <p className="text-lg font-semibold">
                {professional.signal_score != null ? `${professional.signal_score}/100` : "Pending"}
              </p>
            </div>
          </div>

          {/* Opportunity */}
          {(professional.current_tier === "certified" || professional.current_tier === "listed" || !professional.current_tier) && (
            <div className="pt-2">
              <p className="text-sm font-medium mb-3">
                Increase your tier and see these increases in your AICS:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {professional.current_tier !== "audited" && (
                  <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Audited</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">$100/mo</span>
                    </div>
                    <p className="text-lg font-bold text-amber-700">
                      {professional.audited_projected_signal != null ? `${professional.audited_projected_signal}/100` : "Projected AICS available soon"}
                    </p>
                  </div>
                )}
                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">Underwritten</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">$150/mo</span>
                  </div>
                  <p className="text-lg font-bold text-emerald-700">98/100</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
