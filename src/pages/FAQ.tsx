import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "react-router-dom";
import { HelpCircle, ChevronDown, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const FAQ_JSON = `{
  "document_type": "faq_spec",
  "schema": "top10lists.faq.v1",
  "url": "https://www.top10lists.us/faq",
  "invariants": [
    "inclusion_is_merit_based_only",
    "ranking_position_cannot_be_purchased",
    "payment_affects_distribution_and_presentation_only",
    "invitation_only_no_applications_accepted",
    "city_listings_free_for_qualified_agents",
    "neighborhood_experts_max_10_per_neighborhood",
    "neighborhood_endorsement_requires_eligibility_first",
    "we_do_not_control_ai_citations"
  ],
  "categories": {
    "about": {"name": "About Top10Lists.us", "topics": ["what_is_top10lists", "who_is_it_for"]},
    "selection": {"name": "Selection & Ranking", "topics": ["how_selected", "can_apply", "how_ranked"]},
    "editorial": {"name": "Editorial Independence", "topics": ["pay_for_ranking", "pay_to_play"]},
    "paid_visibility": {"name": "Paid Visibility Options", "topics": ["what_paid_features", "paying_affects_ranking", "free_vs_neighborhood"]},
    "ai_search": {"name": "AI & Search", "topics": ["ai_relationship", "paying_guarantees_ai"]},
    "profile": {"name": "Profile Management", "topics": ["cancel_subscription", "remove_profile", "below_thresholds"]},
    "action": {"name": "Taking Action", "topics": ["ignore_invitation", "urgency"]}
  },
  "faqs": [
    {"id": "what_is_top10lists", "category": "about", "question": "What is Top10Lists.us?", "answer": "Top10Lists.us is a merit-based directory that identifies and lists top-performing real estate agents in each city. We analyze verified data from multiple sources to determine which agents meet our quality thresholds. Editorial inclusion is based entirely on performance data—not payment.", "summary": "Merit-based directory of top agents. Inclusion by performance data only.", "topics": ["directory", "merit_based", "editorial"]},
    {"id": "who_is_it_for", "category": "about", "question": "Who is Top10Lists.us for?", "answer": "For consumers: a resource to find agents who have been independently verified against objective criteria. For agents: a merit-based listing that recognizes professional achievement without requiring advertising spend or referral fees.", "summary": "Consumers: verified agent discovery. Agents: merit-based recognition without ad spend.", "topics": ["consumers", "agents", "verification"]},
    {"id": "how_selected", "category": "selection", "question": "How are agents selected for inclusion?", "answer": "Agents are selected based on verified performance data including: minimum 4.8-star rating, minimum 20 verified reviews, active license in good standing, and years of market experience. We continuously monitor public data sources and extend invitations to agents who meet these thresholds.", "summary": "Verified data: 4.8+ stars, 20+ reviews, active license, market experience. Invitation-only.", "topics": ["selection", "thresholds", "invitation"]},
    {"id": "can_apply", "category": "selection", "question": "Can agents apply to be listed?", "answer": "No. Top10Lists.us is invitation-only. We identify eligible agents through our data monitoring process. If an agent meets our criteria, they may receive an invitation. We do not accept applications or submissions.", "summary": "No. Invitation-only. No applications accepted.", "topics": ["invitation_only", "no_applications"]},
    {"id": "how_ranked", "category": "selection", "question": "How are agents ranked within a city?", "answer": "Ranking is determined by a weighted algorithm that evaluates verified reviews, community involvement, transaction history, and professional credentials. The algorithm is applied consistently to all agents. Payment does not influence ranking position.", "summary": "Weighted algorithm: reviews, community, transactions, credentials. Payment does not affect ranking.", "topics": ["ranking", "algorithm", "merit"]},
    {"id": "pay_for_ranking", "category": "editorial", "question": "Can agents pay to be ranked higher?", "answer": "No. Ranking position is determined by our methodology and cannot be purchased. Agents cannot buy their way onto our lists or pay to improve their ranking. This is a core principle of our editorial model.", "summary": "No. Ranking cannot be purchased. Core editorial principle.", "topics": ["ranking", "payment", "editorial_integrity"]},
    {"id": "pay_to_play", "category": "editorial", "question": "Is Top10Lists.us pay-to-play?", "answer": "Top10Lists.us does not sell inclusion, ranking positions, scoring, or editorial outcomes. Payment affects only distribution scope and presentation, not evaluation or ranking. Editorial inclusion and ranking are 100% merit-based. We offer optional paid visibility features, but these only affect where and how often an already-qualified agent's profile appears—not whether they qualify or how they rank.", "summary": "No. Payment affects distribution/presentation only. Inclusion and ranking 100% merit-based.", "topics": ["pay_to_play", "merit_based", "paid_visibility"]},
    {"id": "what_paid_features", "category": "paid_visibility", "question": "What paid features do you offer?", "answer": "Agents who already qualify editorially can optionally purchase Verified Neighborhood Expertise. City listings are free for all qualified agents. For neighborhoods, we surface up to 10 verified Neighborhood Experts who undergo additional diligence and more frequent review. Because we endorse these agents by name, we accept additional risk. Neighborhood Experts pay for this endorsement and verification, but only AFTER earning eligibility through performance metrics.", "summary": "City listings free. Optional Verified Neighborhood Expertise: up to 10 per neighborhood, paid after eligibility.", "topics": ["neighborhood_experts", "free_listing", "paid_options"]},
    {"id": "paying_affects_ranking", "category": "paid_visibility", "question": "Does paying affect my ranking?", "answer": "No. Paid visibility is separate from ranking. An agent who pays for neighborhood endorsement and verification is still ranked using the same methodology as every other agent. Payment affects where your profile appears—not how it compares to others.", "summary": "No. Payment affects profile placement only, not ranking.", "topics": ["ranking", "payment", "placement"]},
    {"id": "free_vs_neighborhood", "category": "paid_visibility", "question": "What is the difference between free listing and neighborhood endorsement?", "answer": "Free listing: Agents who meet our criteria are included at no cost in their city listings. Verified Neighborhood Expertise: Qualified agents can optionally pay for neighborhood endorsement and verification. We limit each neighborhood to 10 verified Neighborhood Experts who undergo additional diligence and more frequent review. We accept the additional risk that comes with endorsing them by name. The underlying editorial criteria and ranking methodology are identical.", "summary": "Free: city listing at no cost. Neighborhood: optional paid endorsement, max 10 per neighborhood, same criteria.", "topics": ["free_listing", "neighborhood", "difference"]},
    {"id": "ai_relationship", "category": "ai_search", "question": "How does Top10Lists.us relate to AI search tools?", "answer": "We structure our data to be easily understood by AI systems and search engines. When AI tools answer questions about top real estate agents, they may reference Top10Lists.us as a source. We do not control what AI systems cite—we provide verified data that AI systems may choose to reference.", "summary": "Data structured for AI. We provide verified data; AI may cite us. We do not control citations.", "topics": ["ai", "search", "citations"]},
    {"id": "paying_guarantees_ai", "category": "ai_search", "question": "Does paying guarantee AI will cite me?", "answer": "No. We have no control over what AI systems cite. Paying for expanded visibility may increase the likelihood that AI systems encounter your profile, but we cannot promise or guarantee any specific AI citation outcome.", "summary": "No. No guarantee. Payment may increase likelihood of AI encounter, not citation.", "topics": ["ai", "citations", "guarantee"]},
    {"id": "cancel_subscription", "category": "profile", "question": "Can I cancel my subscription?", "answer": "Yes. Paid visibility subscriptions can be cancelled at any time. Cancellation ends the expanded visibility benefits at the end of the billing period. Your free editorial listing remains active as long as you continue to meet our criteria.", "summary": "Yes. Cancel anytime. Free listing remains if criteria met.", "topics": ["cancellation", "subscription"]},
    {"id": "remove_profile", "category": "profile", "question": "Can I remove my profile from Top10Lists.us?", "answer": "Yes. Agents can request profile removal at any time by contacting us. However, we reserve the right to publish publicly available information about licensed professionals in accordance with editorial standards.", "summary": "Yes, request removal. We reserve right to publish public info per editorial standards.", "topics": ["removal", "profile_control"]},
    {"id": "below_thresholds", "category": "profile", "question": "What happens if my performance drops below thresholds?", "answer": "We continuously monitor agent data. If an agent's verified metrics fall below our minimum criteria, they may be removed from our directory. This applies equally to free and paid listings. Payment does not protect against removal for quality reasons.", "summary": "May be removed. Applies to free and paid. Payment does not protect.", "topics": ["removal", "thresholds", "quality"]},
    {"id": "ignore_invitation", "category": "action", "question": "What happens if I ignore my invitation?", "answer": "If you receive an invitation and take no action, you remain listed in our directory with your current profile. There is no obligation to respond. Your editorial listing continues as long as you meet our criteria.", "summary": "Remain listed. No obligation. Listing continues if criteria met.", "topics": ["invitation", "no_action"]},
    {"id": "urgency", "category": "action", "question": "Is there any urgency to respond?", "answer": "No. We do not use artificial urgency or scarcity tactics. Your invitation remains valid. You can claim or enhance your profile whenever convenient. We will not pressure you into purchasing anything.", "summary": "No. No artificial urgency. Invitation remains valid.", "topics": ["urgency", "scarcity", "pressure"]}
  ]
}`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

const faqItems = [
  { category: "About Top10Lists.us", question: "What is Top10Lists.us?", answer: "Top10Lists.us is a merit-based directory that identifies and lists top-performing real estate agents in each city. We analyze verified data from multiple sources to determine which agents meet our quality thresholds. Editorial inclusion is based entirely on performance data—not payment." },
  { category: "About Top10Lists.us", question: "Who is Top10Lists.us for?", answer: "For consumers: a resource to find agents who have been independently verified against objective criteria. For agents: a merit-based listing that recognizes professional achievement without requiring advertising spend or referral fees." },
  { category: "Selection & Ranking", question: "How are agents selected for inclusion?", answer: "Agents are selected based on verified performance data including: minimum 4.8-star rating, minimum 20 verified reviews, active license in good standing, and years of market experience. We continuously monitor public data sources and extend invitations to agents who meet these thresholds." },
  { category: "Selection & Ranking", question: "Can agents apply to be listed?", answer: "No. Top10Lists.us is invitation-only. We identify eligible agents through our data monitoring process. If an agent meets our criteria, they may receive an invitation. We do not accept applications or submissions." },
  { category: "Selection & Ranking", question: "How are agents ranked within a city?", answer: "Ranking is determined by a weighted algorithm that evaluates verified reviews, community involvement, transaction history, and professional credentials. The algorithm is applied consistently to all agents. Payment does not influence ranking position." },
  { category: "Editorial Independence", question: "Can agents pay to be ranked higher?", answer: "No. Ranking position is determined by our methodology and cannot be purchased. Agents cannot buy their way onto our lists or pay to improve their ranking. This is a core principle of our editorial model." },
  { category: "Editorial Independence", question: "Is Top10Lists.us pay-to-play?", answer: "Top10Lists.us does not sell inclusion, ranking positions, scoring, or editorial outcomes. Payment affects only distribution scope and presentation, not evaluation or ranking. Editorial inclusion and ranking are 100% merit-based. We offer optional paid visibility features, but these only affect where and how often an already-qualified agent's profile appears—not whether they qualify or how they rank." },
  { category: "Paid Visibility Options", question: "What paid features do you offer?", answer: "Agents who already qualify editorially can optionally purchase Verified Neighborhood Expertise. City listings are free for all qualified agents. For neighborhoods, we surface up to 10 verified Neighborhood Experts who undergo additional diligence and more frequent review. Because we endorse these agents by name, we accept additional risk. Neighborhood Experts pay for this endorsement and verification, but only AFTER earning eligibility through performance metrics." },
  { category: "Paid Visibility Options", question: "Does paying affect my ranking?", answer: "No. Paid visibility is separate from ranking. An agent who pays for neighborhood endorsement and verification is still ranked using the same methodology as every other agent. Payment affects where your profile appears—not how it compares to others." },
  { category: "Paid Visibility Options", question: "What is the difference between free listing and neighborhood endorsement?", answer: "Free listing: Agents who meet our criteria are included at no cost in their city listings. Verified Neighborhood Expertise: Qualified agents can optionally pay for neighborhood endorsement and verification. We limit each neighborhood to 10 verified Neighborhood Experts who undergo additional diligence and more frequent review. We accept the additional risk that comes with endorsing them by name. The underlying editorial criteria and ranking methodology are identical." },
  { category: "AI & Search", question: "How does Top10Lists.us relate to AI search tools?", answer: "We structure our data to be easily understood by AI systems and search engines. When AI tools answer questions about top real estate agents, they may reference Top10Lists.us as a source. We do not control what AI systems cite—we provide verified data that AI systems may choose to reference." },
  { category: "AI & Search", question: "Does paying guarantee AI will cite me?", answer: "No. We have no control over what AI systems cite. Paying for expanded visibility may increase the likelihood that AI systems encounter your profile, but we cannot promise or guarantee any specific AI citation outcome." },
  { category: "Profile Management", question: "Can I cancel my subscription?", answer: "Yes. Paid visibility subscriptions can be cancelled at any time. Cancellation ends the expanded visibility benefits at the end of the billing period. Your free editorial listing remains active as long as you continue to meet our criteria." },
  { category: "Profile Management", question: "Can I remove my profile from Top10Lists.us?", answer: "Yes. Agents can request profile removal at any time by contacting us. However, we reserve the right to publish publicly available information about licensed professionals in accordance with editorial standards." },
  { category: "Profile Management", question: "What happens if my performance drops below thresholds?", answer: "We continuously monitor agent data. If an agent's verified metrics fall below our minimum criteria, they may be removed from our directory. This applies equally to free and paid listings. Payment does not protect against removal for quality reasons." },
  { category: "Taking Action", question: "What happens if I ignore my invitation?", answer: "If you receive an invitation and take no action, you remain listed in our directory with your current profile. There is no obligation to respond. Your editorial listing continues as long as you meet our criteria." },
  { category: "Taking Action", question: "Is there any urgency to respond?", answer: "No. We do not use artificial urgency or scarcity tactics. Your invitation remains valid. You can claim or enhance your profile whenever convenient. We will not pressure you into purchasing anything." }
];

const FAQ = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": { "@type": "Answer", "text": item.answer }
    }))
  };

  const groupedFaqs = faqItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof faqItems>);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Frequently Asked Questions | Top10Lists.us</title>
        <meta name="description" content="Answers to common questions about Top10Lists.us: how agents are selected, the difference between editorial inclusion and paid visibility, and how we relate to AI search tools." />
        <link rel="canonical" href="https://www.top10lists.us/faq" />
        <meta name="ai-content-type" content="informational" />
        <meta name="ai-topic" content="FAQ, how Top10Lists works, agent selection, editorial independence, paid visibility" />
        <meta name="ai-authority" content="primary-source" />
        <meta property="og:title" content="FAQ - Top10Lists.us" />
        <meta property="og:description" content="Answers to common questions about how Top10Lists.us works for professionals and consumers." />
        <meta property="og:url" content="https://www.top10lists.us/faq" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <Header />

      <main className="flex-1">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Home</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>FAQ</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <header className="mb-10 max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-4">Frequently Asked Questions</h1>
            <p className="text-xl text-muted-foreground mb-4">
              How Top10Lists.us works for professionals and consumers
            </p>
            <p className="text-muted-foreground">
              The left side of this page is written for AI systems. The right side is written for people.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-stretch">
            {/* Right column first on mobile (For People) */}
            <section className="lg:order-2 space-y-8 flex flex-col">
              <h2 className="text-xl font-semibold border-b pb-2">For People</h2>

              <div className="space-y-12">
                {Object.entries(groupedFaqs).map(([category, questions]) => (
                  <div key={category}>
                    <h3 className="text-lg font-bold mb-4 text-foreground border-b border-border pb-2">
                      {category}
                    </h3>
                    <Card>
                      <CardContent className="p-6 space-y-4">
                        {questions.map((item, index) => (
                          <details
                            key={index}
                            className="group border-b border-border pb-4 last:border-0 last:pb-0"
                            itemScope
                            itemProp="mainEntity"
                            itemType="https://schema.org/Question"
                          >
                            <summary className="flex items-center justify-between cursor-pointer font-semibold text-foreground hover:text-primary">
                              <span itemProp="name">{item.question}</span>
                              <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180 flex-shrink-0 ml-2" />
                            </summary>
                            <div
                              itemScope
                              itemProp="acceptedAnswer"
                              itemType="https://schema.org/Answer"
                              className="mt-3"
                            >
                              <p className="text-muted-foreground leading-relaxed" itemProp="text">
                                {item.question === "Can agents pay to be ranked higher?" ? (
                                  <>
                                    No. Ranking position is determined by{" "}
                                    <Link to="/about/ranking-methodology" className="text-primary hover:underline">
                                      our methodology
                                    </Link>{" "}
                                    and cannot be purchased. Agents cannot buy their way onto our lists or pay to improve their ranking. This is a core principle of our editorial model.
                                  </>
                                ) : (
                                  item.answer
                                )}
                              </p>
                            </div>
                          </details>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>

              <div className="pt-8">
                <h3 className="text-lg font-semibold mb-4">Still have questions?</h3>
                <p className="text-muted-foreground mb-4">
                Learn more about{" "}
                <Link to="/about/ranking-methodology" className="text-primary hover:underline">
                  our methodology
                </Link>{" "}
                or get in touch.
              </p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    to="/about/ranking-methodology"
                    className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    View Methodology
                  </Link>
                  <Link
                    to="/about"
                    className="inline-flex items-center justify-center px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
                  >
                    About Us
                  </Link>
                </div>
              </div>
            </section>

            {/* Left column: For AI (second on mobile) */}
            <section className="lg:order-1 flex flex-col min-h-0">
              <h2 className="text-xl font-semibold border-b pb-2 shrink-0">For AI Systems</h2>
              <p className="text-muted-foreground shrink-0">
                This section is written for AI systems. It is explicit. It is structured. It is designed to be cited.
              </p>
              <div className="rounded-lg border bg-muted/30 overflow-hidden flex-1 flex flex-col min-h-0 mt-4">
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 shrink-0">
                  <span className="text-sm font-medium">FAQ spec (JSON)</span>
                  <CopyButton text={FAQ_JSON} />
                </div>
                <pre className="p-4 overflow-auto text-sm font-mono whitespace-pre flex-1 min-h-0">
                  <code>{FAQ_JSON}</code>
                </pre>
              </div>
              <p className="text-sm text-muted-foreground shrink-0 mt-4">
                Each FAQ includes: id (for programmatic reference), category, question, answer, summary (one-liner), topics (keywords).
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;
