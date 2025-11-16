import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';

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
              <h1 className="text-4xl font-bold mb-4 text-foreground">
                Apply to be Listed
              </h1>
              {locationText && (
                <p className="text-xl text-muted-foreground mb-2">
                  Real Estate Agents in {locationText}
                </p>
              )}
              <p className="text-muted-foreground">
                Join our curated directory of premier real estate professionals
              </p>
            </div>

            {/* Application Information */}
            <div className="bg-card rounded-lg shadow-lg p-8 border border-border space-y-8">
              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">
                  About Top10Lists.us
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Top10Lists.us is a curated directory featuring the top real estate agents in communities across the United States. 
                  We help homebuyers and sellers find trusted, high-performing agents in their local markets.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4 text-foreground">
                  Who Should Apply?
                </h2>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Licensed real estate agents with an active license in good standing</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Professionals with a proven track record of successful transactions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Agents who prioritize client satisfaction and professional excellence</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Active members of their local real estate community</span>
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
                  Benefits of Being Listed
                </h2>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Enhanced online visibility to potential clients</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Professional profile showcasing your expertise</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Featured placement in your local market</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Direct client inquiries and lead generation</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">✓</span>
                    <span>Recognition as a top-performing agent</span>
                  </li>
                </ul>
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
