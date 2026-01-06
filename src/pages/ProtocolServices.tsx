import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, FileText, Code, Shield, Database } from "lucide-react";

export default function ProtocolServices() {
  return (
    <>
      <Helmet>
        <title>Top10Lists.us Protocol Services | AI Citation Implementation</title>
        <meta name="description" content="Protocol services support organizations implementing citation-backed AI recommendations. Editorial integration, technical implementation, compliance, and attribution infrastructure." />
        <link rel="canonical" href="https://www.top10lists.us/protocol-services" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Top10Lists.us Protocol Services
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Protocol services support organizations implementing citation-backed AI recommendations. 
              These services focus on attribution, editorial governance, and structured risk management.
            </p>
          </div>
        </section>

        <div className="container mx-auto max-w-4xl px-4 py-12">
          <div className="space-y-8">
            
            {/* Editorial Integration Support */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-primary" />
                  Editorial Integration Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Help organizations align their editorial processes with protocol requirements.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Methodology documentation and structuring</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Content organization for AI interpretability</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Editorial workflow integration</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Technical Implementation Assistance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Code className="h-6 w-6 text-primary" />
                  Technical Implementation Assistance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Support for the technical aspects of protocol adoption.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>llms.txt file creation and configuration</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Structured data markup implementation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>AI crawler optimization</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Compliance and Review Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-primary" />
                  Compliance and Review Services
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Verification that implementations meet protocol standards.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Protocol compliance audits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Implementation verification</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Ongoing compliance monitoring</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Metadata and Attribution Infrastructure */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-primary" />
                  Metadata and Attribution Infrastructure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Building the technical foundation for proper attribution.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Content indexing systems</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Machine-readable metadata design</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>Attribution tracking infrastructure</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Primary CTA */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6 text-center">
                <h2 className="text-xl font-semibold text-foreground mb-3">
                  View protocol product and implementation details
                </h2>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                  For pricing, service tiers, and detailed implementation options, 
                  contact our team to discuss your organization's needs.
                </p>
                <Button asChild size="lg">
                  <a href="mailto:protocol@top10lists.us">
                    Contact for Details <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* View Protocol Link */}
            <Card className="border-dashed">
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground mb-4">
                  Want to implement the protocol yourself? The protocol is freely available.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" asChild>
                    <a href="/llms.txt" target="_blank" rel="noopener noreferrer">
                      View llms.txt
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/protocol-adopters">
                      Register as Adopter
                    </Link>
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
