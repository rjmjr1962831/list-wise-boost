import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const SERVICE_TIERS = [
  { value: "tier1", label: "Tier 1: Protocol Implementation ($2,500)" },
  { value: "tier2", label: "Tier 2: Full GEO Optimization ($5,000)" },
  { value: "tier3", label: "Tier 3: Managed GEO Service ($500/month)" },
  { value: "consultation", label: "Consultation / Not Sure" }
];

const INDUSTRIES = [
  "Real Estate",
  "Legal Services",
  "Medical/Healthcare",
  "Financial Services",
  "Home Services",
  "Other Professional Directory",
  "Other"
];

const FAQ_ITEMS = [
  {
    q: "Can't I just implement the free protocol myself?",
    a: "Absolutely. The protocol is open source. These services are for organizations that want expert implementation or don't have the technical resources to do it correctly."
  },
  {
    q: "How long does implementation take?",
    a: "Tier 1 typically takes 1-2 weeks. Tier 2 takes 2-4 weeks depending on the size of your site and content restructuring needs."
  },
  {
    q: "Do you guarantee AI citation?",
    a: "No. AI systems make their own decisions about what to cite. We optimize your site to meet the criteria AI systems use to evaluate source credibility. We cannot control AI behavior."
  },
  {
    q: "What industries do you work with?",
    a: "Any professional directory or recommendation platform. Real estate, legal, medical, financial services, home services—any industry where consumers ask AI for professional recommendations."
  },
  {
    q: "What if I just want a consultation?",
    a: "Contact us. We offer hourly consulting for organizations that want guidance without a full implementation package."
  }
];

