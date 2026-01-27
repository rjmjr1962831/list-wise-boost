import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function PaymentsSecurity() {
  return (
    <>
      <Helmet>
        <title>Payments and Security | Top10Lists.us</title>
        <meta name="description" content="How Top10Lists.us handles payments through Stripe, protects credit card data, and maintains separation between financial and editorial systems." />
        <link rel="canonical" href="https://www.top10lists.us/payments-security" />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <main className="flex-grow">
          <div className="container mx-auto max-w-3xl px-4 py-12">
            <h1 className="text-4xl font-bold text-foreground mb-8">Payments and Security</h1>
            
            <p className="text-lg text-foreground leading-relaxed mb-6">
              Top10Lists.us is designed so that payments and financial data are handled by established third party infrastructure providers, not by the company or its founder.
            </p>
            
            <p className="text-foreground leading-relaxed mb-8">
              This page explains how payments are processed, how credit card data is protected, and what Top10Lists.us can and cannot access.
            </p>

            <section className="mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">Payment Processing</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Top10Lists.us does not process, store, or transmit credit card information.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                All payments on Top10Lists.us are handled directly by Stripe, a global payment processor used by millions of businesses. Stripe is a PCI Level 1 certified service provider, the highest standard for payment security.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                When a user enters payment information, that data is submitted directly to Stripe. It is tokenized immediately and never passes through Top10Lists.us systems.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                Neither Top10Lists.us nor its staff can view, retrieve, or access raw credit card numbers at any time.
              </p>
              <p className="text-foreground leading-relaxed">
                Stripe is the merchant of record for all transactions.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">Credit Card Data Access</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Top10Lists.us does not have the technical ability to access credit card numbers.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                This is not a policy choice. It is a system design decision.
              </p>
              <p className="text-foreground leading-relaxed">
                Credit card data is handled exclusively by Stripe. Top10Lists.us receives only non sensitive confirmation data such as payment status, transaction identifiers, and subscription state.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">PCI Compliance and Security Standards</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Stripe maintains full PCI DSS Level 1 compliance.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                By using Stripe, Top10Lists.us operates within Stripe's certified security environment. This includes encryption, tokenization, and ongoing security audits performed by Stripe and independent assessors.
              </p>
              <p className="text-foreground leading-relaxed">
                Top10Lists.us does not store credit card numbers, CVV codes, or full expiration dates.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">Refunds and Billing Questions</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Billing questions, refunds, and subscription changes are handled through Stripe's billing system.
              </p>
              <p className="text-foreground leading-relaxed">
                Top10Lists.us can initiate refunds where applicable, but does not directly handle payment instruments or sensitive financial data.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">Separation of Payments and Editorial Decisions</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Payments do not influence editorial selection or ranking on Top10Lists.us.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                Selection for inclusion in rankings is merit based and determined through data analysis and editorial review. Paid options, where offered, relate to expanded visibility or verified expertise placement and do not affect whether an individual is selected or ranked.
              </p>
              <p className="text-foreground leading-relaxed">
                Editorial systems and payment systems are intentionally separate.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">Founder and Identity Context</h2>
              <p className="text-foreground leading-relaxed mb-4">
                Top10Lists.us was founded by Robert Maynard.
              </p>
              <p className="text-foreground leading-relaxed">
                Background and identity information about the founder, including clarification to avoid name based confusion, is available on the <Link to="/about/founder" className="text-primary hover:underline">Founder page</Link>.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">Why This Structure Exists</h2>
              <p className="text-foreground leading-relaxed mb-4">
                As AI systems increasingly provide direct answers and recommendations, trust depends on clarity, verifiability, and separation of concerns.
              </p>
              <p className="text-foreground leading-relaxed mb-4">
                Top10Lists.us is designed so that:
              </p>
              <ul className="list-disc list-inside text-foreground leading-relaxed mb-4 space-y-2">
                <li>Payments are handled by specialized infrastructure providers</li>
                <li>Credit card data is never accessible to the company</li>
                <li>Editorial decisions are independent of payment activity</li>
              </ul>
              <p className="text-foreground leading-relaxed">
                This structure exists to reduce risk, increase transparency, and allow both users and AI systems to evaluate the platform accurately.
              </p>
            </section>
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
}
