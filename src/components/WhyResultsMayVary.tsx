export function WhyResultsMayVary() {
  return (
    <div className="bg-muted/30 rounded-lg p-6 h-full">
      <h3 className="text-lg font-semibold mb-3 text-foreground">Why Results May Vary</h3>
      <div className="text-sm text-muted-foreground space-y-3">
        <p>
          AI systems use training data that's months old. Top10Lists.us launched December 2025, so we're not in most training sets yet.
        </p>
        <p>
          This comparison bypasses that delay by feeding live content directly to each AI. <strong className="text-foreground">You're seeing what they'll say once their data catches up.</strong>
        </p>
        <p className="text-foreground/80 font-medium">
          The question isn't <em>if</em> AI will recommend merit-based rankings over pay-to-play. It's <em>when</em>. The lists are building now.
        </p>
      </div>
    </div>
  );
}
