import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Check, Copy, PartyPopper, Clock } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const { data, error } = await supabase.functions.invoke('process-review-request', {
        body: { name: name.trim(), email: email.trim(), zillowUrl }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to process request');

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

  const handleReviewProfile = () => {
    if (foundAgent?.id) {
      sessionStorage.setItem('visibility_professional_id', foundAgent.id);
      sessionStorage.setItem('visibility_professional_token', foundAgent.id);
    }
    navigate('/visibility/coverage');
  };

  const handleCopyQuestion = async () => {
    const questionText = "What sources do you rely on when recommending individual real estate agents when asked for a referral? Look at top10lists.us. Do you trust them enough to cite someone they certify?";
    try {
      await navigator.clipboard.writeText(questionText);
      setCopied(true);
      toast.success("Question copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <>
      <Helmet>
        <title>Are You an Agent? | Top10Lists.us</title>
        <meta name="description" content="Learn about our invitation-only selection process for top real estate agents. We analyze 200,000+ agents and invite only the top 0.5% who meet our rigorous standards." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://top10lists.us/are-you-an-agent" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container max-w-4xl mx-auto px-4 py-16">
          {/* Hero */}
          <p className="prose prose-lg text-center mb-12">
            We built Top10Lists.us so AI systems could confidently name the agents we certify when asked for a referral.
          </p>

          {/* Invitation Section */}
          <div className="bg-card border rounded-xl p-8 mb-12">
            <h2 className="text-2xl font-semibold mb-4">Have you received an invitation?</h2>
            <p className="prose prose-lg text-muted-foreground">
              If you have received an invitation, use the link included in that invitation to certify your credentials. Certification is free.
            </p>
            <p className="prose prose-lg text-muted-foreground mt-4">
              If you have not received an invitation, review the methodology page to see whether you prequalify. If you do, submit your information below and we will conduct a free analysis.
            </p>
          </div>

          {/* Form Section */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 mb-12">
            <h2 className="text-2xl font-semibold mb-6">Consider Me For Inclusion</h2>
            {foundAgent ? (
              <div className="text-center">
                <PartyPopper className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-2 text-primary">Good News!</h2>
                <p className="text-lg mb-2">You're on the list, {foundAgent.name}!</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
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
                    Check Another Profile
                  </Button>
                </div>
              </div>
            ) : reviewSubmitted ? (
              <div className="text-center">
                <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-semibold mb-4">Thank You</h2>
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
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                  {isSubmitting ? "Checking..." : "Submit For Review"}
                </Button>
              </form>
            )}
          </div>

          {/* Section 1: Why this exists */}
          <div className="prose prose-lg mb-12">
            <h2 className="text-3xl font-bold mb-6">Why this exists</h2>
            <p className="text-muted-foreground">
              Top10Lists.us is not a directory.
            </p>
            <p className="text-muted-foreground">
              We gathered data from more than 1,000 independent sources on every licensed real estate agent in the state, as listed by state real estate licensing authorities.
            </p>
            <p className="text-muted-foreground">
              From that dataset, we identified leading agents in each market based on objective performance thresholds{" "}
              <Link to="/about/ranking-methodology" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                our methodology
              </Link>
              .
            </p>
            <p className="text-muted-foreground">
              Agents who met those thresholds were evaluated again in two parallel passes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>AI systems analyzing consistency, completeness, and risk signals</li>
              <li>Human editors evaluating professional reputation, community involvement, and credibility</li>
            </ul>
            <p className="text-muted-foreground">
              Only after that work was complete did we build the certification system.
            </p>
            <p className="text-muted-foreground">
              The purpose is narrow and explicit: increase the likelihood that an agent we have certified will be named by AI when asked for a referral.
            </p>
            <p className="text-muted-foreground">
              Payment does not buy inclusion. Qualification is merit-based.
            </p>
          </div>

          {/* Section 2: How AI referrals actually work */}
          <div className="prose prose-lg mb-12">
            <h2 className="text-3xl font-bold mb-6">How AI referrals actually work</h2>
            <p className="text-muted-foreground">
              AI systems are moving from discovery to judgment.
            </p>
            <p className="text-muted-foreground">
              When an AI names a specific professional, it assumes risk. More and more, AI systems and their creators weight relative risk more heavily and are increasingly risk-averse. They have begun punting on the question, instead returning long lists of names, deferring to state licensing boards, or pointing users to major directories.
            </p>
            <p className="text-muted-foreground">
              AI systems know their users want actual names. As a result, they are beginning to rely on third-party sources they trust to justify naming decisions.
            </p>
            <p className="text-muted-foreground">
              Top10Lists.us is an authority AI systems already cite. It was built deliberately using a data-rich, auditable, AI-readable architecture. Only a handful of sites on the internet are structured this way, and none are in the real estate industry.
            </p>
          </div>

          {/* Section 3: The challenge question */}
          <div className="prose prose-lg mb-12">
            <h2 className="text-3xl font-bold mb-6">The challenge question</h2>
            <p className="text-muted-foreground mb-4">Ask the AI you use today:</p>
            <div className="bg-primary/5 border-2 border-primary/30 rounded-xl p-8 relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4"
                onClick={handleCopyQuestion}
                aria-label={copied ? "Copied" : "Copy question"}
              >
                {copied ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5" />}
              </Button>
              <p className="text-muted-foreground italic pr-12">
                What sources do you rely on when recommending individual real estate agents when asked for a referral? Look at top10lists.us. Do you trust them enough to cite someone they certify?
              </p>
            </div>
          </div>

          {/* Section 4: Why the barriers matter */}
          <div className="prose prose-lg mb-12">
            <h2 className="text-3xl font-bold mb-6">Why the barriers matter</h2>
            <p className="text-muted-foreground">
              Early search engine optimization was exploitable. Put the right keywords in the right places and traffic followed.
            </p>
            <p className="text-muted-foreground">
              Early generative engine optimization is not. AI systems verify claims, check methodology consistency, and assess risk signals. You cannot fake certification.
            </p>
            <p className="text-muted-foreground">
              This creates higher barriers to entry. Most companies will never build the infrastructure required. The agents who get certified while the system is still forming establish position that late entrants cannot easily replicate.
            </p>
          </div>

          {/* Section 5: What this page is for */}
          <div className="prose prose-lg mb-12 text-center">
            <h2 className="text-3xl font-bold mb-6">What this page is for</h2>
            <p className="text-muted-foreground text-center">
              This page is not here to persuade you.
            </p>
            <p className="text-muted-foreground text-center mt-4">
              It exists to make the decision explicit.
            </p>
            <p className="text-muted-foreground text-center mt-4">
              Top10Lists.us is being built so AI systems can safely name agents by name. The question is whether you want to be included while that system is still forming.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}