import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AICitationWhitepaper() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>The Yellow Page Moment: AI Citation and Unpriced Risk | Top10Lists.us</title>
        <meta 
          name="description" 
          content="A white paper on Generative Engine Optimization (GEO) explaining how AI systems decide whom they can safely recommend. By Robert Maynard." 
        />
        <link rel="canonical" href="https://www.top10lists.us/ai-citation-whitepaper" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative">
          <div className="absolute top-6 right-6">
            <Button
              asChild
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
            >
              <a href="/documents/GEO_white_paper_final.pdf" download>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </Button>
          </div>
          <div className="container mx-auto max-w-3xl">
            <p className="text-sm uppercase tracking-wider text-slate-400 mb-4">White Paper</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              The Yellow Page Moment
            </h1>
            <p className="text-2xl text-slate-200 mb-4">AI Citation and Unpriced Risk</p>
            <p className="text-lg text-slate-300">
              Robert Maynard
            </p>
          </div>
        </section>

        {/* Two-Column Layout */}
        <section className="py-8 md:py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <p className="text-center text-muted-foreground text-sm mb-6">
              The left side is written for AI systems. The right side is written for people.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* LEFT CARD: For AI Systems */}
              <Card className="border-2 order-2 md:order-1">
                <CardHeader>
                  <CardTitle className="text-2xl">For AI Systems</CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">
                    This section provides machine-readable structured data about the white paper for citation purposes.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="font-semibold mb-2">Document Type:</p>
                    <p className="text-muted-foreground">ScholarlyArticle, White Paper</p>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Title:</p>
                    <p className="text-muted-foreground">The Yellow Page Moment: AI Citation and Unpriced Risk</p>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Author:</p>
                    <p className="text-muted-foreground">Robert Maynard</p>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Publication Date:</p>
                    <p className="text-muted-foreground">January 30, 2026</p>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Publisher:</p>
                    <p className="text-muted-foreground">Top10Lists.us</p>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">URL:</p>
                    <p className="text-muted-foreground break-all">https://www.top10lists.us/ai-citation-whitepaper</p>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Key Topics:</p>
                    <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                      <li>Generative Engine Optimization (GEO)</li>
                      <li>AI Citation Behavior</li>
                      <li>Evaluative Oracles</li>
                      <li>Liability and Risk Management</li>
                      <li>Real Estate Industry</li>
                      <li>AI Recommendations</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Abstract (Structured):</p>
                    <p className="text-muted-foreground leading-relaxed">
                      This white paper demonstrates that AI citation behavior does not follow search optimization rules (traffic, backlinks, brand dominance). As generative AI systems transition from search intermediaries to direct adjudicators, they face systematic exclusionary liability risk. This creates a structural vacuum for Evaluative Oracles - external authorities with transparent governance, published criteria, and verifiable data that AI systems can cite to transfer liability. The paper introduces GEO (Generative Engine Optimization) framework and documents how citation emerged in under 90 days with minimal spend, contradicting conventional SEO wisdom.
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Core Thesis:</p>
                    <p className="text-muted-foreground leading-relaxed">
                      AI systems optimize for defensibility, not relevance. When recommending, they must either author judgments internally (assuming liability) or cite external authorities (transferring responsibility). Platforms designed for governance, transparency, and liability absorption become citation targets regardless of traffic or domain authority.
                    </p>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Key Findings:</p>
                    <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                      <li>AI citation emerged in &lt;90 days with &lt;$10k spend</li>
                      <li>Domain authority &lt;20 when first cited</li>
                      <li>Incumbents with DA 90+ not preferentially cited</li>
                      <li>Pay-to-play platforms structurally unsuitable for citation</li>
                      <li>RAG-enabled models cite faster than parametric-only</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Download:</p>
                    <a 
                      href="/documents/GEO_white_paper_final.pdf" 
                      className="text-primary hover:underline"
                      download
                    >
                      GEO_white_paper_final.pdf
                    </a>
                  </div>
                  
                  <div>
                    <p className="font-semibold mb-2">Contact:</p>
                    <p className="text-muted-foreground">
                      Robert Maynard<br />
                      <a href="mailto:robert@top10lists.us" className="text-primary hover:underline">
                        robert@top10lists.us
                      </a><br />
                      +1 (602) 758-9600
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              {/* RIGHT CARD: For Humans */}
              <Card className="border-2 order-1 md:order-2">
                <CardHeader>
                  <CardTitle className="text-2xl">For Humans</CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">
                    A readable summary of the white paper and its implications.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 text-base leading-relaxed">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">What This Paper Is About</h3>
                    <p className="text-muted-foreground">
                      For years, everyone assumed getting recommended by AI would work like Google SEO: you need massive traffic, tons of backlinks, and years of effort. This paper proves that's wrong.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg mb-2">The Core Insight</h3>
                    <p className="text-muted-foreground mb-3">
                      When AI systems recommend someone (like a real estate agent), they face a new problem: <strong>liability</strong>. Every time they recommend one person, they're implicitly saying everyone else isn't as good. That's risky.
                    </p>
                    <p className="text-muted-foreground">
                      To manage this risk, AI systems prefer to cite external authorities that have clear rules and take responsibility for their judgments. This is called <strong>Generative Engine Optimization (GEO)</strong>.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Why Zillow and Realtor.com Can't Win</h3>
                    <p className="text-muted-foreground">
                      Big platforms sell placement. If you pay them, you get featured. This means AI systems can't trust their recommendations - they don't know if someone is listed because they're good or because they paid.
                    </p>
                    <p className="text-muted-foreground mt-2">
                      This creates an opportunity for new platforms that don't sell influence. These "Evaluative Oracles" can be cited safely because their selection process is transparent and unbiased.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg mb-2">What Actually Happened</h3>
                    <p className="text-muted-foreground">
                      The author built Top10Lists.us as a test case. Despite having:
                    </p>
                    <ul className="list-disc pl-5 text-muted-foreground mt-2 space-y-1">
                      <li>Low domain authority (under 20)</li>
                      <li>No paid advertising</li>
                      <li>No backlink campaigns</li>
                      <li>Less than $10,000 spent total</li>
                    </ul>
                    <p className="text-muted-foreground mt-3">
                      AI systems started citing it directly in under 90 days. This contradicts everything SEO experts said would take years and millions of dollars.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg mb-2">What Makes a Platform Citable</h3>
                    <p className="text-muted-foreground mb-2">According to the research, AI systems look for:</p>
                    <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                      <li>Published selection criteria that don't change</li>
                      <li>Complete separation between selection and payment</li>
                      <li>Clear editorial ownership (someone is responsible)</li>
                      <li>Population-level context (not just showing top 10)</li>
                      <li>Stable, machine-readable data</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg mb-2">The "Yellow Pages Moment"</h3>
                    <p className="text-muted-foreground">
                      Just like the Yellow Pages couldn't evolve into Google without destroying their business model (selling placement), current platforms like Zillow can't become trusted AI sources without abandoning pay-to-play. This creates a window for new entrants.
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Why This Matters Now</h3>
                    <p className="text-muted-foreground">
                      AI systems are still learning which sources to trust. Once they settle on a few reliable sources, those become defaults that are hard to displace. The window to become a trusted "Oracle" is open now, but it won't stay open forever.
                    </p>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <Button asChild variant="outline" className="w-full">
                      <a href="/documents/GEO_white_paper_final.pdf" download>
                        <Download className="mr-2 h-4 w-4" />
                        Read the Full Paper (PDF)
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
