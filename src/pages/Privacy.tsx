import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

const Privacy = () => {
  useEffect(() => {
    // Track page view
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', {
        page_title: 'Privacy Policy',
        page_path: '/privacy'
      });
    }
  }, []);

  return (
    <>
      <Helmet>
        <title>Privacy Policy - Top10Lists.us</title>
        <meta name="description" content="Privacy policy for Top10Lists.us. Learn how we collect, use, and protect your personal information." />
        <link rel="canonical" href="https://top10lists.us/privacy" />
        <meta property="og:title" content="Privacy Policy - Top10Lists.us" />
        <meta property="og:description" content="Privacy policy for Top10Lists.us. Learn how we collect, use, and protect your personal information." />
        <meta property="og:url" content="https://top10lists.us/privacy" />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="mb-6">
            <Link to="/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">← Back to Home</Link>
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            [data-custom-class='body'], [data-custom-class='body'] * {
              background: transparent !important;
            }
            [data-custom-class='title'], [data-custom-class='title'] * {
              font-family: Arial !important;
              font-size: 26px !important;
              color: hsl(var(--foreground)) !important;
            }
            [data-custom-class='subtitle'], [data-custom-class='subtitle'] * {
              font-family: Arial !important;
              color: hsl(var(--muted-foreground)) !important;
              font-size: 14px !important;
            }
            [data-custom-class='heading_1'], [data-custom-class='heading_1'] * {
              font-family: Arial !important;
              font-size: 19px !important;
              color: hsl(var(--foreground)) !important;
            }
            [data-custom-class='heading_2'], [data-custom-class='heading_2'] * {
              font-family: Arial !important;
              font-size: 17px !important;
              color: hsl(var(--foreground)) !important;
            }
            [data-custom-class='body_text'], [data-custom-class='body_text'] * {
              color: hsl(var(--muted-foreground)) !important;
              font-size: 14px !important;
              font-family: Arial !important;
            }
            [data-custom-class='link'], [data-custom-class='link'] * {
              color: hsl(var(--primary)) !important;
              font-size: 14px !important;
              font-family: Arial !important;
              word-break: break-word !important;
            }
          `}} />

          <div data-custom-class="body">
            <div><strong><span style={{fontSize: '26px'}}><span data-custom-class="title"><h1>PRIVACY POLICY</h1></span></span></strong></div>
            <div><span style={{color: 'rgb(127, 127, 127)'}}><strong><span style={{fontSize: '15px'}}><span data-custom-class="subtitle">Last updated November 09, 2025</span></span></strong></span></div>
            <div><br/></div>
            <div><br/></div>
            <div style={{lineHeight: 1.5}}><span style={{color: 'rgb(127, 127, 127)'}}><span style={{color: 'rgb(89, 89, 89)', fontSize: '15px'}}><span data-custom-class="body_text">This Privacy Notice for Aryah, Inc (doing business as top10lists.us) ("<strong>we</strong>," "<strong>us</strong>," or "<strong>our</strong>"), describes how and why we might access, collect, store, use, and/or share ("<strong>process</strong>") your personal information when you use our services ("<strong>Services</strong>"), including when you:</span></span></span></div>
            <ul>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">Visit our website at <span style={{color: 'rgb(0, 58, 250)'}}><a target="_blank" data-custom-class="link" href="https://top10lists.us">https://top10lists.us</a></span> or any website of ours that links to this Privacy Notice</span></span></li>
            </ul>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><span style={{color: 'rgb(127, 127, 127)'}}><span data-custom-class="body_text"><strong>Questions or concerns? </strong>Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a target="_blank" data-custom-class="link" href="mailto:robert@top10lists.us">robert@top10lists.us</a>.</span></span></span></div>
            <div style={{lineHeight: 1.5}}><br/></div>
            
            <div style={{lineHeight: 1.5}}><strong><span style={{fontSize: '15px'}}><span data-custom-class="heading_1"><h2>SUMMARY OF KEY POINTS</h2></span></span></strong></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><span data-custom-class="body_text"><strong><em>This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our </em></strong></span></span><a data-custom-class="link" href="#toc"><span style={{color: 'rgb(0, 58, 250)', fontSize: '15px'}}><span data-custom-class="body_text"><strong><em>table of contents</em></strong></span></span></a><span style={{fontSize: '15px'}}><span data-custom-class="body_text"><strong><em> below to find the section you are looking for.</em></strong></span></span></div>
            <div style={{lineHeight: 1.5}}><br/></div>
            
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><span data-custom-class="body_text"><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about </span></span><a data-custom-class="link" href="#personalinfo"><span style={{color: 'rgb(0, 58, 250)', fontSize: '15px'}}><span data-custom-class="body_text">personal information you disclose to us</span></span></a><span data-custom-class="body_text">.</span></div>
            <div style={{lineHeight: 1.5}}><br/></div>
            
            <div id="toc" style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><span style={{color: 'rgb(0, 0, 0)'}}><strong><span data-custom-class="heading_1"><h2>TABLE OF CONTENTS</h2></span></strong></span></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#infocollect"><span style={{color: 'rgb(0, 58, 250)'}}>1. WHAT INFORMATION DO WE COLLECT?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#infouse"><span style={{color: 'rgb(0, 58, 250)'}}>2. HOW DO WE PROCESS YOUR INFORMATION?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><span style={{color: 'rgb(0, 58, 250)'}}><a data-custom-class="link" href="#whoshare">3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</a></span></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#cookies"><span style={{color: 'rgb(0, 58, 250)'}}>4. DO WE USE COOKIES AND OTHER TRACKING TECHNOLOGIES?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#sociallogins"><span style={{color: 'rgb(0, 58, 250)'}}>5. HOW DO WE HANDLE YOUR SOCIAL LOGINS?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#inforetain"><span style={{color: 'rgb(0, 58, 250)'}}>6. HOW LONG DO WE KEEP YOUR INFORMATION?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#infosafe"><span style={{color: 'rgb(0, 58, 250)'}}>7. HOW DO WE KEEP YOUR INFORMATION SAFE?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#infominors"><span style={{color: 'rgb(0, 58, 250)'}}>8. DO WE COLLECT INFORMATION FROM MINORS?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><span style={{color: 'rgb(0, 58, 250)'}}><a data-custom-class="link" href="#privacyrights">9. WHAT ARE YOUR PRIVACY RIGHTS?</a></span></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#DNT"><span style={{color: 'rgb(0, 58, 250)'}}>10. CONTROLS FOR DO-NOT-TRACK FEATURES</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#uslaws"><span style={{color: 'rgb(0, 58, 250)'}}>11. DO UNITED STATES RESIDENTS HAVE SPECIFIC PRIVACY RIGHTS?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px'}}><a data-custom-class="link" href="#policyupdates"><span style={{color: 'rgb(0, 58, 250)'}}>12. DO WE MAKE UPDATES TO THIS NOTICE?</span></a></span></div>
            <div style={{lineHeight: 1.5}}><a data-custom-class="link" href="#contact"><span style={{color: 'rgb(0, 58, 250)', fontSize: '15px'}}>13. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</span></a></div>
            <div style={{lineHeight: 1.5}}><a data-custom-class="link" href="#request"><span style={{color: 'rgb(0, 58, 250)'}}>14. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</span></a></div>
            
            <div style={{lineHeight: 1.5}}><br/></div>
            <div id="infocollect" style={{lineHeight: 1.5}}><span style={{color: 'rgb(0, 0, 0)', fontSize: '15px'}}><span id="control" style={{color: 'rgb(0, 0, 0)'}}><strong><span data-custom-class="heading_1"><h2>1. WHAT INFORMATION DO WE COLLECT?</h2></span></strong></span></span></div>
            
            <div id="personalinfo" style={{lineHeight: 1.5}}><span data-custom-class="heading_2" style={{color: 'rgb(0, 0, 0)'}}><span style={{fontSize: '15px'}}><strong><h3>Personal information you disclose to us</h3></strong></span></span></div>
            <div style={{lineHeight: 1.5}}><br/></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text"><strong><em>In Short:</em></strong><em> We collect personal information that you provide to us.</em></span></span></div>
            <div style={{lineHeight: 1.5}}><br/></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.</span></span></div>
            
            <div style={{lineHeight: 1.5}}><br/></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text"><strong>Personal Information Provided by You.</strong> The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:</span></span></div>
            
            <ul>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">names</span></span></li>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">phone numbers</span></span></li>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">email addresses</span></span></li>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">job titles</span></span></li>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">usernames</span></span></li>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">passwords</span></span></li>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">billing addresses</span></span></li>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">debit/credit card numbers</span></span></li>
              <li data-custom-class="body_text" style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">contact or authentication data</span></span></li>
            </ul>
            
            <div style={{lineHeight: 1.5}}><br/></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.</span></span></div>
            
            <div style={{lineHeight: 1.5}}><br/></div>
            <div id="contact" style={{lineHeight: 1.5}}><span style={{color: 'rgb(0, 0, 0)', fontSize: '15px'}}><strong><span data-custom-class="heading_1"><h2>13. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</h2></span></strong></span></div>
            <div style={{lineHeight: 1.5}}><br/></div>
            <div style={{lineHeight: 1.5}}><span style={{fontSize: '15px', color: 'rgb(89, 89, 89)'}}><span data-custom-class="body_text">If you have questions or comments about this notice, you may email us at <a target="_blank" data-custom-class="link" href="mailto:robert@top10lists.us">robert@top10lists.us</a>.</span></span></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Privacy;
