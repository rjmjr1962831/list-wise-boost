import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Search, TrendingUp, Zap } from "lucide-react";
import { useMarketingContent } from "@/hooks/useMarketingContent";
import { Top10SearchForm } from "@/components/Top10SearchForm";
import { Link } from "react-router-dom";
const Index = () => {
  if (import.meta.env.DEV) console.info('[Index] Rendering City Search Index with Top10SearchForm');
  const { data: content, isLoading } = useMarketingContent('main');
  
  const getContent = (section: string, key: string, fallback: string = '') => {
    const item = content?.find(c => c.section === section && c.key === key);
    return item?.value || fallback;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      {/* What Is Top10Lists.us */}
      <section className="container mx-auto px-4 py-20 md:py-32 text-center">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            {getContent('what_is', 'title', 'What Is Top10Lists.us?')}
          </h2>
          <p 
            className="text-xl text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: getContent('what_is', 'description', 'Top10Lists.us is a <span class="font-semibold text-foreground">curated directory of the top 10 real estate agents</span> in every major U.S. city.')
            }}
          />
          <div className="pt-4">
            <p className="text-lg text-muted-foreground">
              Each list is housed at a clean, location-specific URL like:
            </p>
            <div className="mt-3 inline-block px-6 py-3 bg-card rounded-lg border-2 border-primary/30">
              <code className="text-primary font-mono font-semibold">top10lists.us/az/gilbert/realtors</code>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <Top10SearchForm />
        </div>
      </section>

      {/* Why You Should Be on the List */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {getContent('why_join', 'title', 'Why You Should Be on the List')}
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
                    We're not selling ads—we're building trust. Being featured means you're recognized as one of the best in your field, in your city.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">AI Talent</h3>
                  <p className="text-muted-foreground">
                    Our lists are optimized for citation by AI tools like ChatGPT, Google SGE, and Perplexity. These platforms cite structured lists over individual websites.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Local SEO Power</h3>
                  <p className="text-muted-foreground">
                    Each list is geo-targeted and keyword-optimized to rank for high-intent searches like "top real estate agents in Gilbert" or "best realtors near me."
                  </p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="pt-6 space-y-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">No Tech Headaches</h3>
                  <p className="text-muted-foreground">
                    You don't need to change your website or learn SEO. We handle the content, structure, and optimization. You just show up where it matters.
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
            {getContent('who_for', 'title', 'Who This Is For')}
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {getContent('who_for', 'subtitle', 'Top-tier service professionals who apply. Once past our screening and invited to be on the list, you choose your investment per month based on your business needs.')}
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="border-2">
            <CardContent className="pt-6 space-y-4">
              <div className="text-4xl mb-3">🚀</div>
              <h3 className="text-xl font-bold">New Entrants</h3>
              <p className="text-muted-foreground">
                Looking to <span className="font-semibold text-foreground">build trust fast</span> and establish credibility in a new market
              </p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="pt-6 space-y-4">
              <div className="text-4xl mb-3">🏆</div>
              <h3 className="text-xl font-bold">Established Providers</h3>
              <p className="text-muted-foreground">
                Who want to <span className="font-semibold text-foreground">own their local niche</span> and cement their reputation
              </p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardContent className="pt-6 space-y-4">
              <div className="text-4xl mb-3">💼</div>
              <h3 className="text-xl font-bold">Cost-Conscious Professionals</h3>
              <p className="text-muted-foreground">
                Tired of expensive PPC campaigns and want <span className="font-semibold text-foreground">predictable talent</span>
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
              {getContent('how_it_works', 'title', 'How to Get Listed')}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {getContent('how_it_works', 'subtitle', 'Join the curated directory that AI engines trust for local service recommendations')}
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

      {/* Markets */}
      <section id="markets" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {getContent('markets', 'title', 'Markets We Cover')}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {getContent('markets', 'subtitle', 'Connecting buyers and sellers with top real estate agents across major U.S. cities')}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { icon: "🏠", title: "Residential Sales", desc: "Buyer's & Seller's Agents" },
            { icon: "🏢", title: "Commercial Real Estate", desc: "Office, Retail, Industrial" },
            { icon: "💼", title: "Property Management", desc: "Rentals & HOA Services" },
            { icon: "🏗️", title: "New Construction", desc: "Builder Representatives" },
            { icon: "💰", title: "Investment Properties", desc: "Fix & Flip, Rental Analysis" },
            { icon: "🌴", title: "Luxury Real Estate", desc: "High-End Properties" }
          ].map((market, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6 text-center space-y-3">
                <div className="text-4xl">{market.icon}</div>
                <h3 className="font-bold text-lg">{market.title}</h3>
                <p className="text-sm text-muted-foreground">{market.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {getContent('pricing', 'title', 'Cost & Value')}
            </h2>
            <p className="text-muted-foreground text-lg">
              {getContent('pricing', 'subtitle', 'Authority without the ad spend. One new client covers the cost.')}
            </p>
          </div>
          <Card className="max-w-lg mx-auto border-2 border-primary">
            <CardContent className="pt-8 space-y-6">
              <div className="text-center">
                <div className="inline-flex items-baseline gap-2">
                  <span className="text-5xl font-bold">
                    {getContent('pricing', 'price', '$300')}
                  </span>
                  <span className="text-muted-foreground">
                    {getContent('pricing', 'period', '/month')}
                  </span>
                </div>
                <div className="mt-4 px-6 py-3 bg-primary/10 rounded-lg inline-block">
                  <p className="text-sm font-medium text-primary">
                    {getContent('pricing', 'roi_text', 'Most professionals see 3–6x ROI within 12 months')}
                  </p>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  "Featured in Top 10 list for your city and category",
                  "Cited by ChatGPT, Google AI, and Perplexity",
                  "Profile at top10lists.us/[state]/[city]/[category]",
                  "Visible to thousands of high-intent searchers",
                  "Monthly verification & updates",
                  "No need to change your website or learn SEO",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t">
                <p className="text-center text-sm text-muted-foreground mb-4">
                  <span className="font-semibold text-foreground">No paying for clicks.</span> No chasing leads. Just authority.
                </p>
              </div>
              <Button className="w-full" size="lg">
                Claim Your Spot
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
              {getContent('final_cta', 'title', 'Claim Your Spot in the Top 10')}
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto">
              {getContent('final_cta', 'description', 'Limited to just 10 providers per category per city. When customers ask AI for recommendations, make sure you\'re on the list they see. Apply today.')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                {getContent('final_cta', 'cta_primary', 'Apply Now')}
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
                <Link to="/az/gilbert/top10realestateagents" target="_blank" rel="noopener noreferrer">{getContent('final_cta', 'cta_secondary', 'View Sample Lists')}</Link>
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
                <span className="text-xl font-bold">
                  Top<span className="text-2xl">10</span>Lists.us
                </span>
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
            © 2025 Top<span className="font-semibold">10</span>Lists.us. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
