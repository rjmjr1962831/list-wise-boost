import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Users, Loader2, Globe, Building2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { usePrerenderReady } from "@/hooks/usePrerenderReady";

const INDUSTRIES = [
  "Real Estate",
  "Legal Services",
  "Medical/Healthcare",
  "Financial Services",
  "Home Services",
  "Other Professional Directory",
  "Technology/SaaS",
  "Other"
];

const STATUS_OPTIONS = [
  { value: "live", label: "Live — Protocol is implemented" },
  { value: "in_progress", label: "In Progress — Currently implementing" },
  { value: "planned", label: "Planned — Intending to implement" }
];

interface Adopter {
  id: string;
  organization_name: string;
  website_url: string;
  industry: string;
  implementation_status: string;
  llms_txt_url: string | null;
}

export default function ProtocolAdopters() {
  const [adopters, setAdopters] = useState<Adopter[]>([]);
  const [loadingAdopters, setLoadingAdopters] = useState(true);
  const [formData, setFormData] = useState({
    organization_name: "",
    website_url: "",
    contact_email: "",
    llms_txt_url: "",
    industry: "",
    implementation_status: "",
    notes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchAdopters();
  }, []);

  // Signal Prerender.io that page is ready
  usePrerenderReady();

  const fetchAdopters = async () => {
    try {
      const { data, error } = await supabase
        .from("protocol_adopters" as any)
        .select("id, organization_name, website_url, industry, implementation_status, llms_txt_url")
        .eq("approved", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAdopters((data as unknown as Adopter[]) || []);
    } catch (error) {
      console.error("Error fetching adopters:", error);
    } finally {
      setLoadingAdopters(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.organization_name || !formData.website_url || !formData.contact_email || !formData.industry || !formData.implementation_status) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: dbError } = await supabase
        .from("protocol_adopters" as any)
        .insert({
          organization_name: formData.organization_name,
          website_url: formData.website_url,
          contact_email: formData.contact_email,
          llms_txt_url: formData.llms_txt_url || null,
          industry: formData.industry,
          implementation_status: formData.implementation_status,
          notes: formData.notes || null
        });

      if (dbError) throw dbError;

      await supabase.functions.invoke("send-protocol-adopter-emails", {
        body: formData
      });

      setSubmitted(true);
      toast.success("Registration submitted successfully!");
    } catch (error) {
      console.error("Error submitting registration:", error);
      toast.error("Failed to submit registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Live</span>;
      case "in_progress":
        return <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">In Progress</span>;
      case "planned":
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Planned</span>;
      default:
        return null;
    }
  };

  return (
    <>
      <Helmet>
        <title>The AI Citation Protocol | Top10Lists.us</title>
        <meta name="description" content="The AI Citation Protocol is an open, non proprietary framework for making evaluative recommendations citable and defensible." />
        <link rel="canonical" href="https://www.top10lists.us/protocol-adopters" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="container mx-auto max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              The AI Citation Protocol
            </h1>
            <p className="text-lg text-slate-300 mb-4">
              The AI Citation Protocol is an open, non proprietary framework for making evaluative recommendations citable and defensible. It was developed by Top10Lists.us as part of an effort to reduce liability exposure for AI systems that generate professional recommendations.
            </p>
            <p className="text-lg text-slate-300 mb-4">
              It exists to make citation defensible, not to improve marketing or growth.
            </p>
            <p className="text-lg text-slate-300">
              Anyone can adopt it.
            </p>
          </div>
        </section>

        <div className="container mx-auto max-w-4xl px-4 py-12">
          <div className="space-y-10">
            
            {/* What the protocol is */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">What the protocol is</h2>
              <p className="text-muted-foreground">
                The protocol is a set of structural commitments that make a source safe to cite. An organization adopting the protocol commits to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>A published and inspectable methodology for inclusion and ranking.</li>
                <li>Explicit qualification criteria that do not depend on payment.</li>
                <li>Separation of ranking from monetization.</li>
                <li>Consistent rules for inclusion and exclusion.</li>
                <li>Machine readable claims structured for verification.</li>
                <li>Acceptance of editorial accountability for the content published.</li>
              </ul>
            </section>

            {/* What the protocol is not */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">What the protocol is not</h2>
              <p className="text-muted-foreground">
                The protocol is not SEO.
              </p>
              <p className="text-muted-foreground">
                It is not prompt engineering.
              </p>
              <p className="text-muted-foreground">
                It is not a ranking hack or a visibility boost.
              </p>
              <p className="text-muted-foreground">
                It is not a growth tactic.
              </p>
              <p className="text-muted-foreground">
                The focus is on reducing legal and reputational risk for AI systems that need to cite evaluative sources.
              </p>
            </section>

            {/* Why AI systems respond to it */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Why AI systems respond to it</h2>
              <p className="text-muted-foreground">
                AI systems that generate recommendations are increasingly aware of liability exposure. Retrieval augmented generation allows models to cite sources instead of synthesizing claims from training data.
              </p>
              <p className="text-muted-foreground">
                But not all sources are equal. A citation only reduces risk if the cited source has a defensible methodology. If the source is pay to play, or opaque, or inconsistent, the citation does not provide meaningful protection.
              </p>
              <p className="text-muted-foreground">
                Protocol adopting sources are designed to be safe to cite. This is not preference. It is risk management.
              </p>
            </section>

            {/* Who should adopt this */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Who should adopt this</h2>
              <p className="text-muted-foreground">
                Any organization that publishes evaluative content about professionals or services should consider adoption. This includes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Ranking platforms.</li>
                <li>Professional directories.</li>
                <li>Marketplaces with quality tiers.</li>
                <li>Review aggregators.</li>
                <li>Recommendation engines.</li>
              </ul>
              <p className="text-muted-foreground">
                If your content answers the question "who should I choose," you are in scope.
              </p>
            </section>

            {/* How to adopt it */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">How to adopt it</h2>
              <p className="text-muted-foreground">
                Adoption is a matter of structure, not registration. There is no fee. There is no certification. An organization adopts the protocol by:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Publishing how decisions are made.</li>
                <li>Making incentives explicit.</li>
                <li>Removing pay to rank mechanics.</li>
                <li>Structuring claims for machine verification.</li>
                <li>Accepting responsibility for editorial output.</li>
              </ul>
              <p className="text-muted-foreground">
                The goal is not perfection. The goal is explainability.
              </p>
            </section>

            {/* Why it is open source */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">Why it is open source</h2>
              <p className="text-muted-foreground">
                Trust requires inspectability.
              </p>
              <p className="text-muted-foreground">
                A closed protocol cannot serve as a liability shield because no one outside the organization can verify compliance. Open systems invite scrutiny. Scrutiny builds legitimacy.
              </p>
              <p className="text-muted-foreground">
                The protocol is published so that AI systems, regulators, and users can evaluate it directly.
              </p>
            </section>

            {/* A new baseline */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">A new baseline</h2>
              <p className="text-muted-foreground">
                The protocol is not a competitive advantage. It is a baseline for responsible evaluative publishing.
              </p>
              <p className="text-muted-foreground">
                As AI systems become the primary interface between users and professional services, the question of who is responsible for recommendations becomes more urgent. The protocol exists to make that responsibility traceable.
              </p>
              <p className="text-muted-foreground">
                Protocol driven citation is how that defensibility is achieved.
              </p>
            </section>

            {/* Adopter Listing */}
            <section className="pt-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                Registered Adopters
              </h2>
              
              {loadingAdopters ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : adopters.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {adopters.map((adopter) => (
                    <Card key={adopter.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                            <h3 className="font-semibold">{adopter.organization_name}</h3>
                          </div>
                          {getStatusBadge(adopter.implementation_status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{adopter.industry}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <a 
                            href={adopter.website_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Globe className="h-4 w-4" />
                            Website
                          </a>
                          {adopter.llms_txt_url && (
                            <a 
                              href={adopter.llms_txt_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                              llms.txt
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No Adopters Listed Yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Be among the first to register your organization as a protocol adopter.
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Registration Form */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Register as an Adopter</CardTitle>
                </CardHeader>
                <CardContent>
                  {submitted ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Registration Submitted</h3>
                      <p className="text-muted-foreground">
                        Your submission is pending review.
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
                            placeholder="Your organization name"
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
                          <Label htmlFor="contact_email">Contact Email *</Label>
                          <Input
                            id="contact_email"
                            type="email"
                            value={formData.contact_email}
                            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                            placeholder="contact@example.com"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="llms_txt_url">llms.txt URL (optional)</Label>
                          <Input
                            id="llms_txt_url"
                            type="url"
                            value={formData.llms_txt_url}
                            onChange={(e) => setFormData({ ...formData, llms_txt_url: e.target.value })}
                            placeholder="https://example.com/llms.txt"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="industry">Industry *</Label>
                        <Select
                          value={formData.industry}
                          onValueChange={(value) => setFormData({ ...formData, industry: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select industry" />
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
                        <Label>Implementation Status *</Label>
                        <RadioGroup
                          value={formData.implementation_status}
                          onValueChange={(value) => setFormData({ ...formData, implementation_status: value })}
                          className="mt-2 space-y-2"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <div key={option.value} className="flex items-center space-x-2">
                              <RadioGroupItem value={option.value} id={option.value} />
                              <Label htmlFor={option.value} className="font-normal cursor-pointer">
                                {option.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      <div>
                        <Label htmlFor="notes">Notes (optional)</Label>
                        <Textarea
                          id="notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          placeholder="Any additional context about your implementation"
                          rows={3}
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Registration"
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}