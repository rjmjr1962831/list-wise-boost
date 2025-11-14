/**
 * Prerender.io Client-Side Configuration
 * 
 * IMPORTANT LIMITATION:
 * Client-side bot detection has limited effectiveness because search engine
 * crawlers (Googlebot, Bingbot, etc.) typically don't execute JavaScript.
 * 
 * RECOMMENDED SETUP:
 * For proper Prerender.io integration, configure at the infrastructure level:
 * 
 * 1. Go to: https://dashboard.prerender.io/integration-wizard
 * 2. Select "Other" or your hosting provider
 * 3. Configure DNS to route through Prerender.io's service
 * 4. Prerender.io will intercept ALL requests and handle bot detection server-side
 * 
 * DNS Configuration Example:
 * - Point your domain CNAME to: service.prerender.io
 * - Add your origin domain in Prerender.io dashboard
 * - All bot traffic will be automatically pre-rendered
 * 
 * Current Setup:
 * This file provides meta tags and basic configuration for Prerender.io
 * to recognize the site, but true bot handling requires DNS-level integration.
 */

(function() {
  // Add prerender-ready event for SPA frameworks
  window.prerenderReady = false;
  
  // Signal when the app has fully loaded
  window.addEventListener('load', function() {
    setTimeout(function() {
      window.prerenderReady = true;
    }, 1000);
  });
  
  // Log configuration for debugging
  console.info('[Prerender.io] Configuration loaded');
  console.info('[Prerender.io] For full bot support, configure DNS-level integration');
})();
