# Competitor GEO Snapshot: Food Recall Management

**Date:** March 2025  
**Scope:** Generative Engine Optimization (GEO) scores for Instant Recall and top competitors. Scores reflect how well each site is positioned to be cited by AI systems (e.g., ChatGPT, Perplexity, Claude).

---

## GEO Score Summary

| Company | Site | GEO Score | Crawlability | Structured Data | AI Entry | Content | Entity / Authority | Technical |
|--------|------|-----------|--------------|-----------------|----------|---------|---------------------|-----------|
| **Instant Recall** | instantrecall.com | **28** | 5 | 25 | 0 | 55 | 50 | 60 |
| **FoodReady** | foodready.ai | **62** | 100 | 45 | 0 | 70 | 60 | 65 |
| **Trustwell (FoodLogiQ Recall)** | trustwell.com | **52** | 100 | 35 | 0 | 45 | 50 | 60 |
| **ReposiTrak** | repositrak.com | **58** | 100 | 40 | 50 | 50 | 50 | 60 |
| **ECCnet Recall (GS1 Canada)** | gs1ca.org/recall | **58** | 100 | 35 | 0 | 65 | 65 | 65 |

**Weights:** Crawlability 25% · Structured data 20% · AI entry 15% · Content 20% · Entity 15% · Technical 5%

**Score bands:** 80–100 Strong · 60–79 Good · 40–59 Fair · 20–39 Weak · 0–19 Poor

---

## Takeaways by Brand

### Instant Recall — 28 (Weak)
- **Critical:** AI crawlers (GPTBot, ClaudeBot, CCBot, etc.) are blocked by Squarespace’s default robots.txt, so the site is largely excluded from AI training and citation.
- Strong content and authority (named testimonials, stats, 20+ years) are underused because crawlers are blocked.
- **Quick win:** In Squarespace: Settings → Website → Crawlers → turn **AI crawlers** on. Add Organization + Service schema and llms.txt to push score into the 50–70 range.

### FoodReady — 62 (Good)
- No AI crawler blocks; rich homepage with testimonials (names, roles, companies), stats (70% time saved, 1000+ users), and clear product/service copy.
- Best content citability of the set; WordPress/Yoast likely provides some base schema.
- Adding llms.txt and richer Organization/Service/FAQ schema would strengthen GEO further.

### Trustwell (FoodLogiQ Recall) — 52 (Fair)
- Crawlers allowed; no AI-specific blocks. No llms.txt; FoodLogiQ Recall product page had minimal content in the scan.
- Score is conservative; deeper site structure and recall-specific schema could lift it.
- Opportunity to add recall-focused FAQ and Service schema and an AI entry point.

### ReposiTrak — 58 (Fair)
- Only competitor in the set with an **llms.txt** file, but it’s built for “Park City Group” and points to parkcitygroup.com, so value for ReposiTrak branding is limited.
- No AI crawler blocks; otherwise moderate schema and content.
- Aligning llms.txt with ReposiTrak and adding Organization/Service markup would improve citability.

### ECCnet Recall (GS1 Canada) — 58 (Fair)
- Clear recall product positioning, strong stats (1,942 recalls, 1,400+ brand owners), and regulatory/CFIA framing.
- GS1 Canada brand adds entity authority; robots allow crawling with targeted disallows.
- No llms.txt; adding one plus Organization/Service/FAQPage schema would make the site easier for AI to cite.

---

## Recommendation (Instant Recall)

1. **Allow AI crawlers** in Squarespace (Settings → Website → Crawlers).
2. Add **Organization** and **Service** JSON-LD on key pages.
3. Publish **llms.txt** with a short site/product description and key URLs.
4. Add a small **FAQ** section with **FAQPage** schema for quotable Q&A.

These steps can move Instant Recall from **28** into the **50–70** band and close the gap with competitors.
