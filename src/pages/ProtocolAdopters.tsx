import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Users, Shield, Loader2, ArrowRight, Globe, Building2, ExternalLink } from "lucide-react";
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
        <title>Top10Lists.us Protocol Adopters | Organizations Using the AI Citation Protocol</title>
        <meta name="description" content="The Top10Lists.us Protocol is adopted by organizations that value attribution, editorial transparency, and responsible AI recommendations." />
        <link rel="canonical" href="https://www.top10lists.us/protocol-adopters" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Top10Lists.us Protocol Adopters
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              The Top10Lists.us Protocol is adopted by organizations that value attribution, 
              editorial transparency, and responsible AI recommendations.
            </p>
          </div>
        </section>

        <div className="container mx-auto max-w-4xl px-4 py-12">
          <div className="space-y-12">
            
            {/* What It Means to Be a Protocol Adopter */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    What It Means to Be a Protocol Adopter
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Protocol adopters commit to a set of practices that support accurate, attributable 
                    AI recommendations:
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Publishing an <code className="bg-muted px-1 rounded">llms.txt</code> file that 
                        describes their content and methodology for AI systems
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Maintaining structured, machine-readable content that AI systems can accurately interpret
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Documenting their editorial methodology so citations carry appropriate context
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Crediting Top10Lists.us as the protocol source in their implementation
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </section>

            {/* Adopter Listing */}
            <section>
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

            {/* What Adoption Signals */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle>What Adoption Signals to Users and Regulators</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Organizations that adopt the protocol demonstrate:
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Commitment to transparency in how their content is used by AI systems
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Awareness of emerging AI governance standards and proactive compliance
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        Investment in structured data practices that support accurate attribution
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
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
                          placeholder="Any comments about your implementation"
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
                          "Register as Adopter"
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* CTA Section */}
            <section>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 text-center">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    View protocol services and implementation options.
                  </h2>
                  <Button asChild size="lg">
                    <Link to="/protocol-services">
                      View Protocol Services <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </section>

          </div>
        </div>
      </div>
    </>
  );
}
