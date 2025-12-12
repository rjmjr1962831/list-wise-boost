import React from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const SMSTerms = () => {
  return (
    <>
      <Helmet>
        <title>SMS Terms & Conditions | Top10Lists.us</title>
        <meta name="description" content="SMS messaging terms and conditions for Top10Lists.us notifications about account, billing, and listing status." />
        <link rel="canonical" href="https://www.top10lists.us/sms-terms" />
      </Helmet>
      
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">SMS Terms & Conditions</h1>
        
        <div className="prose prose-slate max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">What Messages We Send</h2>
            <p className="text-muted-foreground">
              By opting in to receive SMS notifications from Top10Lists.us, you agree to receive text messages related to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Account verification and security alerts</li>
              <li>Billing notifications and payment reminders</li>
              <li>Listing status updates (approval, changes, expiration)</li>
              <li>Important service announcements</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Message Frequency</h2>
            <p className="text-muted-foreground">
              Message frequency varies based on your account activity. You may receive messages when there are updates to your listing, billing events, or important account notifications. We do not send marketing or promotional messages via SMS.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">How to Opt Out</h2>
            <p className="text-muted-foreground">
              You can opt out of receiving SMS notifications at any time by replying <strong>STOP</strong> to any message you receive from us. You will receive a confirmation message and will no longer receive SMS notifications from Top10Lists.us.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Message & Data Rates</h2>
            <p className="text-muted-foreground">
              Standard message and data rates may apply depending on your mobile carrier and plan. Top10Lists.us does not charge for SMS messages, but your carrier may charge you for receiving text messages.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Help</h2>
            <p className="text-muted-foreground">
              For help or questions about our SMS notifications, reply <strong>HELP</strong> to any message or contact us at{" "}
              <a href="mailto:support@top10lists.us" className="text-primary hover:underline">
                support@top10lists.us
              </a>
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Privacy</h2>
            <p className="text-muted-foreground">
              Your phone number and SMS preferences are protected under our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              . We do not sell or share your phone number with third parties for marketing purposes.
            </p>
          </section>
          
          <section className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Last updated: December 2025
            </p>
          </section>
        </div>
      </div>
    </>
  );
};

export default SMSTerms;