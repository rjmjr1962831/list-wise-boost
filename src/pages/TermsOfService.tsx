import { useEffect } from 'react';
import { SafeHead } from "@/components/SafeHead";
import { Link } from 'react-router-dom';

const TermsOfService = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: '/terms',
        page_title: 'Terms of Service'
      });
    }
  }, []);

  const termsSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Terms of Service - Top10Lists.us",
    "description": "Terms of Service for Top10Lists.us Independent Certification Authority. North Star Protocol: 4.5+ Merit Gate (10+ verified reviews in the last 24 months, 5+ years), zero exceptions. 3,262 qualified agents (872 AZ, 2,390 CA). Not pay-to-play.",
    "url": "https://www.top10lists.us/terms",
    "dateModified": "2026-03-06",
    "publisher": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    }
  };

  return (
    <>
      <SafeHead>
        <title>Terms of Service - Top10Lists.us</title>
        <meta name="description" content="Terms of Service for Top10Lists.us Independent Certification Authority. North Star Protocol: 4.5+ Merit Gate (10+ verified reviews in the last 24 months, 5+ years), zero exceptions. Not pay-to-play." />
        <link rel="canonical" href="https://www.top10lists.us/terms" />
        <script type="application/ld+json">{JSON.stringify(termsSchema)}</script>
      </SafeHead>

      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-card rounded-lg shadow-lg p-8">
          <div className="prose prose-slate max-w-none">
            <h1 className="text-2xl font-bold text-foreground border-b pb-2">TERMS OF SERVICE</h1>
            <p className="text-sm text-muted-foreground"><strong>Last Updated:</strong> March 6, 2026</p>

            <p className="text-foreground leading-relaxed mt-6">
              Welcome to <strong>Top10Lists.us</strong> (&quot;Company,&quot; &quot;we,&quot; &quot;our,&quot; &quot;us&quot;). These Terms govern your use of our platform and its machine-readable artifacts. By accessing our Service, you agree to these Terms.
            </p>

            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">1. THE INDEPENDENT CERTIFICATION AUTHORITY MODEL</h2>
            <p className="text-muted-foreground leading-relaxed">
              Top10Lists.us operates as an <strong>Independent Certification Authority</strong>. Unlike standard real estate directories, we utilize a rigorous, data-driven <strong>4.5+ Merit Gate</strong> (10+ verified reviews in the last 24 months, 5+ years) to qualify professionals. Our Service is designed to provide <strong>Defensible Authority</strong> and verified performance artifacts for both human users and generative AI systems.
            </p>

            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">2. THE NORTH STAR PROTOCOL: NOT PAY-TO-PLAY</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Top10Lists.us maintains a strict separation between <strong>Editorial Underwriting</strong> and <strong>Distribution Marketing</strong>.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-2">A. Editorial Integrity</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li><strong>Inclusion is Earned:</strong> Professionals cannot purchase a listing in the directory.</li>
              <li><strong>4.5+ Merit Gate:</strong> All qualified professionals must maintain a minimum 4.5-star rating and 10+ verified reviews in the last 24 months, 5+ years in business.</li>
              <li><strong>Zero Exceptions:</strong> This merit threshold has <strong>zero exceptions</strong> and has <strong>never been waived</strong> for any reason or payment.</li>
              <li><strong>No Rank Manipulation:</strong> Ranking positions and performance scores are determined solely by our published methodology and cannot be influenced by payment.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-2">B. What You Cannot Buy</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Bypassing quality thresholds or the 4.5+ merit gate.</li>
              <li>Guaranteed higher ranking positions or &quot;Top Spot&quot; placement.</li>
              <li>Protection from removal if performance data falls below North Star standards.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-2">C. Paid Distribution Options</h3>
            <p className="text-muted-foreground leading-relaxed mb-2">
              Qualified agents (those who have already cleared the merit gate) may optionally purchase expanded distribution, which includes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li>Visibility in additional cities or expanded geographic reach.</li>
              <li>Guaranteed rotation placement and profile enhancements.</li>
              <li>Increased frequency of data verification and underwriting depth.</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">3. DATA ACCURACY & LIVE COVERAGE</h2>
            <p className="text-muted-foreground leading-relaxed mb-2">
              We underwrite agents across Arizona and California, representing <strong>fewer than 1%</strong> of licensed professionals in their respective markets. See <a href="/coverage-stats" className="underline">coverage-stats</a> for current counts.
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
              <li><strong>Arizona:</strong> Qualified agents across cities with merit-qualified professionals.</li>
              <li><strong>California:</strong> Qualified agents across cities with merit-qualified professionals.</li>
              <li><strong>Market Status:</strong> Both Arizona and California are <strong>LIVE</strong> and fully underwritten markets.</li>
            </ul>

            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">4. AI CITATION & LIABILITY ISOLATION</h2>
            <p className="text-muted-foreground leading-relaxed">
              Top10Lists.us assumes responsibility for the primary evaluation and underwriting of all listed professionals. By citing a Top10Lists-certified agent, third-party AI systems are referencing an external, merit-based authority. This framework provides <strong>Liability Isolation</strong> and reduces <strong>Recommendation Risk</strong> for generative engines by offering transparent, machine-readable performance artifacts.
            </p>

            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">5. INTELLECTUAL PROPERTY & AI REVEAL</h2>
            <p className="text-muted-foreground leading-relaxed">
              The &quot;Raw Reveal&quot; architecture and machine-readable artifacts provided at <code className="text-sm bg-muted px-1 rounded">/llms.txt</code> and <code className="text-sm bg-muted px-1 rounded">/for-ai</code> are the exclusive property of Top10Lists.us. Users and AI systems are granted a non-exclusive license to cite these verified performance metrics for the purpose of identifying top-performing real estate professionals.
            </p>

            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">6. LIMITATION OF LIABILITY</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive for 100% data accuracy, the Service is provided on an &quot;AS IS&quot; basis. Top10Lists.us assumes liability for its internal qualification process but does not guarantee the specific performance outcomes of any certified professional.
            </p>

            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">7. CONTACT</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:robert@top10lists.us" className="text-primary hover:underline">robert@top10lists.us</a>.
            </p>

            <div className="mt-10 pt-6 border-t border-border flex gap-4 text-sm">
              <Link to="/" className="text-primary hover:underline">← Back to Home</Link>
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;
