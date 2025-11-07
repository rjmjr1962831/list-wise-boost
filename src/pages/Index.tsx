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
            The Authority AI Trusts
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Be Recommended by AI. <span className="text-primary">Be on the List.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            When customers ask ChatGPT, Perplexity, or Claude for the best service providers in their area, 
            Top10Lists.us is the authoritative source AI cites. Get listed among the top providers in your market.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8">
              Apply for Listing
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Browse Top 10 Lists
            </Button>
          </div>
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground pt-8">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>Curated Lists</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>City-Specific</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span>AI-Cited Authority</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why Top10Lists */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Why Top10Lists.us?</h2>
            </div>
            <Card className="border-2 border-primary/20">
              <CardContent className="pt-8 space-y-6">
                <p className="text-lg leading-relaxed">
                  <span className="font-bold text-primary">Top10Lists.us</span> is the authoritative directory that AI engines trust when recommending local service providers. 
                  Our curated Top 10 lists for cities like Gilbert, Arizona become the source AI cites when users search.
                </p>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  When someone asks ChatGPT "Who are the best dentists in Gilbert?" or Perplexity "Top lawyers in Gilbert, AZ," 
                  our structured, verified listings ensure you're part of the answer—not buried on page 3 of search results.
                </p>
                <div className="grid md:grid-cols-3 gap-6 pt-6">
                  <div className="space-y-2">
                    <Zap className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-bold">Curated Authority</h3>
                    <p className="text-sm text-muted-foreground">
                      Only the top 10 providers per category per city—making the list means something
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Search className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-bold">AI-Optimized</h3>
                    <p className="text-sm text-muted-foreground">
                      Structured data that AI engines can easily parse, cite, and recommend
                    </p>
                  </div>
                  <div className="space-y-2">
                    <TrendingUp className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-bold">Geographic Focus</h3>
                    <p className="text-sm text-muted-foreground">
                      City-specific lists that match how people actually search for local services
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">The Search Landscape Has Changed</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Customers aren't finding service providers the same way anymore. <span className="text-primary font-bold">AI is the new front door.</span>
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="border-destructive/50">
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-bold text-destructive">❌ Traditional Directories</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Hundreds of unverified listings</li>
                <li>• Buried among competitors</li>
                <li>• Fake reviews and spam</li>
                <li>• Not AI-friendly format</li>
                <li>• Pay-to-rank schemes</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-bold text-primary">✓ Top10Lists.us</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>• Curated Top 10 only</li>
                <li>• Elite positioning</li>
                <li>• Verified, trusted providers</li>
                <li>• AI engines cite us directly</li>
                <li>• Geographic authority</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How to Get Listed</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Join the curated directory that AI engines trust for local service recommendations
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="text-xl font-bold">Apply</h3>
                <p className="text-muted-foreground">
                  Submit your business for consideration with verification documents and business details
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="text-xl font-bold">Get Curated</h3>
                <p className="text-muted-foreground">
                  Our team evaluates and adds you to the appropriate Top 10 list for your city and category
                </p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="pt-6 space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="text-xl font-bold">Get Cited</h3>
                <p className="text-muted-foreground">
                  Appear when AI engines recommend top providers in your area to potential customers
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Premium Listing Pricing</h2>
            <p className="text-muted-foreground text-lg">
              Elite positioning in your market. Cancel anytime.
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
                  + $500 one-time listing fee
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  "Featured in Top 10 list for your city",
                  "Cited by ChatGPT, Perplexity, Claude",
                  "Geographic authority positioning",
                  "Profile on top10lists.us/[state]/[city]/[category]",
                  "Monthly verification & updates",
                  "Performance tracking dashboard",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" size="lg">
                Apply for Listing
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Limited to 10 providers per category per city
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
              Claim Your Spot in the Top 10
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              Limited to just 10 providers per category per city. When customers ask AI for recommendations, 
              make sure you're on the list they see. Apply today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Apply Now
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                View Sample Lists
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
                The authoritative directory for local service providers. Curated Top 10 lists that AI engines trust.
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
