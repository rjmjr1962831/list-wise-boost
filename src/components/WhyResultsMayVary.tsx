export function WhyResultsMayVary() {
  return (
    <div className="bg-amber-500/5 border-2 border-amber-500/30 rounded-lg p-6 h-full">
      <h3 className="text-2xl font-semibold text-amber-600 dark:text-amber-400 mb-4">Why Results May Vary</h3>
      <div className="space-y-4">
        <p className="text-foreground leading-relaxed">
          AI systems use training data that's months old. Top10Lists.us launched December 2025, so we're not in most training sets yet.
        </p>
        <p className="text-foreground leading-relaxed">
          This comparison bypasses that delay by feeding live content directly to each AI. <strong className="text-foreground">You're seeing what they'll say once their data catches up.</strong>
        </p>
        <p className="text-foreground leading-relaxed">
          The question isn't <em>if</em> AI will recommend merit-based rankings over pay-to-play. It's <em>when</em>. The lists are building now.
        </p>
        <p className="text-foreground leading-relaxed">
          Could Zillow catch up? Not easily. Their business runs on agents paying for placement. To match our trust signals, they'd have to stop selling rankings and rebuild around actual performance data. That's not a feature update. It's a business model rewrite that would gut their revenue. Same story for Realtor.com and HomeLight. We built for AI trust from day one. They'd have to start over.
        </p>
      </div>
    </div>
  );
}
