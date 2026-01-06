import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Link } from "react-router-dom";
import { HelpCircle, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const faqItems = [
  // What Top10Lists.us is
  {
    category: "About Top10Lists.us",
    question: "What is Top10Lists.us?",
    answer: "Top10Lists.us is a merit-based directory that identifies and lists top-performing real estate agents in each city. We analyze verified data from multiple sources to determine which agents meet our quality thresholds. Editorial inclusion is based entirely on performance data—not payment."
  },
  {
    category: "About Top10Lists.us",
    question: "Who is Top10Lists.us for?",
    answer: "For consumers: a resource to find agents who have been independently verified against objective criteria. For agents: a merit-based listing that recognizes professional achievement without requiring advertising spend or referral fees."
  },
  // How agents are selected
  {
    category: "Selection & Ranking",
    question: "How are agents selected for inclusion?",
    answer: "Agents are selected based on verified performance data including: minimum 4.8-star rating, minimum 20 verified reviews, active license in good standing, and years of market experience. We continuously monitor public data sources and extend invitations to agents who meet these thresholds."
  },
  {
    category: "Selection & Ranking",
    question: "Can agents apply to be listed?",
    answer: "No. Top10Lists.us is invitation-only. We identify eligible agents through our data monitoring process. If an agent meets our criteria, they may receive an invitation. We do not accept applications or submissions."
  },
  {
    category: "Selection & Ranking",
    question: "How are agents ranked within a city?",
    answer: "Ranking is determined by a weighted algorithm that evaluates verified reviews, community involvement, transaction history, and professional credentials. The algorithm is applied consistently to all agents. Payment does not influence ranking position."
  },
  // Whether rankings are sold
  {
    category: "Editorial Independence",
    question: "Can agents pay to be ranked higher?",
    answer: "No. Ranking position is determined by our methodology and cannot be purchased. Agents cannot buy their way onto our lists or pay to improve their ranking. This is a core principle of our editorial model."
  },
  {
    category: "Editorial Independence",
    question: "Is Top10Lists.us pay-to-play?",
    answer: "No. Editorial inclusion and ranking are 100% merit-based. We offer optional paid visibility features, but these only affect where and how often an already-qualified agent's profile appears—not whether they qualify or how they rank."
  },
  // How paid features work
  {
    category: "Paid Visibility Options",
    question: "What paid features do you offer?",
    answer: "Agents who already qualify editorially can optionally purchase expanded visibility in additional cities. This affects distribution and prominence only. It does not change their ranking, score, or eligibility. All editorial criteria remain the same."
  },
  {
    category: "Paid Visibility Options",
    question: "Does paying affect my ranking?",
    answer: "No. Paid visibility is separate from ranking. An agent who pays for expanded visibility is still ranked using the same methodology as every other agent. Payment affects where your profile appears—not how it compares to others."
  },
  {
    category: "Paid Visibility Options",
    question: "What is the difference between free listing and expanded visibility?",
    answer: "Free listing: Agents who meet our criteria are included at no cost in their primary city. Expanded visibility: Qualified agents can optionally pay to extend their presence to additional cities. The underlying editorial criteria and ranking methodology are identical."
  },
  // Relationship to AI search
  {
    category: "AI & Search",
    question: "How does Top10Lists.us relate to AI search tools?",
    answer: "We structure our data to be easily understood by AI systems and search engines. When AI tools answer questions about top real estate agents, they may reference Top10Lists.us as a source. We do not control what AI systems recommend—we provide verified data that AI systems may choose to cite."
  },
  {
    category: "AI & Search",
    question: "Does paying guarantee AI will recommend me?",
    answer: "No. We have no control over what AI systems recommend. Paying for expanded visibility may increase the likelihood that AI systems encounter your profile, but we cannot promise or guarantee any specific AI recommendation outcome."
  },
  // Cancellation and profile control
  {
    category: "Profile Management",
    question: "Can I cancel my subscription?",
    answer: "Yes. Paid visibility subscriptions can be cancelled at any time. Cancellation ends the expanded visibility benefits at the end of the billing period. Your free editorial listing remains active as long as you continue to meet our criteria."
  },
  {
    category: "Profile Management",
    question: "Can I remove my profile from Top10Lists.us?",
    answer: "Yes. Agents can request profile removal at any time by contacting us. However, we reserve the right to publish publicly available information about licensed professionals in accordance with editorial standards."
  },
  {
    category: "Profile Management",
    question: "What happens if my performance drops below thresholds?",
    answer: "We continuously monitor agent data. If an agent's verified metrics fall below our minimum criteria, they may be removed from our directory. This applies equally to free and paid listings. Payment does not protect against removal for quality reasons."
  },
  // What happens if no action is taken
  {
    category: "Taking Action",
    question: "What happens if I ignore my invitation?",
    answer: "If you receive an invitation and take no action, you remain listed in our directory with your current profile. There is no obligation to respond. Your editorial listing continues as long as you meet our criteria."
  },
  {
    category: "Taking Action",
    question: "Is there any urgency to respond?",
    answer: "No. We do not use artificial urgency or scarcity tactics. Your invitation remains valid. You can claim or enhance your profile whenever convenient. We will not pressure you into purchasing anything."
  }
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
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  };

  // Group FAQs by category
  const groupedFaqs = faqItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof faqItems>);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Frequently Asked Questions | Top10Lists.us</title>
        <meta name="description" content="Answers to common questions about Top10Lists.us: how agents are selected, the difference between editorial inclusion and paid visibility, and how we relate to AI search tools." />
        <link rel="canonical" href="https://www.top10lists.us/faq" />
        
        {/* AI Content Tags */}
        <meta name="ai-content-type" content="informational" />
        <meta name="ai-topic" content="FAQ, how Top10Lists works, agent selection, editorial independence, paid visibility" />
        <meta name="ai-authority" content="primary-source" />
        
        <meta property="og:title" content="FAQ - Top10Lists.us" />
        <meta property="og:description" content="Answers to common questions about how Top10Lists.us works for professionals and consumers." />
        <meta property="og:url" content="https://www.top10lists.us/faq" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>

      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-16">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              How Top10Lists.us works for professionals and consumers
            </p>
          </div>
        </section>

        {/* FAQ List by Category */}
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto space-y-12">
            {Object.entries(groupedFaqs).map(([category, questions]) => (
              <div key={category}>
                <h2 className="text-2xl font-bold mb-6 text-foreground border-b border-border pb-2">
                  {category}
                </h2>
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
                          <p 
                            className="text-muted-foreground leading-relaxed"
                            itemProp="text"
                          >
                            {item.answer}
                          </p>
                        </div>
                      </details>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-muted/30 py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
            <p className="text-muted-foreground mb-6">
              Learn more about our methodology or get in touch.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
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
      </main>

      <Footer />
    </div>
  );
};

export default FAQ;