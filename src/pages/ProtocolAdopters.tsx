import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Users, Globe, Bell, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

export default function ProtocolAdopters() {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.organization_name || !formData.website_url || !formData.contact_email || !formData.industry || !formData.implementation_status) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Insert into database
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

      // Send notification emails via edge function
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

  return (
    <>
      <Helmet>
        <title>AI Citation Protocol Adopters | Top10Lists.us</title>
        <meta name="description" content="Organizations implementing the Top10Lists.us AI Citation Protocol for professional directories." />
        <link rel="canonical" href="https://www.top10lists.us/protocol-adopters" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              AI Citation Protocol — Adopter Registry
            </h1>
            <p className="text-lg text-slate-300 mb-6">
              This protocol is © 2026 Top10Lists.us and freely available for use.
            </p>
            <div className="text-left max-w-md mx-auto mb-6">
              <p className="text-lg text-slate-300 mb-3">We ask two things:</p>
              <ul className="text-slate-300 space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Register your implementation below</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Credit Top10Lists.us in your llms.txt</span>
                </li>
              </ul>
            </div>
            <p className="text-lg text-slate-400">
              No fees. No approval required.
            </p>
          </div>
        </section>

        <div className="container mx-auto max-w-2xl px-4 py-12">
          <div className="space-y-8">
            {/* Why Register Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Why Register?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Public recognition as a protocol adopter</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Globe className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Potential inclusion in press materials and industry reports</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Notifications when the protocol is updated</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Demonstrates commitment to AI-friendly, transparent data practices</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Registration Form */}
            <Card>
              <CardHeader>
                <CardTitle>Register as Adopter</CardTitle>
              </CardHeader>
              <CardContent>
                {submitted ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Registration Submitted!</h3>
                    <p className="text-muted-foreground">
                      Thank you for registering. Your submission is pending review.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        Link to your llms.txt implementation if live
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="industry">Industry/Category *</Label>
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

            {/* Protocol Info Card */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">View the Protocol</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Review the full AI Citation Protocol and implementation guidelines.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/llms.txt" target="_blank" rel="noopener noreferrer">
                      View llms.txt
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/for-ai">
                      For AI Systems
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
