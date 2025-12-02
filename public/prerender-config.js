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
  // This will be set to true by React components after meta tags are injected
  window.prerenderReady = false;
  
  // Fallback: if React doesn't signal within 5 seconds, assume ready
  // This handles edge cases where the React app might fail to load
  window.addEventListener('load', function() {
    setTimeout(function() {
      if (!window.prerenderReady) {
        console.info('[Prerender.io] Fallback: signaling ready after timeout');
        window.prerenderReady = true;
      }
    }, 5000);
  });
  
  // Log configuration for debugging
  console.info('[Prerender.io] Configuration loaded - waiting for React to signal ready');
})();
