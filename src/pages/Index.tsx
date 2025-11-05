import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Search, TrendingUp, Zap } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T10</span>
            </div>
            <span className="text-xl font-bold">Top10Lists.us</span>
          </div>
          <nav className="hidden md:flex gap-6">
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#industries" className="text-muted-foreground hover:text-foreground transition-colors">Industries</a>
          </nav>
          <Button>Get Listed</Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Future-Proof Your Marketing
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            SEO is Dead. <span className="text-primary">GEO</span> is the Future.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your customers aren't clicking links anymore—they're asking ChatGPT, Perplexity, and Claude. 
            While traditional SEO traffic drops 25% annually, GEO gets you directly into AI-generated answers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8">
              Get Started Today
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              View Sample Listings
            </Button>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground pt-8">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>GEO Optimized</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>No Contract</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>Live in 48 Hours</span>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">The Truth About Traditional Marketing</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Businesses like yours have seen a <span className="text-primary font-bold">25% drop in organic traffic and bookings</span> over the past year. 
            And it's accelerating.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="border-destructive/50">
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-bold text-destructive">❌ The Old Way (SEO/SEM)</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Users click through 10 blue links</li>
                <li>• Compete for Google rankings</li>
                <li>• Pay-per-click ads burning budget</li>
                <li>• Traffic declining 25% year-over-year</li>
                <li>• Zero visibility in AI answers</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-bold text-primary">✓ The New Way (GEO)</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• AI gives direct recommendations</li>
                <li>• You're the answer, not a link</li>
                <li>• Higher-intent customers</li>
                <li>• Growing audience daily</li>
                <li>• Future-proof positioning</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How GEO Works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Get visible in AI-generated recommendations where your customers are actually searching
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="text-xl font-bold">Sign Up</h3>
                <p className="text-muted-foreground">
                  Complete our simple onboarding form with your business details and verification
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="text-xl font-bold">GEO Optimization</h3>
                <p className="text-muted-foreground">
                  We structure your data for AI engines and publish within 48 hours
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="text-xl font-bold">Get Recommended</h3>
                <p className="text-muted-foreground">
                  Appear in AI-generated answers when customers ask for your services
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Industries We Serve</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Specialized listings for service-based businesses across multiple sectors
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {[
            { icon: "🏥", title: "Healthcare", desc: "Chiropractors, Optometrists, Dentists" },
            { icon: "🔧", title: "Home Services", desc: "Plumbers, Electricians, HVAC" },
            { icon: "⚖️", title: "Professional", desc: "Lawyers, Accountants, Consultants" },
            { icon: "💼", title: "Business Services", desc: "Marketing, IT, Design" },
            { icon: "🏠", title: "Real Estate", desc: "Agents, Property Management" },
            { icon: "🚗", title: "Automotive", desc: "Mechanics, Detailing, Repair" },
            { icon: "💪", title: "Wellness", desc: "Fitness, Therapy, Nutrition" },
            { icon: "🎓", title: "Education", desc: "Tutors, Training, Coaching" },
          ].map((industry, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="text-4xl">{industry.icon}</div>
                <h3 className="font-bold text-lg">{industry.title}</h3>
                <p className="text-sm text-muted-foreground">{industry.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground text-lg">
              No hidden fees. Cancel anytime.
            </p>
          </div>
          <Card className="max-w-lg mx-auto border-2 border-primary">
            <CardContent className="pt-8 space-y-6">
              <div className="text-center">
                <div className="inline-flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$250</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <div className="mt-2 text-muted-foreground">
                  + $500 one-time setup fee
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  "GEO-optimized listing on Top10Lists.us",
                  "Visible in ChatGPT, Perplexity, Claude",
                  "Monthly data updates & verification",
                  "AI-friendly structured data",
                  "Performance analytics dashboard",
                  "Priority support",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" size="lg">
                Get Started Now
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Cancel anytime. No long-term contracts.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="py-16 text-center space-y-6">
            <Search className="h-16 w-16 mx-auto opacity-90" />
            <h2 className="text-3xl md:text-4xl font-bold">
              Don't Get Left Behind
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              While your competitors watch their SEO traffic decline, position yourself in the AI-powered future. 
              Get listed in 48 hours and start appearing in AI recommendations today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Schedule a Demo
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                Contact Sales
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card mt-20">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">T10</span>
                </div>
                <span className="text-xl font-bold">Top10Lists.us</span>
              </div>
              <p className="text-sm text-muted-foreground">
                GEO-optimized business listings for the AI search era. Future-proof your marketing today.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Industries</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2025 Top10Lists.us. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
