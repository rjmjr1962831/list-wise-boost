import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { CheckCircle, MessageSquare, Mail, Shield } from "lucide-react";

const OptInPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>SMS & Email Opt-In Policy | Top10Lists.us</title>
        <meta name="description" content="Learn about our SMS and email opt-in policy. We obtain explicit consent before sending any communications to real estate agents." />
        <link rel="canonical" href="https://top10lists.us/opt-in" />
      </Helmet>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            SMS & Email Opt-In Policy
          </h1>
          <p className="text-lg text-muted-foreground">
            Top10Lists.us Communication Consent Policy
          </p>
        </header>

        <div className="space-y-8">
          {/* Overview Section */}
          <section className="bg-card border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold">Consent Collection Overview</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Top10Lists.us collects explicit opt-in consent from real estate agents before sending 
              any SMS text messages or email communications. We are committed to compliance with 
              TCPA regulations, carrier guidelines, and industry best practices for A2P messaging.
            </p>
          </section>

          {/* How We Collect Consent */}
          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">How We Collect Consent</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-medium">Profile Verification Process</h3>
                  <p className="text-muted-foreground text-sm">
                    When real estate agents verify or claim their profile on our platform, they must 
                    explicitly check a consent checkbox before proceeding.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-medium">Clear Consent Language</h3>
                  <p className="text-muted-foreground text-sm">
                    The consent checkbox displays the following language that users must acknowledge:
                  </p>
                  <blockquote className="mt-2 p-3 bg-muted/50 border-l-4 border-primary text-sm italic">
                    "We will send you periodic updates by mail and text. Please check the box to say you understand."
                  </blockquote>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-medium">Mandatory Before Submission</h3>
                  <p className="text-muted-foreground text-sm">
                    The form submission button is disabled until the user explicitly checks the consent 
                    checkbox. Users cannot proceed without providing consent.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Message Types */}
          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Types of Messages We Send</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                <MessageSquare className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h3 className="font-medium">SMS Text Messages</h3>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>• Profile verification codes</li>
                    <li>• Listing update notifications</li>
                    <li>• Subscription confirmations</li>
                    <li>• Service announcements</li>
                  </ul>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
                <Mail className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h3 className="font-medium">Email Communications</h3>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    <li>• Profile synthesis notifications</li>
                    <li>• Ranking updates</li>
                    <li>• Subscription receipts</li>
                    <li>• Platform announcements</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Opt-Out Information */}
          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">How to Opt-Out</h2>
            <p className="text-muted-foreground mb-4">
              Recipients can opt-out of communications at any time:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="font-medium text-foreground">SMS:</span> 
                Reply STOP to any text message
              </li>
              <li className="flex items-center gap-2">
                <span className="font-medium text-foreground">Email:</span> 
                Click the unsubscribe link in any email
              </li>
              <li className="flex items-center gap-2">
                <span className="font-medium text-foreground">Contact Us:</span> 
                Email hello@top10lists.us with your opt-out request
              </li>
            </ul>
          </section>

          {/* Company Information */}
          <section className="bg-card border rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Company Information</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium text-foreground">Company:</dt>
                <dd className="text-muted-foreground">Top10Lists.us</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-foreground">Website:</dt>
                <dd className="text-muted-foreground">
                  <a href="https://top10lists.us" className="text-primary hover:underline">
                    https://top10lists.us
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-foreground">Contact Email:</dt>
                <dd className="text-muted-foreground">
                  <a href="mailto:hello@top10lists.us" className="text-primary hover:underline">
                    hello@top10lists.us
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-foreground">Purpose:</dt>
                <dd className="text-muted-foreground">
                  AI and human-curated directory of top real estate agents in the United States
                </dd>
              </div>
            </dl>
          </section>

          {/* Last Updated */}
          <footer className="text-center text-sm text-muted-foreground pt-8 border-t">
            <p>Last Updated: December 2024</p>
            <p className="mt-2">
              <Link to="/" className="text-primary hover:underline">
                Return to Home
              </Link>
              {" • "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              {" • "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default OptInPolicy;
