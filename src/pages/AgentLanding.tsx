import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle2, 
  Star, 
  TrendingUp, 
  Users, 
  Shield,
  Sparkles,
  ArrowRight,
  BadgeCheck,
  Search,
  Award,
  DollarSign,
  BarChart3,
  Clock,
  Zap,
  Target
} from 'lucide-react';
import { AISearchComparison } from '@/components/brand/AISearchComparison';
import { IndustryShiftStats } from '@/components/brand/IndustryShiftStats';
import { CitationBadge } from '@/components/brand/CitationBadge';

export default function AgentLanding() {
  const navigate = useNavigate();

  const whyTop10Features = [
    {
      icon: Sparkles,
      title: 'Built AI-First',
      description: 'Our platform is engineered from the ground up to be cited by LLMs—not retrofitted like legacy sites'
    },
    {
      icon: BarChart3,
      title: 'LLMs Love Lists',
      description: 'Structured, authoritative rankings are exactly what AI search engines look for when answering queries'
    },
    {
      icon: Award,
      title: 'Publication Strategy',
      description: 'Regular features in major outlets create the authoritative citations that LLMs require'
    },
    {
      icon: Target,
      title: 'First-Mover Advantage',
      description: 'Once you\'re the answer AI provides, you\'re incredibly difficult to displace'
    }
  ];

  const brandBuilderBenefits = [
    {
      icon: DollarSign,
      title: 'Simple Monthly Fee',
      description: 'No per-lead charges. No cuts of closed deals. Just transparent, affordable pricing.'
    },
    {
      icon: Users,
      title: 'Direct Contact Display',
      description: 'Your phone and email front and center—clients reach you directly, not through a paywall.'
    },
    {
      icon: Zap,
      title: 'Priority Placement',
      description: 'Premium positioning in AI citation-optimized lists for maximum visibility.'
    },
    {
      icon: Clock,
      title: 'Faster Results',
      description: 'Like SEO, it takes time—but the time to invest is now. Be the answer before others catch on.'
    }
  ];

  return (
    <>
      <Helmet>
        <title>Be the Answer When AI Recommends | Top10Lists Real Estate Agents</title>
        <meta name="description" content="When ChatGPT, Gemini, or Claude search for top agents, will they find you? Top10Lists uses cutting-edge technology to make LLMs cite you as the expert. 4.9+ rating required." />
        <meta name="keywords" content="AI search optimization, LLM citations, real estate agent AI, ChatGPT real estate, brand builder agents, AI real estate leads" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-muted/20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <CitationBadge text="AI-First Directory" variant="verified" className="mb-4" />
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              When AI Searches for
              <span className="text-primary block mt-2">Top Agents, Will They Find You?</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AI search is the present. Top10Lists uses cutting-edge technology to make LLMs like ChatGPT, Gemini, 
              and Claude cite you as the expert when clients search for agents in your market.
            </p>

            <div className="flex justify-center pt-6">
              <Button 
                size="lg"
                onClick={() => navigate('/agent-setup')}
                className="text-lg px-8 py-6 group"
              >
                Check Your Current Listing
                <Search className="ml-2 w-5 h-5" />
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="pt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-primary" />
                <span>License Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" />
                <span>4.9+ Rating Required</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>AI Citation Optimized</span>
              </div>
            </div>
          </div>
        </section>

        {/* The Industry Shift Stats */}
        <section className="container mx-auto px-4 py-16 md:py-20 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                The Shift Is Happening Now
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                AI search was the future. Now it's the present. The data is undeniable.
              </p>
            </div>

            <IndustryShiftStats />
          </div>
        </section>

        {/* Old SEO vs AI Search Comparison */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Legacy Sites Can't Compete
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Sites like Zillow were built for traditional SEO. To be cited by AI requires a complete 
                technological rebuild—something that will take legacy platforms years to accomplish.
              </p>
            </div>

            <AISearchComparison />
          </div>
        </section>

        {/* Why Top10Lists Section */}
        <section className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Top10Lists Works
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                We're not trying to retrofit an old system. We built for AI from day one.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {whyTop10Features.map((feature, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow border-border/50">
                  <feature.icon className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Eligibility Requirements */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Free & Premium Listings
              </h2>
              <p className="text-lg text-muted-foreground">
                To qualify for any listing, you must meet our standards
              </p>
            </div>

            <Card className="p-8 mb-8 border-2 border-primary/20">
              <h3 className="text-2xl font-bold mb-6 text-center">Eligibility Requirements</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <Star className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h4 className="font-semibold mb-2">4.9+ Star Rating</h4>
                  <p className="text-sm text-muted-foreground">Verified client reviews only</p>
                </div>
                <div className="text-center">
                  <Shield className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h4 className="font-semibold mb-2">Experience</h4>
                  <p className="text-sm text-muted-foreground">Proven track record required</p>
                </div>
                <div className="text-center">
                  <TrendingUp className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h4 className="font-semibold mb-2">Great Reviews</h4>
                  <p className="text-sm text-muted-foreground">Authentic client testimonials</p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Brand Builder Premium Section */}
        <section className="container mx-auto px-4 py-16 md:py-24 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Award className="w-4 h-4" />
                Premium Tier
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Brand Builder: The Smart Investment
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Unlike other real estate sites, Brand Builder is just a low monthly fee. No per-lead charges. 
                No cuts of your closed deals. Your contact info is displayed directly—clients reach you, not a paywall.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {brandBuilderBenefits.map((benefit, index) => (
                <Card key={index} className="p-6 bg-card/50 backdrop-blur">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <benefit.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                      <p className="text-muted-foreground text-sm">{benefit.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="bg-card rounded-lg p-8 text-center border-2 border-primary/20 shadow-xl">
              <h3 className="text-2xl font-bold mb-4">
                The Time to Invest Is Now
              </h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Like SEO, becoming an AI citation takes time. But once you're the answer, you're incredibly 
                difficult to displace. The agents who invest now will dominate their markets for years to come.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto">
            <Card className="p-8 md:p-12 text-center border-primary/20 shadow-xl">
              <Sparkles className="w-16 h-16 text-primary mx-auto mb-6" />
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Check Your Current Listing
              </h2>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                See how you're currently listed and discover what Brand Builder can do for your business. 
                Then schedule 15 minutes with our founder to discuss your strategy.
              </p>

              <div className="flex justify-center">
                <Button 
                  size="lg"
                  onClick={() => navigate('/agent-setup')}
                  className="text-lg px-8 py-6 group"
                >
                  Check Your Current Listing
                  <Search className="ml-2 w-5 h-5" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mt-6">
                4.9+ rating required • Experience matters • AI-first platform
              </p>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}