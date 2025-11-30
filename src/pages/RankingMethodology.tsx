import { Helmet } from "react-helmet-async";
import { Card, CardContent } from "@/components/ui/card";
import { useGA4Tracking } from "@/hooks/useGA4Tracking";
import { useEffect } from "react";
import { CheckCircle2, Scale, TrendingUp, Award, Clock, AlertCircle } from "lucide-react";

const RankingMethodology = () => {
  const { trackEvent } = useGA4Tracking();

  useEffect(() => {
    trackEvent('page_view', {
      page_path: '/about/ranking-methodology'
    });
  }, [trackEvent]);

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": "Top10Lists.us Agent Selection Methodology",
    "description": "A rigorous, invitation-only methodology for identifying elite real estate agents in Arizona based on multi-source verified performance data.",
    "step": [
      {
        "@type": "HowToStep",
        "position": 1,
        "name": "Data Collection",
        "text": "Continuously monitor agent performance data from multiple authoritative sources including Google Business, Zillow, Realtor.com, Redfin, Home.com, and press outlets."
      },
      {
        "@type": "HowToStep",
        "position": 2,
        "name": "Criteria Screening",
        "text": "Identify agents meeting selection criteria: minimum 50 unique reviewers, minimum 4.8 weighted average rating, and minimum 6 years verified market experience."
      },
      {
        "@type": "HowToStep",
        "position": 3,
        "name": "Source Weighting",
        "text": "Apply differential weights to data sources based on reliability: Google reviews (weight 10), Zillow (8), Realtor.com (6), Redfin (5)."
      },
      {
        "@type": "HowToStep",
        "position": 4,
        "name": "Temporal Analysis",
        "text": "Apply freshness multipliers ranging from 1.3x (0-6 months) to 0.5x (3+ years) to prioritize agents with consistent recent performance."
      },
      {
        "@type": "HowToStep",
        "position": 5,
        "name": "Editorial Review",
        "text": "Conduct editorial review of eligible candidates to ensure directory quality and appropriate market coverage before extending invitations."
      },
      {
        "@type": "HowToStep",
        "position": 6,
        "name": "Continuous Monitoring",
        "text": "Perform daily checks on all listed agents with immediate removal if performance falls below selection criteria."
      }
    ]
  };

  return (
    <>
      <Helmet>
        <title>Selection Methodology | Top10Lists.us</title>
        <meta 
          name="description" 
          content="Learn how Top10Lists.us identifies and invites Arizona's elite real estate agents to our exclusive directory using multi-source data analysis and rigorous selection criteria." 
        />
        <link rel="canonical" href="https://top10lists.us/about/ranking-methodology" />
        <script type="application/ld+json">
          {JSON.stringify(howToSchema)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Breadcrumbs */}
        <div className="container mx-auto px-4 pt-6">
          <nav className="text-sm text-muted-foreground">
            <a href="/" className="hover:text-primary">Home</a>
            <span className="mx-2">/</span>
            <a href="/about" className="hover:text-primary">About</a>
            <span className="mx-2">/</span>
            <span className="text-foreground">Selection Methodology</span>
          </nav>
        </div>

        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-12 pb-8">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <div className="inline-block bg-accent/20 text-accent px-4 py-1.5 rounded-full text-sm font-semibold uppercase tracking-wide mb-2">
              Invitation Only
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Selection Methodology
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              How we identify and invite Arizona's elite real estate agents using multi-source verified data and rigorous selection criteria.
            </p>
          </div>
        </section>

        {/* Overview */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Scale className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h2 className="text-2xl font-bold mb-3">Overview</h2>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      Top10Lists.us is an <strong>invitation-only</strong> directory of elite real estate agents in Arizona. Agents cannot apply or pay to be listed. We identify top performers through rigorous multi-source data analysis and extend invitations to agents who demonstrate exceptional, verified performance.
                    </p>
                    <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold text-foreground">
                        No Applications. No Paid Placements.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        We do not accept applications, paid placements, or advertising. Every agent in our directory was identified through data analysis and invited based on verified performance metrics.
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      <strong>Note:</strong> Meeting our criteria does not guarantee inclusion. Final selection involves editorial review to ensure directory quality and market coverage.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Selection Criteria */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">Selection Criteria</h2>
            <p className="text-muted-foreground text-center mb-8">
              To be considered for invitation, agents must demonstrate exceptional performance across all criteria. Agents who fall below these thresholds are removed from the directory immediately.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6 text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold">50+ Reviews</h3>
                  <p className="text-sm text-muted-foreground">
                    Minimum 50 unique reviewers combined across Google, Zillow, Realtor.com, and Redfin
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Award className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold">4.8★ Rating</h3>
                  <p className="text-sm text-muted-foreground">
                    Minimum 4.8 weighted average rating across all data sources
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold">6+ Years</h3>
                  <p className="text-sm text-muted-foreground">
                    Minimum 6 years of verified market experience
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Data Sources */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <h2 className="text-3xl font-bold text-center">Data Sources</h2>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Reviews (by weight priority)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4 font-semibold">Source</th>
                        <th className="text-left py-2 px-4 font-semibold">Weight</th>
                        <th className="text-left py-2 px-4 font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">Google Business</td>
                        <td className="py-2 px-4 font-semibold text-primary">10</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground">Primary authority, hardest to manipulate</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">Zillow</td>
                        <td className="py-2 px-4 font-semibold">8</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">Realtor.com</td>
                        <td className="py-2 px-4 font-semibold">6</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4">Redfin</td>
                        <td className="py-2 px-4 font-semibold">5</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Transactions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4 font-semibold">Source</th>
                        <th className="text-left py-2 px-4 font-semibold">Weight</th>
                        <th className="text-left py-2 px-4 font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">Redfin</td>
                        <td className="py-2 px-4 font-semibold text-primary">9</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground">Direct MLS access</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">Zillow</td>
                        <td className="py-2 px-4 font-semibold">8</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">Realtor.com</td>
                        <td className="py-2 px-4 font-semibold">7</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4">Home.com</td>
                        <td className="py-2 px-4 font-semibold">5</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Experience Verification</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4 font-semibold">Source</th>
                        <th className="text-left py-2 px-4 font-semibold">Weight</th>
                        <th className="text-left py-2 px-4 font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">State License Board</td>
                        <td className="py-2 px-4 font-semibold text-primary">10</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground">Ground truth</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">First Recorded Transaction</td>
                        <td className="py-2 px-4 font-semibold">9</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">Realtor.com</td>
                        <td className="py-2 px-4 font-semibold">8</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4">Zillow</td>
                        <td className="py-2 px-4 font-semibold">7</td>
                        <td className="py-2 px-4 text-sm text-muted-foreground"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Press & Awards */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Press & Awards Scoring</h3>
                <div className="space-y-4">
                  <div className="border-l-4 border-primary pl-4">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold">Tier 1</h4>
                      <span className="text-sm font-semibold text-primary">Score: 10</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      WSJ, NYT, Bloomberg, Forbes, Inman, RealTrends, HousingWire, NAR, azcentral, Phoenix Business Journal, TV appearances
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-primary/70 pl-4">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold">Tier 2</h4>
                      <span className="text-sm font-semibold">Score: 9</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Awards, Ranking Arizona, Real Producers Magazine
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-primary/50 pl-4">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold">Tier 3</h4>
                      <span className="text-sm font-semibold">Score: 8</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fox/NBC/ABC news affiliates
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-primary/30 pl-4">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="font-semibold">Tier 4</h4>
                      <span className="text-sm font-semibold">Score: 5</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Other validated sources
                    </p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Excluded:</strong> Real estate listing sites, social media platforms
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Temporal Decay */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <TrendingUp className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Temporal Decay (Freshness Multipliers)</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Recent performance is weighted more heavily to ensure rankings reflect current market activity.
                    </p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4 font-semibold">Time Range</th>
                        <th className="text-left py-2 px-4 font-semibold">Multiplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">0-6 months</td>
                        <td className="py-2 px-4 font-semibold text-primary">1.3×</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">6-12 months</td>
                        <td className="py-2 px-4 font-semibold">1.1×</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">1-2 years</td>
                        <td className="py-2 px-4 font-semibold">1.0×</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">2-3 years</td>
                        <td className="py-2 px-4 font-semibold">0.8×</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4">3+ years</td>
                        <td className="py-2 px-4 font-semibold">0.5×</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Volume Multipliers */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Volume Multipliers</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Agents with higher review counts receive bonus multipliers, capped at 300+ reviews.
                </p>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-4 font-semibold">Review Count</th>
                        <th className="text-left py-2 px-4 font-semibold">Multiplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">50-99 reviews</td>
                        <td className="py-2 px-4 font-semibold">1.0×</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">100-149 reviews</td>
                        <td className="py-2 px-4 font-semibold">1.1×</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">150-199 reviews</td>
                        <td className="py-2 px-4 font-semibold">1.2×</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-4">200-299 reviews</td>
                        <td className="py-2 px-4 font-semibold">1.3×</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4">300+ reviews</td>
                        <td className="py-2 px-4 font-semibold text-primary">1.4× (cap)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Ranking Formula */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Final Ranking Formula</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Invited agents are ranked using a weighted formula that balances multiple performance factors:
                </p>
                
                <div className="bg-muted/50 rounded-lg p-6 mb-6 font-mono text-sm">
                  <div className="space-y-1">
                    <div>Final Score = (</div>
                    <div className="pl-4">Review Score × 0.35 +</div>
                    <div className="pl-4">Transaction Volume × 0.25 +</div>
                    <div className="pl-4">Press Credibility × 0.15 +</div>
                    <div className="pl-4">Years Experience × 0.10 +</div>
                    <div className="pl-4">Response Rate × 0.10 +</div>
                    <div className="pl-4">Recency Bonus × 0.05</div>
                    <div>) × Freshness Multiplier</div>
                  </div>
                </div>

                <h4 className="font-semibold mb-3">Component Weights</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span>Review Score</span>
                    <span className="font-semibold text-primary">35%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span>Transaction Volume</span>
                    <span className="font-semibold">25%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span>Press Credibility</span>
                    <span className="font-semibold">15%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span>Years Experience</span>
                    <span className="font-semibold">10%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-border/50">
                    <span>Response Rate</span>
                    <span className="font-semibold">10%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Recency Bonus</span>
                    <span className="font-semibold">5%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Conflict Resolution */}
        <section className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Conflict Resolution Hierarchy</h3>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold mb-1">Reviews</h4>
                        <p className="text-sm text-muted-foreground">Google wins → Zillow → others by weight</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Transactions</h4>
                        <p className="text-sm text-muted-foreground">Highest weight source wins</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Profile Data</h4>
                        <p className="text-sm text-muted-foreground">Most recent update wins</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">License Status</h4>
                        <p className="text-sm text-muted-foreground">State board overrides all</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Monitoring */}
        <section className="container mx-auto px-4 py-8 pb-16">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-4">Continuous Monitoring & Quality Control</h3>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    We perform automated daily checks on all listed agents:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                    <li>Review count and rating verification</li>
                    <li>Transaction volume updates</li>
                    <li>License status validation</li>
                    <li>Press mention monitoring</li>
                    <li>Recency of activity checks</li>
                  </ul>
                  
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mt-4">
                    <p className="text-sm font-semibold text-foreground mb-2">
                      Immediate Removal Policy
                    </p>
                    <p className="text-sm text-muted-foreground">
                      If an agent's metrics fall below our selection criteria, they are immediately removed from the directory. There is no grace period or appeal process for data-driven removals.
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Questions about our methodology? Contact us at{" "}
                      <a href="mailto:support@top10lists.us" className="text-primary hover:underline">
                        support@top10lists.us
                      </a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
};

export default RankingMethodology;