export default function ProtocolServices() {
  const [formData, setFormData] = useState({
    organization_name: "",
    website_url: "",
    contact_name: "",
    email: "",
    phone: "",
    service_tier: "",
    industry: "",
    project_description: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.organization_name || !formData.website_url || !formData.contact_name || !formData.email || !formData.service_tier || !formData.industry) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert into database
      const { error: dbError } = await supabase
        .from("protocol_service_inquiries" as any)
        .insert({
          organization_name: formData.organization_name,
          website_url: formData.website_url,
          contact_name: formData.contact_name,
          email: formData.email,
          phone: formData.phone || null,
          service_tier: formData.service_tier,
          industry: formData.industry,
          project_description: formData.project_description || null
        });

      if (dbError) throw dbError;

      // Send notification email via edge function
      await supabase.functions.invoke("send-protocol-service-inquiry-email", {
        body: formData
      });

      setSubmitted(true);
      toast.success("Quote request submitted successfully!");
    } catch (error) {
      console.error("Error submitting quote request:", error);
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>AI Citation Protocol — Implementation Services | Top10Lists.us</title>
        <meta name="description" content="Expert implementation of the Top10Lists.us AI Citation Protocol. Get your directory optimized for AI citation." />
        <link rel="canonical" href="https://www.top10lists.us/protocol-services" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              AI Citation Protocol — Implementation Services
            </h1>
            <p className="text-xl text-slate-300 mb-4">
              The protocol is free. Expert implementation is available.
            </p>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Not every organization has the technical resources to implement AI citation 
              optimization correctly. We built the protocol. We can implement it for you.
            </p>
          </div>
        </section>

        <div className="container mx-auto max-w-6xl px-4 py-12">
          {/* Why Professional Implementation */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6 text-center">Why Professional Implementation?</h2>
            <p className="text-lg text-muted-foreground mb-6 text-center max-w-3xl mx-auto">
              The AI Citation Protocol is more than a text file. Effective implementation requires:
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {[
                "Structured data markup (Schema.org, JSON-LD)",
                "AI crawler configuration (robots.txt optimization)",
                "Machine-readable content indexes",
                "Methodology documentation that AI systems can parse",
                "Testing across multiple AI platforms (ChatGPT, Claude, Perplexity, Gemini)"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-center mt-6 text-muted-foreground">
              Most web developers have never optimized for AI citation. We've done it from day one.
            </p>
          </section>

          {/* Service Tiers */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">Service Tiers</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Tier 1 */}
              <Card className="relative">
                <CardHeader>
                  <div className="text-sm font-medium text-muted-foreground mb-1">TIER 1</div>
                  <CardTitle className="text-xl">Protocol Implementation</CardTitle>
                  <div className="text-3xl font-bold text-primary">$2,500</div>
                  <div className="text-sm text-muted-foreground">one-time</div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {[
                      "Audit existing llms.txt or create from scratch",
                      "Customize protocol for your industry",
                      "Implement ai-content-index.json",
                      "Configure robots.txt for AI crawlers",
                      "Structured data markup review",
                      "Deployment verification",
                      "30-day support window"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mb-4">
                    Best for: Organizations with technical staff who need a solid foundation
                  </p>
                  <Button className="w-full" variant="outline" asChild>
                    <a href="#quote-form">Request Quote</a>
                  </Button>
                </CardContent>
              </Card>

              {/* Tier 2 */}
              <Card className="relative border-primary shadow-lg">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  POPULAR
                </div>
                <CardHeader>
                  <div className="text-sm font-medium text-muted-foreground mb-1">TIER 2</div>
                  <CardTitle className="text-xl">Full GEO Optimization</CardTitle>
                  <div className="text-3xl font-bold text-primary">$5,000</div>
                  <div className="text-sm text-muted-foreground">one-time</div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">Everything in Tier 1, plus:</p>
                  <ul className="space-y-2 mb-6">
                    {[
                      "Complete Generative Engine Optimization audit",
                      "Content restructuring for AI citation",
                      "Methodology page creation",
                      "Citation guidance documentation",
                      "AI system testing (ChatGPT, Claude, Perplexity, Gemini)",
                      "Competitive citation analysis",
                      "60-day support window"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mb-4">
                    Best for: Organizations serious about becoming an AI-cited authority
                  </p>
                  <Button className="w-full" asChild>
                    <a href="#quote-form">Request Quote</a>
                  </Button>
                </CardContent>
              </Card>

              {/* Tier 3 */}
              <Card>
                <CardHeader>
                  <div className="text-sm font-medium text-muted-foreground mb-1">TIER 3</div>
                  <CardTitle className="text-xl">Managed GEO Service</CardTitle>
                  <div className="text-3xl font-bold text-primary">$500</div>
                  <div className="text-sm text-muted-foreground">/month</div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">Everything in Tier 2, plus:</p>
                  <ul className="space-y-2 mb-6">
                    {[
                      "Quarterly GEO compliance audits",
                      "Protocol updates as AI systems evolve",
                      "Citation monitoring and reporting",
                      "Priority support",
                      "Recommendations for content updates",
                      "Annual strategy review"
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mb-4">
                    Best for: Organizations wanting ongoing optimization as AI evolves
                  </p>
                  <Button className="w-full" variant="outline" asChild>
                    <a href="#quote-form">Request Quote</a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Our Results */}
          <section className="mb-16 bg-slate-50 rounded-2xl p-8">
            <h2 className="text-3xl font-bold mb-6 text-center">Our Results</h2>
            <p className="text-lg text-muted-foreground mb-6 text-center">
              Top10Lists.us was purpose-built for AI citation from day one. The results:
            </p>
            <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {[
                "Cited by ChatGPT, Claude, Perplexity, and Gemini in real-world testing",
                "Ranked in top 0.01% of sites for AI trust signals (per GPT-4 analysis)",
                "Published methodology referenced by AI systems as credibility signal",
                "Zero pay-to-play model recognized as reducing commercial bias"
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-lg shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="text-center mt-6 font-medium">
              We're not theorizing about what works. We're offering what we built.
            </p>
          </section>

          {/* FAQ */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {FAQ_ITEMS.map((item, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">{item.q}</h3>
                    <p className="text-muted-foreground">{item.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Quote Form */}
          <section id="quote-form" className="max-w-2xl mx-auto scroll-mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-center">Request a Quote</CardTitle>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Thank You!</h3>
                    <p className="text-muted-foreground">
                      We'll be in touch within 1 business day.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="organization_name">Organization Name *</Label>
                        <Input
                          id="organization_name"
                          value={formData.organization_name}
                          onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                          placeholder="Your organization"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="website_url">Website URL *</Label>
                        <Input
                          id="website_url"
                          type="url"
                          value={formData.website_url}
                          onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                          placeholder="https://example.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contact_name">Contact Name *</Label>
                        <Input
                          id="contact_name"
                          value={formData.contact_name}
                          onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                          placeholder="Your name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone (optional)</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(555) 123-4567"
                      />
                    </div>

                    <div>
                      <Label htmlFor="service_tier">Service Interest *</Label>
                      <Select
                        value={formData.service_tier}
                        onValueChange={(value) => setFormData({ ...formData, service_tier: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service tier" />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICE_TIERS.map((tier) => (
                            <SelectItem key={tier.value} value={tier.value}>
                              {tier.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="industry">Industry *</Label>
                      <Select
                        value={formData.industry}
                        onValueChange={(value) => setFormData({ ...formData, industry: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your industry" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.map((industry) => (
                            <SelectItem key={industry} value={industry}>
                              {industry}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="project_description">Tell us about your project (optional)</Label>
                      <Textarea
                        id="project_description"
                        value={formData.project_description}
                        onChange={(e) => setFormData({ ...formData, project_description: e.target.value })}
                        placeholder="Describe your directory, current setup, and goals..."
                        rows={4}
                      />
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Request Quote
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Link to Protocol */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Want to implement the protocol yourself?
            </p>
            <Button variant="outline" asChild>
              <Link to="/protocol-adopters">
                View the Free Protocol <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}