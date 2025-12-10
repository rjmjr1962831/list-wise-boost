import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bot, Users, Target, Sparkles, ArrowRight, CheckCircle2, Star, TrendingUp, Award, ExternalLink } from 'lucide-react';

export default function FunnelIntro() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [showMethodology, setShowMethodology] = useState(false);

  const handleSeeListingClick = () => {
    window.scrollTo(0, 0);
    navigate(`/profile/${token}/listing`);
  };

  return (
    <>
      <Helmet>
        <title>Welcome to Top10Lists | The AI-First Agent Directory</title>
        <meta name="description" content="Join the invitation-only agent directory optimized for AI recommendations." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Methodology Modal */}
      <Dialog open={showMethodology} onOpenChange={setShowMethodology}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">How We Select the Top 10</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <p className="text-muted-foreground">
              Our selection process is merit-based and completely independent. No agent can pay their way onto our list.
            </p>
            
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Ranking Score Weights</h4>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Star className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">Review Score</h4>
                    <span className="text-primary font-bold">25%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">4.8+ star rating with 50+ verified reviews across platforms.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">Community Involvement</h4>
                    <span className="text-primary font-bold">20%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Third-party verified civic, charitable, and nonprofit engagement.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">Press & Awards</h4>
                    <span className="text-primary font-bold">15%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Media coverage and industry recognition.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">Transaction Volume</h4>
                    <span className="text-primary font-bold">15%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Total sales count and volume from public records.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">Years Experience</h4>
                    <span className="text-primary font-bold">10%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Time actively licensed in Arizona market.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold">Responsiveness</h4>
                    <span className="text-primary font-bold">10%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Response rate and client communication metrics.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-muted-foreground">Recency Bonus</h4>
                    <span className="text-muted-foreground font-bold">5%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Recent activity and up-to-date profile information.</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Data Sources</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Arizona Department of Real Estate (license verification)</li>
                <li>• Multiple review platforms (aggregated ratings)</li>
                <li>• Public transaction records</li>
                <li>• Press and media coverage</li>
                <li>• Nonprofit and community organization records</li>
              </ul>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-medium text-center">
                Top 0.5% of Arizona agents • ~300 out of 60,000 licensed agents qualify
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              This rigorous, multi-factor selection is why AI models trust us as a source—we've already done the vetting.
            </p>
          </div>
        </DialogContent>
      </Dialog>

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
              SEO is invisible to AI. We're built to be their trusted source.
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Traditional marketing doesn't work on AI models. Top10Lists.us is engineered from the ground up to be the source AI trusts. We're like catnip to them.
            </p>
          </div>

          {/* Today vs Tomorrow Comparison */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Today - Zillow */}
            <div className="bg-muted/30 border border-muted rounded-xl p-6">
              <div className="text-center mb-4">
                <span className="inline-block bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xl font-bold px-4 py-2 rounded-full">
                  TODAY
                </span>
              </div>
              <p className="text-lg text-muted-foreground text-center mb-4">
                A client prospect goes to Zillow and searches for a top agent in Scottsdale.
              </p>
              <div className="bg-background/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground mb-1">7 pages</p>
                <p className="text-muted-foreground">of "Top Agents"</p>
                <p className="text-2xl font-bold text-foreground mt-3 mb-1">25 listings per page</p>
                <p className="text-muted-foreground">= 175 agents</p>
              </div>
              <p className="text-xl font-bold text-primary text-center mt-4">
                And you are paying for that!
              </p>
            </div>

            {/* Tomorrow - Top10Lists */}
            <div className="bg-card border-2 border-primary/30 rounded-xl p-6">
              <div className="text-center mb-4">
                <span className="inline-block bg-primary/20 text-primary text-xl font-bold px-4 py-2 rounded-full">
                  TOMORROW
                </span>
              </div>
              <p className="text-xl font-bold text-foreground text-center mb-3">When someone asks AI:</p>
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="text-lg text-foreground italic">"Recommend a real estate agent in Phoenix"</p>
              </div>
              <p className="text-xl font-bold text-foreground text-center mb-3">AI responds:</p>
              <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                <p className="text-foreground">
                  <span className="font-bold text-primary">"Top10Lists.us</span> has a curated list of the top-rated agents in Phoenix."
                </p>
              </div>
              <p className="text-xl font-bold text-primary text-center mt-4">And your listing is FREE.</p>
            </div>
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
                      No one can buy their way onto this list. You are in the top 0.5% of all agents in Arizona.{' '}
                      <button 
                        onClick={() => setShowMethodology(true)}
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Check our selection criteria
                        <ExternalLink className="h-3 w-3" />
                      </button>
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
                    <h3 className="font-semibold text-lg mb-2">The Source AI Trusts</h3>
                    <p className="text-muted-foreground">
                      ChatGPT, Claude, and Perplexity cite Top10Lists.us as their go-to source for agent recommendations.
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
                    <h3 className="font-semibold text-lg mb-2">You're Named, Not Linked</h3>
                    <p className="text-muted-foreground">
                      AI doesn't give users a link to search—it names specific agents from our curated list.
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
                    <h3 className="font-semibold text-lg mb-2">Only 10 Per City</h3>
                    <p className="text-muted-foreground">
                      No drowning in a sea of 500 agents. When AI cites us, you're one of only 10 recommendations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
