export function WhyResultsMayVary() {
  return (
    <div className="bg-muted/30 rounded-lg p-6 h-full">
      <h3 className="text-lg font-semibold mb-3 text-foreground">Why Results May Vary</h3>
      <div className="text-sm text-muted-foreground space-y-3">
        <p>
          If you ask these same AIs in their apps, you might get different 
          answers. That's because AI training data can be months or even 
          years old.
        </p>
        <p>
          Our demo fetches live content from both websites, so every AI 
          evaluates current information. <strong className="text-foreground">This is what they say when 
          given up-to-date data.</strong>
        </p>
        <p className="text-foreground/80 font-medium">
          As AI systems refresh their training throughout 2026, this 
          is where they'll all land.
        </p>
      </div>
    </div>
  );
}
