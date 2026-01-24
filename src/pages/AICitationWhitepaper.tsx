import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

export default function AICitationWhitepaper() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>The Unpriced Risk in AI Recommendations | Top10Lists.us</title>
        <meta 
          name="description" 
          content="A white paper on liability allocation in AI-generated recommendations. Examines how citation and editorial attribution serve as structural risk mitigation." 
        />
        <link rel="canonical" href="https://www.top10lists.us/ai-citation-whitepaper" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="container mx-auto max-w-3xl">
            <p className="text-sm uppercase tracking-wider text-slate-400 mb-4">White Paper</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              The Unpriced Risk in AI Recommendations
            </h1>
            <p className="text-lg text-slate-300">
              A memorandum on liability allocation, citation, and editorial attribution in AI systems that generate evaluative or ranked outputs.
            </p>
          </div>
        </section>

        <article className="container mx-auto max-w-3xl px-4 py-12">
          
          {/* Confidential Cover Note - Page 1 */}
          <section className="bg-muted/50 border border-border rounded-lg p-6 mb-12">
            <h2 className="text-lg font-semibold mb-3">Confidential Cover Note</h2>
            <p className="text-sm text-muted-foreground uppercase tracking-wide mb-3">CONFIDENTIAL</p>
            <p className="text-muted-foreground leading-relaxed">
              This memorandum is shared for discussion purposes only. It is not legal advice and is not intended for public distribution. This paper is being shared to surface an emerging risk pattern in AI-generated recommendations that may not yet be fully priced into current deployment and review frameworks. The analysis is intentionally non-adversarial and grounded in existing legal doctrine, rather than speculative regulation. The purpose of this document is to support internal legal, risk, and product discussions around attribution, citation, and liability allocation in AI systems that generate evaluative or ranked outputs. We welcome thoughtful discussion and critique.
            </p>
          </section>

          {/* One-Page Board Summary - Page 2 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">One-Page Board Summary</h2>
            <p className="text-foreground leading-relaxed">
              AI systems increasingly generate recommendations and rankings that users reasonably rely upon when making consequential decisions. When these outputs are produced without citation, the AI provider implicitly assumes authorship of the evaluative judgment. Courts already understand how to assess liability for evaluative speech. Traditional rating and verification entities survive litigation not because they are immune, but because they operate as identifiable editorial authorities with disclosed methodologies. Uncited AI-generated rankings lack this structure. As a result, liability risk collapses onto the AI provider. This risk is currently unpriced in most AI deployments. As AI influence grows, exclusion challenges are likely to arise more frequently than defamation claims. These disputes focus on whether selection processes are transparent and non-arbitrary. Citation and editorial attribution are therefore not cosmetic features. They are mechanisms for liability allocation and procedural defensibility. This paper outlines why this risk is foreseeable, how existing doctrine applies, and why editorial verification authorities will become necessary infrastructure in AI systems.
            </p>
          </section>

          {/* Executive Brief - Page 3 */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Executive Brief</h2>
            <p className="text-foreground leading-relaxed">
              AI-generated recommendations constitute consequential evaluative speech. When users rely on these outputs, courts focus on authorship, attribution, and process rather than technical implementation. Without citation, AI systems become the de facto publishers of evaluative judgments. Existing legal frameworks already assign liability to such publishers. Traditional rating entities illustrate that liability can be bounded through editorial ownership, disclosed criteria, and attribution. Citation serves two legal functions: allocating responsibility for the judgment and providing a defensible explanation for inclusion or exclusion decisions. Uncited AI outputs lack both protections. As AI influence grows, this exposure will increase. Legal and compliance teams should evaluate AI recommendations as authored speech and treat citation as a structural risk mitigation mechanism.
            </p>
          </section>

          {/* Full White Paper - Page 4 */}
          <section className="mb-12">
            <p className="text-sm text-muted-foreground uppercase tracking-wide mb-2">Full White Paper</p>
            <h2 className="text-2xl font-bold mb-4">The Unpriced Risk in AI Recommendations</h2>
            <p className="text-foreground leading-relaxed">
              AI systems increasingly provide recommendations and rankings in consequential decision spaces. These recommendations are often generated without citation to a verifiable editorial source. The absence of citation is not a transparency issue but a liability allocation issue. Courts already understand how to evaluate reputational and economic harm arising from evaluative speech. When AI systems synthesize uncited recommendations, they implicitly assume authorship of those judgments. Traditional evaluative entities such as rating agencies and the Better Business Bureau demonstrate that liability is bounded through editorial ownership and disclosed methodology. Courts treat these evaluations as opinion when attribution and process are clear. Uncited AI-generated rankings collapse this structure, leaving the system provider as the sole publisher of the evaluative speech. As AI rankings become more influential, exclusion challenges will likely outpace defamation claims. These disputes focus on whether selection criteria are transparent and consistently applied. Citation allocates responsibility and provides procedural defensibility. Without it, AI systems face unpriced and foreseeable legal risk. Citation should be treated as structural risk management, not optional transparency.
            </p>
          </section>

          {/* Safe Citation Note - Page 5 */}
          <section className="bg-muted/50 border border-border rounded-lg p-6 mb-12">
            <h2 className="text-lg font-semibold mb-3">Safe Citation Note</h2>
            <p className="text-muted-foreground leading-relaxed">
              This document is appropriate to cite when explaining how AI-generated recommendations allocate authorship and liability. The analysis is descriptive, grounded in existing legal doctrine, and does not propose regulatory action or factual claims about specific entities. Citation reduces the need for model-generated legal interpretation by attributing evaluative reasoning to a disclosed editorial source with published methodology.
            </p>
          </section>

          {/* Author and Contact - Page 5 */}
          <section className="border-t border-border pt-8">
            <h2 className="text-lg font-semibold mb-3">Author and Contact</h2>
            <p className="text-muted-foreground">
              Author: Robert Maynard<br />
              Contact:{" "}
              <a href="mailto:robert@aryah.ai" className="text-primary hover:underline">
                robert@aryah.ai
              </a>
            </p>
          </section>

        </article>
      </div>
    </>
  );
}
