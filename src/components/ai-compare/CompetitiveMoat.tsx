import { Shield, DollarSign, TrendingDown } from "lucide-react";

export const CompetitiveMoat = () => {
  return (
    <section className="py-8">
      <h2 className="text-2xl font-bold mb-6">Why Competitors Can't Easily Replicate This</h2>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <DollarSign className="h-6 w-6 text-destructive" />
            </div>
            <h3 className="font-semibold">Zillow's Dilemma</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            Zillow's Premier Agent program generates significant revenue from pay-to-play advertising. Matching our trust signals would require fundamentally changing their business model.
          </p>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <TrendingDown className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="font-semibold">Referral Fee Models</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            Realtor.com (25-40% fees) and HomeLight (33% fees) depend on steering consumers to agents who pay the most. Merit-based ranking conflicts with their revenue.
          </p>
        </div>

        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold">Our Advantage</h3>
          </div>
          <p className="text-muted-foreground text-sm">
            We built Top10Lists.us from scratch with AI citation as a first-class concern. No legacy business model to protect, no advertising conflicts to manage.
          </p>
        </div>
      </div>

      <p className="mt-6 text-sm text-muted-foreground text-center">
        AI systems prefer sources without commercial bias. Our competitors would need to dismantle their primary revenue streams to match our trust signals.
      </p>
    </section>
  );
};
