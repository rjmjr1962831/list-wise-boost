export const SimplifiedDataSources = () => {
  return (
    <section className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">Data Sources</h2>
        <div className="space-y-3 text-foreground">
          <div className="flex items-start gap-2">
            <span className="font-semibold shrink-0">Reviews:</span>
            <span className="text-muted-foreground">Google, Zillow, Realtor.com, Redfin</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold shrink-0">Transactions:</span>
            <span className="text-muted-foreground">Public records, MLS</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold shrink-0">Licenses:</span>
            <span className="text-muted-foreground">State boards</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-semibold shrink-0">Community:</span>
            <span className="text-muted-foreground">Nonprofit records, local news, 990s</span>
          </div>
        </div>
      </div>
    </section>
  );
};
