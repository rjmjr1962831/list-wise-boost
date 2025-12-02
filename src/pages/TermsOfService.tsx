import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
  useEffect(() => {
    // Track page view
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: '/terms',
        page_title: 'Terms of Service'
      });
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>Terms of Service - Top10Lists.us</title>
        <meta name="description" content="Terms of Service for Top10Lists.us - Professional directory and listing service" />
        <link rel="canonical" href="https://top10lists.us/terms" />
      </Helmet>

      <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto bg-card rounded-lg shadow-lg p-8">
          <style>{`
            [data-custom-class='body'], [data-custom-class='body'] * {
              background: transparent !important;
            }
            [data-custom-class='title'], [data-custom-class='title'] * {
              font-family: Arial !important;
              font-size: 26px !important;
              color: #000000 !important;
            }
            [data-custom-class='subtitle'], [data-custom-class='subtitle'] * {
              font-family: Arial !important;
              color: #595959 !important;
              font-size: 14px !important;
            }
            [data-custom-class='heading_1'], [data-custom-class='heading_1'] * {
              font-family: Arial !important;
              font-size: 19px !important;
              color: #000000 !important;
            }
            [data-custom-class='heading_2'], [data-custom-class='heading_2'] * {
              font-family: Arial !important;
              font-size: 17px !important;
              color: #000000 !important;
            }
            [data-custom-class='body_text'], [data-custom-class='body_text'] * {
              color: #595959 !important;
              font-size: 14px !important;
              font-family: Arial !important;
            }
            [data-custom-class='link'], [data-custom-class='link'] * {
              color: #3030F1 !important;
              font-size: 14px !important;
              font-family: Arial !important;
              word-break: break-word !important;
            }
          `}</style>

          <div data-custom-class="body">
            <div>
              <strong>
                <span style={{ fontSize: '26px' }}>
                  <span data-custom-class="title">TERMS OF SERVICE</span>
                </span>
              </strong>
            </div>
            
            <div>
              <span style={{ color: 'rgb(127, 127, 127)' }}>
                <strong>
                  <span style={{ fontSize: '15px' }}>
                    <span data-custom-class="subtitle">Last updated November 09, 2025</span>
                  </span>
                </strong>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '20px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Welcome to Top10Lists.us ("Company," "we," "our," "us"). These Terms of Service ("Terms") govern your use of our website located at <Link to="/" data-custom-class="link">https://top10lists.us</Link> and any related services provided by Top10Lists.us.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">1. USE OF SERVICE</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Top10Lists.us provides an AI and human curated directory of the top real estate agents in every major U.S. city. Our Service allows users to search, view, and contact real estate agents listed on our platform.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to use the Service:
                </span>
              </span>
            </div>

            <ul style={{ marginTop: '10px' }}>
              <li data-custom-class="body_text" style={{ lineHeight: '1.5' }}>
                <span style={{ fontSize: '15px' }}>
                  In any way that violates any applicable federal, state, local, or international law or regulation
                </span>
              </li>
              <li data-custom-class="body_text" style={{ lineHeight: '1.5' }}>
                <span style={{ fontSize: '15px' }}>
                  To transmit, or procure the sending of, any advertising or promotional material without our prior written consent
                </span>
              </li>
              <li data-custom-class="body_text" style={{ lineHeight: '1.5' }}>
                <span style={{ fontSize: '15px' }}>
                  To impersonate or attempt to impersonate the Company, a Company employee, another user, or any other person or entity
                </span>
              </li>
              <li data-custom-class="body_text" style={{ lineHeight: '1.5' }}>
                <span style={{ fontSize: '15px' }}>
                  To engage in any other conduct that restricts or inhibits anyone's use or enjoyment of the Service
                </span>
              </li>
            </ul>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">2. ACCOUNTS</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password. You agree not to disclose your password to any third party.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">3. INTELLECTUAL PROPERTY</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  The Service and its original content, features, and functionality are and will remain the exclusive property of Top10Lists.us and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">4. LISTINGS AND CONTENT</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Top10Lists.us provides listings and information about professionals as a service. While we strive to provide accurate and up-to-date information, we make no representations or warranties about the accuracy, reliability, or completeness of any information provided on the Service.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  The inclusion of any professional in our listings does not constitute an endorsement or recommendation by Top10Lists.us. Users are encouraged to conduct their own due diligence before engaging with any professional listed on our platform.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">5. USER SUBMISSIONS</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  If you submit content, reviews, or other materials to the Service, you grant Top10Lists.us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and display such content in connection with the Service.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">6. LIMITATION OF LIABILITY</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  In no event shall Top10Lists.us, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">7. DISCLAIMER</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">8. TERMINATION</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">9. GOVERNING LAW</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  These Terms shall be governed and construed in accordance with the laws of the United States and the State of Arizona, without regard to its conflict of law provisions.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">10. CHANGES TO TERMS</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px' }}>
              <strong>
                <span style={{ fontSize: '19px' }}>
                  <span data-custom-class="heading_1">11. CONTACT US</span>
                </span>
              </strong>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '15px' }}>
              <span style={{ fontSize: '15px' }}>
                <span data-custom-class="body_text">
                  If you have any questions about these Terms, please contact us at{' '}
                  <a href="mailto:robert@top10lists.us" data-custom-class="link">
                    robert@top10lists.us
                  </a>
                </span>
              </span>
            </div>

            <div style={{ lineHeight: '1.5', marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
              <span style={{ fontSize: '14px', color: '#595959' }}>
                <Link to="/" style={{ color: '#3030F1', textDecoration: 'none' }}>
                  ← Back to Home
                </Link>
                {' | '}
                <Link to="/privacy" style={{ color: '#3030F1', textDecoration: 'none' }}>
                  Privacy Policy
                </Link>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TermsOfService;
