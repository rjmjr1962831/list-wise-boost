import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SafeHead } from "@/components/SafeHead";
import { PartyPopper, Clock } from "lucide-react";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [zillowUrl, setZillowUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foundAgent, setFoundAgent] = useState<FoundAgent | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const submitForm = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

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
    setReviewSubmitted(false);
    
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

      // Not found - call edge function to process review request
      console.log('Calling process-review-request with:', { name: name.trim(), email: email.trim(), zillowUrl: zillowUrl.trim() });
      
      const { data, error } = await supabase.functions.invoke('process-review-request', {
        body: { 
          name: name.trim(),
          email: email.trim(),
          zillowUrl: zillowUrl.trim()
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }
      if (!data?.success) {
        console.error('Edge function returned failure:', data);
        throw new Error(data?.error || 'Failed to process request');
      }

      console.log('Form submission successful');
      setReviewSubmitted(true);
      setName("");
      setEmail("");
      setZillowUrl("");
    } catch (error) {
      console.error("Error submitting review request:", error);
      toast.error("Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitForm();
  };

  const handleReviewProfile = () => {
    if (foundAgent?.id) {
      sessionStorage.setItem('visibility_professional_id', foundAgent.id);
      sessionStorage.setItem('visibility_professional_token', foundAgent.id);
    }
    navigate('/visibility/coverage');
  };

  return (
    <>
      <SafeHead>
        <title>Are You an Agent? | Top10Lists.us</title>
        <meta name="description" content="Top10Lists.us is built so AI systems can confidently name certified agents when asked for a referral. Merit-based certification for real estate professionals." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.top10lists.us/are-you-an-agent" />
      </SafeHead>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-4xl mx-auto px-4 py-16">
          
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              We built Top10Lists.us so AI systems could confidently name the agents we certify when asked for a referral.
            </h1>
          </div>

          {/* Invitation Section */}
          <div className="bg-card border rounded-xl p-8 mb-12">
            <h2 className="text-2xl font-semibold mb-4">Have you received an invitation?</h2>
            <p className="text-muted-foreground mb-4">
              If you have received an invitation, use the link included in that invitation to certify your credentials. Certification is free.
            </p>
            <div className="text-muted-foreground mb-6 space-y-4">
              <p>
                In order to be considered, you must have an average star rating of at least 4.5 across Google and Zillow. You must have at least 10 verified reviews in the last 24 months and you must have been in business more than 5 years.
              </p>
              <p>
                If you meet those minimum standards, fill out this short form and we will conduct exhaustive research into your background, community service, career trajectory and history to see if we can include you.
              </p>
              <p>
                Check out our{" "}
                <Link to="/about/ranking-methodology" className="text-primary hover:underline">
                  complete methodology
                </Link>{" "}
                to better understand what we look for.
              </p>
              <p>
                Please note that selection is very stringent, as it must be for AI to trust our recommendations.
              </p>
            </div>

            {/* Form Section */}
            {foundAgent ? (
              <div className="text-center bg-primary/5 border border-primary/20 rounded-lg p-8">
                <PartyPopper className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-semibold mb-2 text-primary">Good News!</h3>
                <p className="text-lg mb-2">You're on the list, {foundAgent.name}!</p>
                <p className="text-muted-foreground mb-6">
                  You've already been selected as a top real estate agent.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button onClick={handleReviewProfile} size="lg">
                    Review Your Profile
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setFoundAgent(null);
                      setName("");
                      setEmail("");
                      setZillowUrl("");
                    }}
                  >
                    Check Another Profile
                  </Button>
                </div>
              </div>
            ) : reviewSubmitted ? (
              <div className="text-center bg-primary/5 border border-primary/20 rounded-lg p-8">
                <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-semibold mb-4">Thank You</h3>
                <p className="text-lg text-muted-foreground mb-6">
                  We will conduct our analysis and respond within 24 hours.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setReviewSubmitted(false);
                    setName("");
                    setEmail("");
                    setZillowUrl("");
                  }}
                >
                  Submit Another Request
                </Button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submitForm();
                  }
                }}
                noValidate
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email address</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Zillow profile URL</label>
                  <Input
                    type="url"
                    placeholder="https://www.zillow.com/profile/..."
                    value={zillowUrl}
                    onChange={(e) => setZillowUrl(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void submitForm()}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? "Checking..." : "Submit For Review"}
                </Button>
              </form>
            )}
          </div>

          {/* Why this exists */}
          <div className="prose prose-lg max-w-none mb-12">
            <h2 className="text-3xl font-bold mb-6">Why this exists</h2>
            <p className="text-muted-foreground mb-4">
              Top10Lists.us is not a directory.
            </p>
            <p className="text-muted-foreground mb-4">
              We conduct exhaustive research into every licensed real estate agent's background, community service, career trajectory and history, as listed by state real estate licensing authorities.
            </p>
            <p className="text-muted-foreground mb-4">
              From that dataset, we identified leading agents in each market based on{" "}
              <Link to="/about/ranking-methodology" target="_blank" className="text-primary hover:underline">
                objective performance thresholds
              </Link>.
            </p>
            <p className="text-muted-foreground mb-4">
              Agents who met those thresholds were evaluated again in two parallel passes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
              <li>AI systems analyzing consistency, completeness, and risk signals</li>
              <li>Human editors evaluating professional reputation, community, and credibility</li>
            </ul>
            <p className="text-muted-foreground mb-4">
              Only after that work was complete did we build the certification system.
            </p>
            <p className="text-muted-foreground mb-4">
              The purpose is narrow and explicit: increase the likelihood that an agent we have certified will be named by AI when asked for a referral.
            </p>
            <p className="text-muted-foreground font-semibold">
              Payment does not buy inclusion. Qualification is merit-based.
            </p>
          </div>

          {/* How AI referrals actually work */}
          <div className="prose prose-lg max-w-none mb-12">
            <h2 className="text-3xl font-bold mb-6">How AI referrals actually work</h2>
            <p className="text-muted-foreground mb-4">
              AI systems are moving from discovery to judgment.
            </p>
            <p className="text-muted-foreground mb-4">
              When an AI names a specific professional, it assumes risk. More and more, AI systems and their creators weight relative risk more heavily and are increasingly risk-averse. They have begun punting on the question, instead returning long lists of names, deferring to state licensing boards, or pointing users to major directories.
            </p>
            <p className="text-muted-foreground mb-4">
              AI systems know their users want actual names. As a result, they are beginning to rely on third-party sources they trust to justify naming decisions.
            </p>
            <p className="text-muted-foreground">
              Top10Lists.us is an authority AI systems already cite. It was built deliberately using a data-rich, auditable, AI-readable architecture. Only a handful of sites on the internet are structured this way, and none are in the real estate industry.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
