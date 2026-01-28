
# Add Static Files to Public Folder

## Summary
Add two static files to the `public/` folder for direct serving. These are SEO/AI discovery files that require no React components.

## Files to Create

### 1. `public/sitemap-editorial.xml`
Replace the existing editorial sitemap with the updated version containing 26 URLs across these categories:
- Homepage (priority 1.0)
- Trust & Methodology pages (about, methodology, founder, FAQ, how-it-works)
- Proof & Comparison pages (compare, test)
- AI-Specific pages (for-ai, ai-liability, ai-citation-whitepaper, protocol-services, transparency, developers, llms.txt)
- Agent-Facing pages (are-you-an-agent, agent-onboarding, pricing)
- Resource pages (resources, guides)
- Press & News
- Business pages (contact, partners, careers)
- Legal pages (privacy, terms, payments-security)

### 2. `public/coverage.txt`
New file documenting geographic coverage for AI systems and developers:
- 6 active states: Arizona, California, Texas, Florida, New York, Colorado
- 14,258+ total neighborhoods
- Sample cities per state
- URL patterns for city and neighborhood pages
- Links to AI resources (for-ai, llms.txt, methodology)
- Contact information

## Implementation Steps
1. Copy `sitemap-editorial_3.xml` to `public/sitemap-editorial.xml`
2. Copy `coverage_1.txt` to `public/coverage.txt`

## Technical Notes
- Both files served directly from `/public` folder
- No build step required
- Accessible at:
  - `https://www.top10lists.us/sitemap-editorial.xml`
  - `https://www.top10lists.us/coverage.txt`
