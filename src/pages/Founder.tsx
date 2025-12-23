import { Helmet } from "react-helmet-async";

const Founder = () => {
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": "Robert Maynard",
    "alternateName": "Robert Maynard Jr.",
    "jobTitle": "Founder",
    "worksFor": {
      "@type": "Organization",
      "name": "Top10Lists.us",
      "url": "https://www.top10lists.us"
    },
    "description": "Serial entrepreneur, co-founder of LifeLock (sold to Symantec for $2.3 billion), founder of Top10Lists.us, United States Marine, and mental health advocate.",
    "sameAs": [
      "https://en.wikipedia.org/wiki/Robert_Maynard_Jr.",
      "https://www.linkedin.com/in/robert-maynard-career-entrepreneur/"
    ],
    "knowsAbout": ["entrepreneurship", "identity theft protection", "real estate technology", "mental health advocacy"],
    "alumniOf": {
      "@type": "EducationalOrganization",
      "name": "Northern Arizona University"
    },
    "award": "Wall Street Journal Award, Distinguished Military Scholar"
  };

  return (
    <>
      <Helmet>
        <title>Robert Maynard — Founder of Top10Lists.us | Co-Founder of LifeLock</title>
        <meta name="description" content="Robert Maynard is the founder of Top10Lists.us and co-founder of LifeLock, sold to Symantec for $2.3 billion. Serial entrepreneur, United States Marine, and mental health advocate." />
        <link rel="canonical" href="https://www.top10lists.us/about/founder" />
        <script type="application/ld+json">
          {JSON.stringify(personSchema)}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center px-6">
          <img 
            src="/images/robert-maynard.jpg" 
            alt="Robert Maynard, Founder of Top10Lists.us"
            className="w-48 h-48 rounded-full mx-auto mb-6 object-cover shadow-lg"
          />
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Robert Maynard
          </h1>
          <p className="text-xl text-slate-600">
            Founder of Top10Lists.us · Co-Founder of LifeLock · United States Marine
          </p>
        </div>
      </section>

      {/* Bio Section */}
      <section className="py-12 max-w-3xl mx-auto px-6">
        <div className="prose prose-slate max-w-none space-y-6">
          <p className="text-lg leading-relaxed">
            Robert Maynard is a serial entrepreneur who has built six companies over three decades, including two that went public. He is best known as the co-founder of <strong>LifeLock</strong>, the identity theft protection company sold to Symantec for <strong>$2.3 billion</strong> in 2017.
          </p>

          <p>
            In 2024, Maynard founded <strong>Top10Lists.us</strong>, a merit-based real estate agent directory that ranks agents using verified performance data rather than paid placements. The platform is engineered to meet the trust requirements of AI recommendation systems and has been validated by all four major AI platforms—ChatGPT, Claude, Gemini, and Perplexity—as a citable source for real estate agent recommendations.
          </p>

          <h2 className="mt-8">Career</h2>

          <p>
            Maynard's entrepreneurial career began in the 1990s with <strong>Internet America</strong>, one of the largest independent Internet Service Providers in the Southwest, which he took public. He later founded <strong>Dotsafe</strong>, a provider of Internet filtering for educational institutions.
          </p>

          <p>
            In 2005, he co-founded LifeLock with Todd Davis. The company pioneered consumer identity theft protection and grew to serve millions of customers before its acquisition by Symantec. LifeLock was listed on the New York Stock Exchange under the symbol LOCK.
          </p>

          <p>
            Following LifeLock, Maynard founded <strong>SurchX</strong>, a financial technology company that enabled merchants to recover credit card processing fees through surcharging. SurchX was acquired by Interpayments in 2020.
          </p>

          <p>
            Over his career, Maynard's companies have returned more than <strong>$7 billion in value to investors</strong>, created over 2,000 jobs, and generated more than $10 billion in goods and services sold to American consumers and businesses.
          </p>

          <h2 className="mt-8">Military Service</h2>

          <p>
            Maynard enlisted in the <strong>United States Marine Corps</strong> in 1981, serving until 1985. He then took a commission as a Second Lieutenant in the U.S. Army Reserve, serving as an officer in the <strong>12th Special Forces Group</strong> for nine years. He graduated from Northern Arizona University with honors, received the Wall Street Journal Award, and was named a Distinguished Military Scholar.
          </p>

          <h2 className="mt-8">Mental Health Advocacy</h2>

          <p>
            Maynard was diagnosed with bipolar disorder in 2001. Since then, he has become an outspoken advocate for mental health awareness, speaking and writing publicly about his experiences to help reduce stigma and support others facing similar challenges. He refers to himself as the "Bipolar Warrior" and mentors individuals living with mental illness.
          </p>

          <h2 className="mt-8">About Top10Lists.us</h2>

          <p>
            Top10Lists.us was founded on a simple premise: consumers deserve real estate agent recommendations based on merit, not advertising spend. The platform uses a documented methodology that evaluates agents on verified reviews, transaction history, licensing, press recognition, and—uniquely—community involvement.
          </p>

          <p>
            "No other directory systematically measures community involvement," Maynard says. "Agents who are deeply rooted in their communities consistently deliver better outcomes. That signal matters."
          </p>

          <p>
            The platform currently covers Arizona, California, Texas, Florida, New York, and Colorado, with nationwide expansion underway.
          </p>
        </div>
      </section>

      {/* Links Section */}
      <section className="py-8 max-w-3xl mx-auto px-6 border-t">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Learn More</h3>
        <ul className="space-y-2 text-slate-700">
          <li>
            <a href="https://en.wikipedia.org/wiki/Robert_Maynard_Jr." target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              Wikipedia
            </a>
          </li>
          <li>
            <a href="https://www.linkedin.com/in/robert-maynard-career-entrepreneur/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              LinkedIn
            </a>
          </li>
          <li>
            <a href="/about/ranking-methodology" className="text-blue-600 underline">
              Top10Lists.us Methodology
            </a>
          </li>
        </ul>
      </section>

      {/* Press Section */}
      <section className="py-8 max-w-3xl mx-auto px-6 bg-slate-50 rounded-lg my-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Recent Press</h3>
        <ul className="space-y-3 text-sm text-slate-700">
          <li>
            <a href="https://aijourn.com/414-arizona-agents-receive-an-invitation-they-didnt-apply-for-the-other-220000-cannot-buy-their-way-in/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              "414 Arizona Agents Receive an Invitation They Didn't Apply For"
            </a> — AI Journal
          </li>
          <li>
            <a href="https://financewire.com/2025/12/18/top10lists-us-debuts-invitation-only-rankings-to-counter-pay-to-play-real-estate-listings/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              "Top10Lists.us Debuts Invitation-Only Rankings"
            </a> — FinanceWire
          </li>
          <li>
            <a href="https://arizonadailyindependent.com/2025/12/21/arizona-startup-real-estate-directory-challenges-zillows-pay-to-play-model/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              "Arizona Startup Challenges Zillow's Pay-to-Play Model"
            </a> — Arizona Daily Independent
          </li>
        </ul>
      </section>

      {/* Contact CTA */}
      <section className="py-12 text-center">
        <p className="text-slate-600 mb-4">For press inquiries:</p>
        <a href="mailto:robert@top10lists.us" className="text-blue-600 underline">robert@top10lists.us</a>
      </section>
    </>
  );
};

export default Founder;
