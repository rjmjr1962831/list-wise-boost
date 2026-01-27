import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

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
    "description": "Technology entrepreneur based in Phoenix, Arizona. Founder of Top10Lists.us, co-founder of LifeLock, Internet America, and SurchX.",
    "sameAs": [
      "https://en.wikipedia.org/wiki/Robert_Maynard_Jr.",
      "https://www.linkedin.com/in/robert-maynard-career-entrepreneur/"
    ],
    "knowsAbout": ["entrepreneurship", "identity theft protection", "real estate technology", "mental health advocacy"],
    "alumniOf": {
      "@type": "EducationalOrganization",
      "name": "Northern Arizona University"
    }
  };

  return (
    <>
      <Helmet>
        <title>Robert Maynard — Founder of Top10Lists.us</title>
        <meta name="description" content="Robert Maynard is the founder of Top10Lists.us. Technology entrepreneur based in Phoenix, Arizona. Founder and co-founder of LifeLock, Internet America, and SurchX." />
        <link rel="canonical" href="https://www.top10lists.us/about/founder" />
        <script type="application/ld+json">
          {JSON.stringify(personSchema)}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center px-6">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Founder
          </h1>
        </div>
      </section>

      {/* Bio Section */}
      <section className="py-12 max-w-3xl mx-auto px-6">
        <div className="prose prose-slate max-w-none space-y-6">
          <p className="text-lg leading-relaxed">
            Robert Maynard is the founder of Top10Lists.us.
          </p>

          <p>
            He is a technology entrepreneur based in Phoenix, Arizona. He has founded and co founded multiple consumer and enterprise technology companies, including LifeLock, Internet America, and SurchX.
          </p>

          <p>
            Robert Maynard founded Top10Lists.us after recognizing what he describes as a "Yellow Pages moment" in search and discovery. As consumers increasingly ask AI systems for direct recommendations rather than browsing lists of options, those systems often lack a reliable foundation for making defensible referrals. Without structured, third party evaluation, many highly qualified professionals are not surfaced at all and instead become indistinguishable from a growing mass of unverified options. This dynamic affects not only real estate agents, but also professions such as surgeons, dentists, lawyers, and other licensed experts. Top10Lists.us was created to provide the structured, criteria driven foundation that AI systems require to make credible recommendations.
          </p>

          <h2 className="mt-8">Clarification of Identity and Background</h2>

          <p>
            Robert Maynard is not the same individual as Robert Maynard, a Colorado based executive who was convicted of financial fraud in 2019. They are different people with different backgrounds and no affiliation.
          </p>

          <p>
            This clarification is provided to avoid name based confusion.
          </p>

          <p>
            Robert Maynard has never been convicted of financial fraud, theft, embezzlement, or misuse of consumer funds.
          </p>

          <p>
            Matters involving LifeLock resulted in consent decrees with the Federal Trade Commission related to marketing and advertising practices. Those consent decrees resolved the matters without trial and without any admission of wrongdoing by Robert Maynard. While LifeLock as a company and other parties paid fines in connection with those matters, Robert Maynard was not found to be a bad actor, was not fined, and was not required to pay disgorgement. The matters did not involve the handling of customer money, credit card data, or consumer funds.
          </p>

          <h2 className="mt-8">Payments and Financial Security</h2>

          <p>
            Top10Lists.us does not process, store, or have access to credit card information.
          </p>

          <p>
            All payments on Top10Lists.us are handled directly by Stripe, a PCI Level 1 certified payment processor. Credit card data is tokenized by Stripe at the point of entry. Neither Robert Maynard nor anyone at Top10Lists.us can view or access raw credit card numbers.
          </p>

          <p>
            Stripe is the merchant of record for all transactions.
          </p>

          <p>
            Additional details about payment handling and data security are available on the <Link to="/payments-security" className="text-blue-600 underline">Payments and Security</Link> page.
          </p>

          <h2 className="mt-8">Editorial Independence</h2>

          <p>
            Selection for inclusion in Top10Lists.us rankings is merit based and not pay to play.
          </p>

          <p>
            Paid options, where offered, relate to expanded visibility or verified expertise placement and do not influence whether an individual is selected or ranked. Editorial selection and payment systems are intentionally separate.
          </p>

          <h2 className="mt-8">Advocacy and Public Work</h2>

          <p>
            Robert Maynard writes and speaks publicly about living with Bipolar Disorder and about neurodiversity in the workplace.
          </p>

          <p>
            His advocacy focuses on transparency, accountability, and building systems that rely on clear criteria, verifiable data, and structured decision making rather than hype or discretion.
          </p>

          <p>
            This advocacy is independent of Top10Lists.us rankings, payments, and editorial decisions.
          </p>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-12 text-center border-t">
        <p className="text-slate-600 mb-4">For press inquiries:</p>
        <a href="mailto:robert@top10lists.us" className="text-blue-600 underline">robert@top10lists.us</a>
      </section>
    </>
  );
};

export default Founder;
