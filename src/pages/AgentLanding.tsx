import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  CheckCircle2, 
  Star, 
  TrendingUp, 
  Users, 
  Shield,
  Sparkles,
  ArrowRight,
  BadgeCheck
} from 'lucide-react';

export default function AgentLanding() {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Star,
      title: 'Premium Placement',
      description: 'Get featured in top 10 lists for your market with verified badge'
    },
    {
      icon: TrendingUp,
      title: 'Increased Visibility',
      description: 'Reach motivated buyers and sellers actively searching for agents'
    },
    {
      icon: Users,
      title: 'Quality Leads',
      description: 'Connect with pre-qualified clients in your target neighborhoods'
    },
    {
      icon: Shield,
      title: 'Verified Profile',
      description: 'Build trust with license verification and authentic reviews'
    }
  ];

  const features = [
    'Prominent listing in curated top 10 agent rankings',
    'Verified badge and professional profile showcase',
    'Direct contact form for lead generation',
    'Integration with your Zillow reviews and stats',
    'Multi-city coverage for broader market reach',
    'SEO-optimized profile for organic search traffic'
  ];

  return (
    <>
      <Helmet>
        <title>Join Top10Lists - Get Listed as a Top Real Estate Agent</title>
        <meta name="description" content="Get featured on Top10Lists and connect with motivated home buyers and sellers. Join Arizona's most trusted directory of top-rated real estate agents." />
        <meta name="keywords" content="real estate agent listing, get more leads, agent directory, top agents, real estate marketing" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-muted/20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-20 pb-16 md:pt-32 md:pb-24">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Exclusive Directory for Top-Performing Agents
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Get Listed on Arizona's
              <span className="text-primary block mt-2">Top Real Estate Agent Directory</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Join the elite group of top-rated agents and connect with motivated clients 
              actively searching for the best professionals in their area.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button 
                size="lg"
                onClick={() => navigate('/agent-onboarding')}
                className="text-lg px-8 py-6 group"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => navigate('/agent-info')}
                className="text-lg px-8 py-6"
              >
                Learn More
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
                <Users className="w-5 h-5 text-primary" />
                <span>500+ Active Agents</span>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Why Top Agents Choose Top10Lists
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Stand out from the competition with premium placement and verified credentials
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow border-border/50">
                  <benefit.icon className="w-12 h-12 text-primary mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything You Need to Succeed
              </h2>
              <p className="text-lg text-muted-foreground">
                Comprehensive profile features designed to convert visitors into clients
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start gap-3 p-4 rounded-lg hover:bg-background/50 transition-colors">
                  <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-foreground">{feature}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing CTA Section */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl mx-auto">
            <Card className="p-8 md:p-12 text-center border-primary/20 shadow-xl">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                Limited Spots Available
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Generate More Leads?
              </h2>
              
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join hundreds of top-performing agents already growing their business with Top10Lists
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Button 
                  size="lg"
                  onClick={() => navigate('/agent-onboarding')}
                  className="text-lg px-8 py-6 group"
                >
                  Start Your Application
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Quick 5-minute application • License verification required • Premium placement
              </p>
            </Card>
          </div>
        </section>

        {/* FAQ Preview */}
        <section className="container mx-auto px-4 py-16 md:py-24 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Have Questions?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Learn more about how Top10Lists can help grow your real estate business
            </p>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate('/agent-info')}
            >
              View Full Details
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
