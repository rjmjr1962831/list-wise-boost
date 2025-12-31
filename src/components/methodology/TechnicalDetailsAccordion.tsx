import { ChevronDown } from "lucide-react";

/**
 * SEO-friendly accordion using native HTML <details>/<summary> elements.
 * Content is rendered in the DOM on page load (just collapsed via CSS),
 * NOT lazy-loaded on click. This ensures crawlers can still parse it.
 */
export const TechnicalDetailsAccordion = () => {
  return (
    <section className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-center">Technical Details</h2>
        <div className="space-y-4">
          {/* Listing Model Details */}
          <details className="group border border-border rounded-lg">
            <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-foreground hover:bg-muted/50 rounded-lg">
              <span>Listing Model (Organic vs Featured)</span>
              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-0 text-muted-foreground text-sm space-y-4">
              <p>
                All agents in our directory were invited based on verified performance data. We operate similar to search engines: all results are verified and qualified, with optional featured placement for increased visibility.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-border rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">Organic Listings (Free)</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Must meet all selection criteria</li>
                    <li>• Free directory listing</li>
                    <li>• Included in Top 10 rotation</li>
                    <li>• Same scoring methodology</li>
                    <li>• One city</li>
                  </ul>
                </div>
                <div className="border-2 border-accent rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2">Featured Listings (Paid)</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Must meet all selection criteria</li>
                    <li>• Guaranteed Top 10 visibility</li>
                    <li>• Clearly labeled as "Featured"</li>
                    <li>• Same scoring methodology</li>
                    <li>• Multiple cities</li>
                  </ul>
                </div>
              </div>
              <div className="bg-primary/10 rounded-lg p-3">
                <p className="font-semibold text-foreground text-sm mb-1">Featured Placement, Not Featured Scores</p>
                <p className="text-sm">Payment affects visibility only — not scores, rankings, or selection criteria.</p>
              </div>
            </div>
          </details>

          {/* Data Sources with Weights */}
          <details className="group border border-border rounded-lg">
            <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-foreground hover:bg-muted/50 rounded-lg">
              <span>Data Source Weights</span>
              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-0 text-muted-foreground text-sm space-y-4">
              <div>
                <h4 className="font-semibold text-foreground mb-2">Reviews</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border/50"><td className="py-1">Google Business</td><td className="py-1 font-semibold text-primary">10</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1">Zillow</td><td className="py-1 font-semibold">8</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1">Realtor.com</td><td className="py-1 font-semibold">6</td></tr>
                    <tr><td className="py-1">Redfin</td><td className="py-1 font-semibold">5</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Transactions</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border/50"><td className="py-1">Redfin</td><td className="py-1 font-semibold text-primary">9</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1">Zillow</td><td className="py-1 font-semibold">8</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1">Realtor.com</td><td className="py-1 font-semibold">7</td></tr>
                    <tr><td className="py-1">Home.com</td><td className="py-1 font-semibold">5</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-2">Experience Verification</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border/50"><td className="py-1">State License Board</td><td className="py-1 font-semibold text-primary">10</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1">First Recorded Transaction</td><td className="py-1 font-semibold">9</td></tr>
                    <tr className="border-b border-border/50"><td className="py-1">Realtor.com</td><td className="py-1 font-semibold">8</td></tr>
                    <tr><td className="py-1">Zillow</td><td className="py-1 font-semibold">7</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          {/* Press & Awards */}
          <details className="group border border-border rounded-lg">
            <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-foreground hover:bg-muted/50 rounded-lg">
              <span>Press & Awards Scoring</span>
              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-0 text-muted-foreground text-sm space-y-3">
              <div className="border-l-4 border-primary pl-3">
                <div className="flex justify-between"><h4 className="font-semibold text-foreground">Tier 1</h4><span className="text-primary font-semibold">Score: 10</span></div>
                <p>WSJ, NYT, Bloomberg, Forbes, Inman, RealTrends, HousingWire, NAR, azcentral, Phoenix Business Journal, TV appearances</p>
              </div>
              <div className="border-l-4 border-primary/70 pl-3">
                <div className="flex justify-between"><h4 className="font-semibold text-foreground">Tier 2</h4><span className="font-semibold">Score: 9</span></div>
                <p>Awards, Ranking Arizona, Real Producers Magazine</p>
              </div>
              <div className="border-l-4 border-primary/50 pl-3">
                <div className="flex justify-between"><h4 className="font-semibold text-foreground">Tier 3</h4><span className="font-semibold">Score: 8</span></div>
                <p>Fox/NBC/ABC news affiliates</p>
              </div>
              <div className="border-l-4 border-primary/30 pl-3">
                <div className="flex justify-between"><h4 className="font-semibold text-foreground">Tier 4</h4><span className="font-semibold">Score: 5</span></div>
                <p>Other validated sources</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 mt-3">
                <p><strong>Excluded:</strong> Real estate listing sites, social media platforms</p>
              </div>
            </div>
          </details>

          {/* Temporal Decay */}
          <details className="group border border-border rounded-lg">
            <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-foreground hover:bg-muted/50 rounded-lg">
              <span>Temporal Decay (Freshness Multipliers)</span>
              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-0 text-muted-foreground text-sm">
              <p className="mb-3">Recent performance is weighted more heavily to ensure rankings reflect current market activity.</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-semibold">Age of Data</th>
                    <th className="text-left py-2 font-semibold">Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50"><td className="py-2">0–6 months</td><td className="py-2 font-semibold text-primary">1.3×</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2">6–12 months</td><td className="py-2 font-semibold">1.1×</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2">1–2 years</td><td className="py-2 font-semibold">1.0×</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2">2–3 years</td><td className="py-2 font-semibold">0.8×</td></tr>
                  <tr><td className="py-2">3+ years</td><td className="py-2 font-semibold">0.5×</td></tr>
                </tbody>
              </table>
            </div>
          </details>

          {/* Volume Multipliers */}
          <details className="group border border-border rounded-lg">
            <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-foreground hover:bg-muted/50 rounded-lg">
              <span>Volume Multipliers</span>
              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-0 text-muted-foreground text-sm">
              <p className="mb-3">Agents with higher review counts receive bonus multipliers, capped at 300+ reviews.</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-semibold">Review Count</th>
                    <th className="text-left py-2 font-semibold">Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50"><td className="py-2">20–99 reviews</td><td className="py-2 font-semibold">1.0×</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2">100–149 reviews</td><td className="py-2 font-semibold">1.1×</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2">150–199 reviews</td><td className="py-2 font-semibold">1.2×</td></tr>
                  <tr className="border-b border-border/50"><td className="py-2">200–299 reviews</td><td className="py-2 font-semibold">1.3×</td></tr>
                  <tr><td className="py-2">300+ reviews</td><td className="py-2 font-semibold text-primary">1.4× (cap)</td></tr>
                </tbody>
              </table>
            </div>
          </details>

          {/* Conflict Resolution */}
          <details className="group border border-border rounded-lg">
            <summary className="flex items-center justify-between cursor-pointer p-4 font-semibold text-foreground hover:bg-muted/50 rounded-lg">
              <span>Conflict Resolution Hierarchy</span>
              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 pt-0 text-muted-foreground text-sm space-y-2">
              <div><strong className="text-foreground">Reviews:</strong> Google wins → Zillow → others by weight</div>
              <div><strong className="text-foreground">Transactions:</strong> Highest weight source wins</div>
              <div><strong className="text-foreground">Profile Data:</strong> Most recent update wins</div>
              <div><strong className="text-foreground">License Status:</strong> State board overrides all</div>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
};
