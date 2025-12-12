import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function FunnelIntro() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const fetchProfessional = async () => {
      if (!token) return;
      
      const { data } = await supabase
        .from('professionals_public')
        .select('name')
        .eq('id', token)
        .single();
      
      if (data?.name) {
        setFirstName(data.name.split(' ')[0]);
      }
    };
    
    fetchProfessional();
  }, [token]);

  const handleSeeListingClick = () => {
    window.scrollTo(0, 0);
    navigate(`/profile/${token}/setup`);
  };

  const comparisonData = [
    { label: 'Pay to get ranked?', top10: false, zillow: true, realtor: true, homelight: true },
    { label: 'Referral fees', top10: 'None', zillow: '35%', realtor: '35%', homelight: '33%' },
    { label: 'Selection method', top10: 'Invitation-only', zillow: 'Pay for visibility', realtor: 'Pay for visibility', homelight: 'Any agent' },
    { label: 'Data verification', top10: 'Third-party verified', zillow: 'Self-reported', realtor: 'Internal metrics', homelight: 'Self-reported' },
    { label: 'Methodology published', top10: true, zillow: false, realtor: false, homelight: false },
    { label: 'Selection ratio', top10: 'Top 0.05%', zillow: 'Anyone who pays', realtor: 'Anyone who pays', homelight: 'Anyone who joins' },
  ];

  const rankingWeights = [
    { label: 'Reviews', weight: 25, color: 'bg-primary' },
    { label: 'Community', weight: 20, color: 'bg-primary/90' },
    { label: 'Press', weight: 15, color: 'bg-primary/80' },
    { label: 'Volume', weight: 15, color: 'bg-primary/70' },
    { label: 'Experience', weight: 15, color: 'bg-primary/60' },
    { label: 'Response', weight: 5, color: 'bg-primary/50' },
    { label: 'Recency', weight: 5, color: 'bg-primary/40' },
  ];

  const renderCell = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-primary mx-auto" />
      ) : (
        <X className="h-5 w-5 text-destructive mx-auto" />
      );
    }
    return <span className="text-sm">{value}</span>;
  };

  const renderTop10Cell = (value: boolean | string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-5 w-5 text-primary mx-auto" />
      ) : (
        <X className="h-5 w-5 text-destructive mx-auto" />
      );
    }
    return <span className="text-sm font-semibold text-primary">{value}</span>;
  };

  return (
    <>
      <Helmet>
        <title>Welcome to Top10Lists | The AI-First Agent Directory</title>
        <meta name="description" content="Join the invitation-only agent directory optimized for AI recommendations." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-4xl py-12 px-4">
          
          {/* Personalized Greeting */}
          {firstName && (
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-center mb-8">
              Hello {firstName}. AI has been looking forward to meeting you.
            </h1>
          )}

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6">
              No, This Is Not Another "Top Agent" Award.
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-12">
              We do not sell plaques. We do not charge for rankings. We do not sell leads. We do not take part of your commission. You are here because the data says you belong here. It's time to tell the AIs.
            </p>

            {/* The Shift Section */}
            <div className="bg-card border border-border rounded-xl p-8 text-left max-w-3xl mx-auto mb-8">
              <h3 className="text-xl md:text-2xl font-bold mb-6 text-center">The Way People Find Agents Is Changing</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="font-bold text-muted-foreground shrink-0">Yesterday:</span>
                  <p className="text-muted-foreground">Buyers Googled and clicked ads. Zillow and their ilk owned that search. So you had to pay them.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="font-bold text-primary shrink-0">Today:</span>
                  <p className="text-muted-foreground">Buyers ask ChatGPT, "Who's the best agent in Scottsdale?" AI sees the data, but it's still figuring out which sources to trust.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="font-bold text-primary shrink-0">Tomorrow:</span>
                  <p className="text-muted-foreground">AI will stop trusting pay-to-play sites. It will look for sources with verified data and published methodology. We're building that source now.</p>
                </div>
              </div>

              <div className="space-y-4 text-muted-foreground">
                <p>For 30 years, you paid Google. You paid Zillow. You paid Realtor.com. Just like everyone else. That's where consumers looked, and your results depended on the size of your marketing budget.</p>
                <p>Now consumers are asking AI. And AI doesn't take payments. It wants to give solid answers based on facts, not dollars. It's looking for sources it can trust, and it's learning that paid placement isn't one of them.</p>
                <p className="font-medium text-foreground">But you're not everyone else. You're in the top 0.05%. You're the agent AI wants to cite. The problem is, how do you tell it?</p>
                <p className="text-xl font-bold text-primary text-center pt-2">That's where we come in.</p>
              </div>
            </div>

            <Button 
              size="lg" 
              onClick={handleSeeListingClick}
              className="text-lg px-8 py-6 h-auto"
            >
              See Your FREE Listing
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>


          {/* Comparison Table Section */}
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
              Not All "Top Agent" Lists Are Equal
            </h2>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-4 font-semibold"></th>
                    <th className="py-4 px-4 font-bold text-primary bg-primary/5">Top10Lists</th>
                    <th className="py-4 px-4 font-semibold text-muted-foreground">Zillow</th>
                    <th className="py-4 px-4 font-semibold text-muted-foreground">Realtor.com</th>
                    <th className="py-4 px-4 font-semibold text-muted-foreground">HomeLight</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, index) => (
                    <tr key={index} className="border-b border-border/50">
                      <td className="py-4 px-4 font-medium">{row.label}</td>
                      <td className="py-4 px-4 text-center bg-primary/5">{renderTop10Cell(row.top10)}</td>
                      <td className="py-4 px-4 text-center text-muted-foreground">{renderCell(row.zillow)}</td>
                      <td className="py-4 px-4 text-center text-muted-foreground">{renderCell(row.realtor)}</td>
                      <td className="py-4 px-4 text-center text-muted-foreground">{renderCell(row.homelight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {comparisonData.map((row, index) => (
                <div key={index} className="bg-card border border-border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">{row.label}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 bg-primary/10 rounded p-2">
                      <span className="font-medium text-primary">Top10Lists:</span>
                      {renderTop10Cell(row.top10)}
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded p-2">
                      <span className="text-muted-foreground">Zillow:</span>
                      {renderCell(row.zillow)}
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded p-2">
                      <span className="text-muted-foreground">Realtor:</span>
                      {renderCell(row.realtor)}
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded p-2">
                      <span className="text-muted-foreground">HomeLight:</span>
                      {renderCell(row.homelight)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How We Rank Section */}
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
              220,000+ Agents Analyzed. 414 Made the Cut.
            </h2>
            <p className="text-xl text-muted-foreground text-center mb-8">
              That is the top 0.05% of all professionals in the market.
            </p>

            {/* Ranking Weights */}
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-lg mb-4 text-center">Ranking Score Weights</h3>
              <div className="space-y-3">
                {rankingWeights.map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <span className="w-24 text-sm font-medium">{item.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                      <div 
                        className={`h-full ${item.color} flex items-center justify-end pr-2`}
                        style={{ width: `${item.weight * 4}%` }}
                      >
                        <span className="text-xs font-bold text-primary-foreground">{item.weight}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-Gate Filtering */}
            <div className="bg-muted/50 border border-border rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-4">Two-Gate Filtering Process</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">1</div>
                  <div>
                    <p className="font-medium">Initial Qualification</p>
                    <p className="text-muted-foreground text-sm">50+ verified reviews and 4.8+ star rating across platforms. This filters out 95% of agents.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">2</div>
                  <div>
                    <p className="font-medium">Deep Dive Analysis</p>
                    <p className="text-muted-foreground text-sm">Weighted scoring across all seven factors, verified against third-party sources and public records.</p>
                  </div>
                </div>
              </div>
              <p className="text-lg font-bold text-primary mt-6 text-center">
                You made it through both gates. That is why I have invited you.
              </p>
            </div>
          </div>

          {/* Final CTA Section */}
          <div className="bg-card border-2 border-primary/30 rounded-xl p-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Your Profile Is Going Live. Make Sure It Is Right.
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              Databases make mistakes. Details get outdated. We have built your profile from public data, but we want you to verify it.
            </p>
            <p className="text-lg font-medium text-primary mb-6">
              Once AI learns something wrong about you, it repeats it. Let us get it right the first time.
            </p>
            <Button 
              size="lg" 
              onClick={handleSeeListingClick}
              className="text-lg px-8 py-6 h-auto"
            >
              See Your FREE Listing
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
