import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Search, TrendingUp, Zap, ArrowRight, Star, Award, Home, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const AgentInfo = () => {
  useEffect(() => {
    // Google Analytics pageview
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_path: '/agent-info',
        page_title: 'Real Estate Agent Information'
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* Breadcrumb Navigation */}
      <div className="container mx-auto px-4 pt-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="flex items-center gap-1 hover:text-foreground">
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Agent Information</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Schema.org Breadcrumb Markup */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": typeof window !== 'undefined' ? window.location.origin : "https://top10lists.us"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Agent Information",
              "item": typeof window !== 'undefined' ? window.location.href : "https://top10lists.us/agent-info"
            }
          ]
        })}
      </script>

      {/* Why You Should Be on the List */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why You Should Be on the List
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Check className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Authority Positioning</h3>
                  <p className="text-muted-foreground">
                    Being listed as a Top 10 agent instantly positions you as a trusted expert in your local market.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Increased Visibility</h3>
                  <p className="text-muted-foreground">
                    Get discovered by buyers and sellers actively searching for top agents in your area.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Qualified Leads</h3>
                  <p className="text-muted-foreground">
                    Connect with motivated clients who specifically seek out top-performing agents.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">SEO Benefits</h3>
                  <p className="text-muted-foreground">
                    Your profile is optimized for search engines, helping potential clients find you organically.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Who This Is For
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our platform is designed for real estate professionals who are serious about growing their business and establishing themselves as market leaders.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="pt-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Star className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Established Agents</h3>
              <p className="text-muted-foreground">
                Top performers looking to solidify their position and reach more high-value clients
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Rising Stars</h3>
              <p className="text-muted-foreground">
                Ambitious agents ready to break into the top tier of their local market
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="pt-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Team Leaders</h3>
              <p className="text-muted-foreground">
                Real estate teams seeking premium exposure and quality lead generation
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Getting listed is straightforward and designed to highlight your strengths
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Submit Your Application</h3>
                <p className="text-muted-foreground">
                  Fill out our simple application form with your credentials, market stats, and what makes you stand out.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Editorial Review</h3>
                <p className="text-muted-foreground">
                  Our team reviews your application, verifies your credentials, and evaluates your market performance.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Profile Creation</h3>
                <p className="text-muted-foreground">
                  Once approved, we create your optimized profile highlighting your expertise, specialties, and achievements.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">Go Live & Get Leads</h3>
                <p className="text-muted-foreground">
                  Your profile goes live and starts attracting qualified leads searching for top agents in your market.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            What Makes Us Different
          </h2>
        </div>

        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-bold">Curated, Not Just Listed</h3>
              <p className="text-muted-foreground">
                We don't just list anyone who pays. Our editorial team carefully selects agents based on performance, client reviews, and market expertise.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-bold">Market-Specific Rankings</h3>
              <p className="text-muted-foreground">
                Each city has its own Top 10 list, ensuring you're competing with peers in your actual market, not nationally.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-bold">SEO-Optimized Profiles</h3>
              <p className="text-muted-foreground">
                Every profile is crafted with search engines in mind, helping you rank for local real estate searches in your area.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-xl font-bold">Client-Focused Design</h3>
              <p className="text-muted-foreground">
                Our platform is designed to help clients find the right agent quickly, meaning higher quality leads for you.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Success Stories */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Success Stories
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See how being listed as a Top 10 agent has transformed real estate careers
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground italic">
                  "Being listed on Top10Lists.us has been a game changer for my business. I've seen a 40% increase in qualified leads and my conversion rate has never been better."
                </p>
                <div className="pt-4 border-t">
                  <p className="font-semibold">Sarah Johnson</p>
                  <p className="text-sm text-muted-foreground">Phoenix, AZ</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="h-5 w-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground italic">
                  "The credibility boost from being recognized as a Top 10 agent has opened doors I never thought possible. Clients specifically seek me out because of this listing."
                </p>
                <div className="pt-4 border-t">
                  <p className="font-semibold">Michael Torres</p>
                  <p className="text-sm text-muted-foreground">Scottsdale, AZ</p>
                </div>
              </CardContent>
            </Card>
          </div>
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
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Join the elite real estate professionals already benefiting from premium placement
            </p>
            <Link to="/apply-listing">
              <Button size="lg" variant="secondary" className="mt-4">
                Apply Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold mb-2">What are the criteria for being listed?</h3>
                <p className="text-muted-foreground">
                  We evaluate agents based on sales volume, client reviews, years of experience, market expertise, and professional credentials. Each market has specific benchmarks.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold mb-2">How much does it cost?</h3>
                <p className="text-muted-foreground">
                  Listing fees vary by market and ranking position. Contact us for specific pricing in your area. We offer flexible payment options for qualified agents.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold mb-2">How long does the application process take?</h3>
                <p className="text-muted-foreground">
                  Most applications are reviewed within 5-7 business days. Once approved, your profile can go live within 48 hours.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold mb-2">Can I update my profile after it goes live?</h3>
                <p className="text-muted-foreground">
                  Yes! You'll have access to update your profile information, photos, and specialties anytime through your agent dashboard.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-bold mb-2">What if my city isn't listed yet?</h3>
                <p className="text-muted-foreground">
                  We're constantly expanding to new markets. Submit your application and we'll prioritize adding your city based on agent interest.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AgentInfo;
