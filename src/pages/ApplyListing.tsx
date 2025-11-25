import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Sparkles } from 'lucide-react';

const ApplyListing = () => {
  const [searchParams] = useSearchParams();
  const city = searchParams.get('city');
  const state = searchParams.get('state');

  useEffect(() => {
    // Track page view
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_title: 'Apply to be Listed',
        page_location: window.location.href,
        page_path: window.location.pathname,
      });
    }
  }, []);

  const locationText = city 
    ? `${city.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}, ${state?.toUpperCase()}`
    : state 
    ? state.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : '';

  return (
    <>
      <Helmet>
        <title>Apply to be Listed - Top10Lists.us</title>
        <meta name="description" content="Apply to be featured as a top real estate agent in your area. Join our curated directory of premier professionals." />
        <meta property="og:title" content="Apply to be Listed - Top10Lists.us" />
        <meta property="og:description" content="Apply to be featured as a top real estate agent in your area." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                AI-First Platform
              </div>
              <h1 className="text-4xl font-bold mb-4 text-foreground">
                Be the Answer When AI Recommends
              </h1>
              {locationText && (
                <p className="text-xl text-muted-foreground mb-2">
                  Real Estate Agents in {locationText}
                </p>
              )}
              <p className="text-muted-foreground">
                Join the AI citation-optimized directory built for ChatGPT, Gemini, and Claude
              </p>
            </div>

            {/* Application Information */}
            <div className="bg-card rounded-lg shadow-lg p-8 border border-border space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">
                  About Top10Lists.us
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Top10Lists.us uses cutting-edge technology to make LLMs like ChatGPT, Gemini, and Claude cite you 
                  as the expert when clients search for agents in your market. Unlike legacy platforms built for traditional 
                  SEO, we're engineered from day one to be AI-first.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We feature only top-rated agents (4.9+ stars) with proven experience and great reviews. Our platform is 
                  structured, cited by major publications, and optimized for the AI search revolution happening right now.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">
                  Eligibility Requirements
                </h2>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start">
                    <span className="mr-2">⭐</span>
                    <span><strong>4.9+ Star Rating Required</strong> - Verified client reviews demonstrating consistent excellence</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">🏆</span>
                    <span><strong>Proven Experience</strong> - Track record of successful transactions and market knowledge</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✅</span>
                    <span><strong>Great Reviews</strong> - Authentic client testimonials showing exceptional service</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">🔒</span>
                    <span><strong>Active License</strong> - Current real estate license in good standing</span>
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">
                  Selection Criteria
                </h2>
                <p className="text-muted-foreground mb-4">
                  Our editorial team evaluates applications based on multiple factors:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Transaction volume and sales performance</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Client reviews and testimonials</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Years of experience and market expertise</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Professional designations and credentials</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Community involvement and reputation</span>
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">
                  Application Process
                </h2>
                <div className="space-y-4 text-muted-foreground">
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">1. Submit Your Information</h3>
                    <p>Complete the application form with your professional details, license information, and market data.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">2. Editorial Review</h3>
                    <p>Our team reviews your application against our selection criteria, typically within 5-7 business days.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">3. License Verification</h3>
                    <p>We verify your real estate license status with state regulatory authorities.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">4. Profile Creation</h3>
                    <p>Upon approval, we'll create your professional profile featuring your expertise and achievements.</p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">
                  Free vs. Brand Builder Premium
                </h2>
                <div className="space-y-4">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <h3 className="font-semibold text-foreground mb-2">Free Listing</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>Basic profile in AI-optimized list format</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span>Structured for LLM citation</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-primary/5 rounded-lg p-4 border-2 border-primary/20">
                    <h3 className="font-semibold text-foreground mb-2">Brand Builder Premium</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Simple monthly fee</strong> - No per-lead charges, no deal cuts</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Direct contact display</strong> - Phone and email front and center</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Priority placement</strong> - Enhanced visibility in AI citations</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">✓</span>
                        <span><strong>Publication strategy</strong> - Regular features in major outlets</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="bg-muted/30 rounded-lg p-6">
                <h2 className="text-2xl font-semibold mb-4 text-foreground text-center">
                  Ready to Apply?
                </h2>
                <p className="text-center text-muted-foreground mb-6">
                  Our application form is currently being prepared. Check back soon or contact us for more information.
                </p>
                <div className="text-center">
                  <a 
                    href="mailto:apply@top10lists.us" 
                    className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Contact Us
                  </a>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ApplyListing;
