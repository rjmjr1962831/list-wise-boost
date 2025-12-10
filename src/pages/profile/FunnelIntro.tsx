import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Users, Target, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function FunnelIntro() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const handleSeeListingClick = () => {
    navigate(`/profile/${token}/listing`);
  };

  return (
    <>
      <Helmet>
        <title>Welcome to Top10Lists | The AI-First Agent Directory</title>
        <meta name="description" content="Join the invitation-only agent directory optimized for AI recommendations." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Hero Section */}
        <div className="container max-w-4xl py-12 px-4">
          {/* AI Stat Banner */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-8 text-center">
            <p className="text-xl md:text-2xl font-bold text-primary">
              78% of all home buyers and sellers check for AI recommendations before choosing an agent.
            </p>
          </div>

          {/* Main Headline */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              This Isn't Another Agent Directory.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Top10Lists is invitation-only and built from the ground up for AI.
            </p>
          </div>

          {/* Differentiators */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Card className="border-2 border-primary/20 bg-card/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Invitation Only</h3>
                    <p className="text-muted-foreground">
                      You were selected based on your performance. Not everyone gets in—that's what makes it valuable.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-card/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Optimized for AI</h3>
                    <p className="text-muted-foreground">
                      Built specifically so ChatGPT, Claude, and Perplexity recommend YOU when buyers ask for agents.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-card/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Become THE Answer</h3>
                    <p className="text-muted-foreground">
                      When AI recommends an agent, it gives a name—not a link. You become the answer, not one of many.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-card/50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Not Another Zillow</h3>
                    <p className="text-muted-foreground">
                      No drowning in a sea of 500 agents. Only top 10 per city. Quality over quantity.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison */}
          <div className="bg-card border rounded-xl p-6 mb-12">
            <h2 className="text-xl font-semibold mb-6 text-center">How We're Different</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-medium text-muted-foreground mb-4">Traditional Directories</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-yellow-500 mt-1">✕</span>
                    Hundreds of agents per market
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-yellow-500 mt-1">✕</span>
                    Pay-to-play rankings
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-yellow-500 mt-1">✕</span>
                    Built for human search
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-yellow-500 mt-1">✕</span>
                    Anyone can join
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-primary mb-4">Top10Lists.us</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    Only 10 agents per city
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    Merit-based selection
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    Built for AI recommendations
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    Invitation only
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Button 
              size="lg" 
              onClick={handleSeeListingClick}
              className="text-lg px-8 py-6 h-auto"
            >
              See Your Listing
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Your free listing is already created. Review and customize it.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
