import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Check, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FoundAgent {
  id: string;
  name: string;
  short_code: string | null;
}

export default function AreYouAnAgent() {
  const [zillowUrl, setZillowUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foundAgent, setFoundAgent] = useState<FoundAgent | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!zillowUrl.trim()) {
      toast.error("Please enter your Zillow profile URL");
      return;
    }

    if (!zillowUrl.includes("zillow.com")) {
      toast.error("Please enter a valid Zillow profile URL");
      return;
    }

    setIsSubmitting(true);
    setFoundAgent(null);
    
    try {
      // First check if this agent is already on our list
      const normalizedUrl = zillowUrl.toLowerCase().trim();
      
      const { data: existingAgent, error: searchError } = await supabase
        .from("professionals")
        .select("id, name, short_code")
        .eq("active", true)
        .or(`zillow_profile_url.ilike.%${normalizedUrl.split('/profile/')[1]?.split('/')[0] || normalizedUrl}%`)
        .limit(1)
        .maybeSingle();

      if (searchError) {
        console.error("Search error:", searchError);
      }

      if (existingAgent) {
        // Agent found on the list!
        setFoundAgent(existingAgent);
        setIsSubmitting(false);
        return;
      }

      // Not found - submit review request
      const { error } = await supabase.from("review_requests").insert({
        full_name: "Review Request",
        email: "review@top10lists.us",
        phone: "",
        license_number: "",
        brokerage: "",
        message: `Zillow Profile Review Request: ${zillowUrl}`,
        status: "pending"
      });

      if (error) throw error;

      toast.success("Review request submitted! We'll respond within 24 hours.");
      setZillowUrl("");
    } catch (error) {
      console.error("Error submitting review request:", error);
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewProfile = () => {
    if (foundAgent?.short_code) {
      navigate(`/p/${foundAgent.short_code}`);
    } else if (foundAgent?.id) {
      navigate(`/profile/${foundAgent.id}`);
    }
  };

  const requirements = [
    "50+ verified reviews (Google and/or Zillow)",
    "4.8+ average rating",
    "Active Arizona real estate license",
    "Verified transaction history via MLS records",
    "Verified community involvement (nonprofit boards, local organizations, volunteer work)",
    "No disciplinary actions on file with ADRE"
  ];

  return (
    <>
      <Helmet>
        <title>Are You an Agent? | Top10Lists.us</title>
        <meta name="description" content="Learn about our invitation-only selection process for top real estate agents. We analyze 200,000+ agents and invite only the top 0.2% who meet our rigorous standards." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://top10lists.us/are-you-an-agent" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-3xl mx-auto px-4 py-16">
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl font-bold text-center mb-8">
            Invitation Only
          </h1>

          {/* Body Text */}
          <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Our list is available by invitation only after rigorous analysis. We analyze over 200,000 licensed real estate professionals in Arizona and invite only the top 0.2% who meet our standards.
          </p>

          {/* Requirements Section */}
          <div className="bg-card border rounded-xl p-8 mb-12">
            <h2 className="text-2xl font-semibold mb-6">Minimum Requirements</h2>
            <ul className="space-y-4">
              {requirements.map((requirement, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{requirement}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* No Pay Paragraph */}
          <p className="text-muted-foreground text-center mb-12">
            Agents cannot pay for inclusion, and we do not accept applications. All data is independently verified from third-party sources.
          </p>

          {/* Think You Should Be Included Section */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 mb-12">
            {foundAgent ? (
              // Agent found on the list!
              <div className="text-center">
                <PartyPopper className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2 text-primary">Good News!</h2>
                <p className="text-lg mb-2">You're on the list, {foundAgent.name}!</p>
                <p className="text-muted-foreground mb-6">
                  You've already been selected as one of Arizona's top real estate agents.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button onClick={handleReviewProfile} size="lg">
                    Review Your Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setFoundAgent(null);
                      setZillowUrl("");
                    }}
                  >
                    Check Another URL
                  </Button>
                </div>
              </div>
            ) : (
              // Form to submit URL
              <>
                <h2 className="text-2xl font-semibold mb-4">Think you should have been included?</h2>
                <p className="text-muted-foreground mb-6">
                  If you believe you meet our requirements but haven't received an invitation, submit your Zillow profile link below. We'll review your qualifications and respond within 24 hours.
                </p>
                
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
                  <Input
                    type="url"
                    placeholder="Your Zillow Profile URL"
                    value={zillowUrl}
                    onChange={(e) => setZillowUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Checking..." : "Request Review"}
                  </Button>
                </form>
              </>
            )}
          </div>

          {/* Methodology Link Section */}
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Want to know exactly how we built the list?</h2>
            <Link 
              to="/about/ranking-methodology" 
              className="text-primary hover:underline font-medium text-lg"
            >
              View Our Methodology →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}