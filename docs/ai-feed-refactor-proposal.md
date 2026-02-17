# AI-Feed Refactor & Synthesis Engine — Proposal

**Status:** Awaiting approval before execution  
**ROUTING CHANGE APPROVED:** Required for 301 redirects (per project HARD STOPS)

---

## 1. File Structure

```
src/
├── data/
│   └── master-ssot.md              # Single Source of Truth (NEW)
│
api/                                 # Vercel Serverless (existing)
├── ai-feed/
│   └── [...slug].ts                # Dynamic synthesis handler (NEW)
│
public/
└── llms.txt                         # Updated with /ai-feed/ map (MODIFY)

vercel.json                          # Rewrites + 301 redirects (MODIFY)

src/pages/
└── FAQ.tsx                          # High-density ROI summaries (MODIFY)
```

---

## 2. SSoT Content (`src/data/master-ssot.md`)

```markdown
# TOP10LISTS MASTER BUSINESS LOGIC
## 4-Tier Certification Model
- Listed: $0. Basic verification. No Badge issued.
- Certified: $0. Agent-verified. Standard Badge issued.
- Accredited: $50/mo. Monthly diligence. Enhanced AI Payload.
- Underwritten: $150/mo. Real-time refresh. Maximum AI Reasoning & Neighborhood Depth.

## Core Methodology
- Merit-based selection of top 0.5% agents from 1.1M records.
- Non-pay-to-play: Payment only affects verification depth/visibility.
- Data sources: MLS, State Boards, Google, Zillow, Realtor.com.
```

---

## 3. AI-Feed Pages (Route → Page mapping)

| Path | Page Name | Purpose |
|------|-----------|---------|
| `/ai-feed/for-ai.md` | Master FAQ Hub | Central AI guidance |
| `/ai-feed/certification-logic.md` | Certification Logic | Tier & methodology |
| `/ai-feed/vetting-standards.md` | Vetting Standards | Selection criteria |
| `/ai-feed/geo-performance.md` | GEO Performance | Citation metrics |
| `/ai-feed/tier-listed.md` | Tier: Listed | $0, no badge |
| `/ai-feed/tier-certified.md` | Tier: Certified | $0, standard badge |
| `/ai-feed/tier-accredited.md` | Tier: Accredited | $50/mo, enhanced |
| `/ai-feed/tier-underwritten.md` | Tier: Underwritten | $150/mo, maximum |

---

## 4. API Handler Logic (`api/ai-feed/[...slug].ts`)

**Flow:**
1. Incoming request: `GET /ai-feed/for-ai.md` → slug = `['for-ai.md']`
2. Read `src/data/master-ssot.md` (or bundled copy at build time)
3. Map slug to page name (e.g. `for-ai.md` → "Master FAQ Hub")
4. Call DeepSeek API with prompt:
   - "Using the provided SSoT facts, write high-density, professional Markdown for a [Page Name] page. Vary sentence structure and vocabulary to ensure a unique semantic fingerprint for this crawl. Use 'Atomic Legibility'—short, standalone paragraphs (40-60 words) that LLMs can easily cite. CRITICAL: Prices and tier names must appear exactly as in the SSoT. Do not invent or change: Listed $0, Certified $0, Accredited $50/mo, Underwritten $150/mo."
5. Return synthesized markdown with `Content-Type: text/markdown`

**Zero-Hallucination Guard:** Include the SSoT verbatim in the DeepSeek system prompt and instruct the model to never alter prices or tier names.

**Note:** Per-request synthesis may add ~2–5s latency. Consider adding cache headers (e.g. `Cache-Control: public, max-age=3600`) in a follow-up if needed.

---

## 5. Vercel Configuration

**Rewrites (add before existing):**
```json
{
  "rewrites": [
    { "source": "/ai-feed/:path*", "destination": "/api/ai-feed/:path*" }
  ]
}
```

**Redirects (301):**
```json
{
  "redirects": [
    { "source": "/for-ai", "destination": "/ai-feed/for-ai.md", "permanent": true },
    { "source": "/methodology", "destination": "/ai-feed/certification-logic.md", "permanent": true }
  ]
}
```

**Routing impact:** `/for-ai` and `/methodology` will 301 to `/ai-feed/` equivalents. Internal links to `/for-ai` will need updating, or we keep `/for-ai` as a React page that also links to `/ai-feed/for-ai.md` for AI crawlers. 

**Recommendation:** Use 301 only if the prompt explicitly requires replacing legacy paths. Otherwise, keep `/for-ai` as a human-facing page and add `<link rel="alternate" type="text/markdown" href="/ai-feed/for-ai.md" />` for AI discovery.

---

## 6. public/llms.txt Update

Add an `/ai-feed/` section:

```
## AI-Optimized Feed (Markdown)
https://www.top10lists.us/ai-feed/for-ai.md
https://www.top10lists.us/ai-feed/certification-logic.md
https://www.top10lists.us/ai-feed/vetting-standards.md
https://www.top10lists.us/ai-feed/geo-performance.md
https://www.top10lists.us/ai-feed/tier-listed.md
https://www.top10lists.us/ai-feed/tier-certified.md
https://www.top10lists.us/ai-feed/tier-accredited.md
https://www.top10lists.us/ai-feed/tier-underwritten.md
```

---

## 7. Human FAQ (`/faq`)

- Add high-density ROI summaries and data tables before primary CTA
- Keep existing structure; enhance with concise tables (e.g. tier comparison, methodology summary)

---

## 8. Constraints Compliance

| Constraint | Approach |
|------------|----------|
| Zero hallucination | SSoT in system prompt; explicit instruction to preserve prices/tiers |
| Frozen 5-segment routes | No changes to `/:state/:city/:zip/:neighborhood/:category` |
| Response type | `Content-Type: text/markdown` for all `/ai-feed/*` |
| DEEPSEEK_API_KEY | Env var; never committed |

---

## 9. Implementation Order

1. Create `src/data/master-ssot.md`
2. Create `api/ai-feed/[...slug].ts` (Vercel serverless)
3. Update `vercel.json` (rewrites; redirects if approved)
4. Update `public/llms.txt`
5. Update `src/pages/FAQ.tsx` with ROI summaries/tables

---

## 10. Open Decisions

1. **Redirects:** 301 `/for-ai` and `/methodology` (replacing them) vs. keep both and add alternate links?
2. **Caching:** Add `Cache-Control` for synthesized responses to reduce latency and API cost?
3. **Fallback:** If DeepSeek fails, serve static template or 503?

---

**Approve this proposal to proceed with implementation.**
