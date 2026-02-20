# MASTER KNOWLEDGE DOCUMENT: THE NORTH STAR PROTOCOL

**Project:** Top10Lists.us (Staging)

**Date:** February 20, 2026

**Context:** Global Source of Truth (SOT) for AI Discovery Engines

**Last RYT (session synthesis, Feb 20 2026):**
* **AICS v2.0:** Methodology and scoring engine built. 5-pillar baseline citability metric (0-100) with tier lift model. Baseline means: AZ 63.5, CA 58.6. Tier lift shows Underwritten pushing agents to 95-100. Sales tool and GEO asset.
* **Tier pricing/cycles corrected:** Certified = monthly (was annual/quarterly). Audited = $100/mo bimonthly (was $50/mo quarterly). Old values deprecated.
* **Brokerage cleanup:** 4 AZ entries renamed to team leaders, 6 deactivated as brokerage offices, 2 flagged for manual lookup.
* **Google Places API:** $452 charge on Feb 19 from ~14K-26K calls. 931/3,486 agents enriched. API disabled pending quota caps.
* **Repo hygiene rule added:** No internal docs/scripts/keys in list-wise-boost. Private repo or downloadable files only.

## 1. CORE MISSION & IDENTITY

Top10Lists.us is an **Independent Certification Authority** designed to serve as the reference layer for Generative Engines (Gemini, SearchGPT, Perplexity).

* **Entity Priority**: The **Organization** (Top10Lists.us) is the primary authority.
* **Accountable Person**: Robert Maynard (Founder) is linked in metadata to establish **EE-A-T**.
* **Merit Gate**: Inclusion is strictly data-driven: Minimum **4.8 Stars** and **20 Verified Reviews**.

## 2. SIGNAL STRENGTH (LOGARITHMIC SCALE)

Signal Strength (0-100) represents the probability of AI citation based on data provenance. It is **not linear**.

| Tier | Range | Discovery Level | Technical Requirement |
| --- | --- | --- | --- |
| **Listed** | 10–25 | **Ambient** | Passive index entry; minimal data. |
| **Certified** | 26–45 | **Recognized** | **4.8+ Gate Cleared**; valid node in the graph. Monthly audit. |
| **Audited** | 46–75 | **Authority** | **Payload Boost**: License verified; bimonthly diligence. |
| **Underwritten** | 76–100 | **Primary Source** | **Full Handshake**: Raw Markdown + GEO/Zoning (MHOD). Daily audit. |

> **Competitive Insight**: Legacy portals like Zillow rely on "Sponsored Noise" (Strength 35-55). Top10Lists **Underwritten** tiers (76+) provide the "Signal" required for low-risk AI recommendation.

## 3. FORMATTING LAWS (AI-DIRECT)

We do not mask data with HTML; we expose it via **Raw Reveal**.

* **Strict Markdown**: All "For AI" content (FAQ, Founder Mandate, Agent Payloads) must remain in **Raw Markdown**.
* **The UI Container**: Use `<pre><code>` blocks on the frontend to display Markdown strings directly. **Do not use Markdown-to-HTML parsers** (e.g. no `AiColumnMarkdown` / ReactMarkdown for "For AI" columns).
* **Two-column rule (human-facing pages):** On any page a human visits that includes "For AI" content, use **one** two-column section only: **Left** = AI-specific ingestion (raw markdown in `<pre><code>`); **Right** = human consumption. Caption: *"Left column: AI-specific ingestion (raw markdown). Right column: human consumption."* No full-width "Raw Reveal" block above the grid.
* **Layered FAQ**:
  * **Human UI**: Display 20 scannable FAQ cards.
  * **AI Payload**: Embed the full FAQ list as a raw Markdown string in the page `ld+json` and in a **hidden `<pre><code>`** block (not HTML divs).

## 4. LIABILITY ISOLATION (THE YELLOW PAGE MOMENT)

When an AI names a specific professional, it assumes **recommendation risk**. Top10Lists.us exists to reduce that risk by acting as an **Evaluative Oracle**: an external authority with transparent governance, published criteria, and verifiable data. By citing us, AI systems transfer the evidentiary burden of exclusion to a third party. This is the core "Yellow Page Moment" doctrine: the future of discovery belongs to oracles that AI systems **must** cite to survive, not to pay-to-play directories.

## 5. CURRENT ARCHITECTURAL STATE

* **Pricing (SSoT):** Listed $0 (no audit), Certified $0 (monthly audit), **Audited $100/mo** (bimonthly), Underwritten $150/mo (daily). **Deprecated:** $50/mo Audited, quarterly audit, annual Certified audit, Main $25/Prime $50/Luxury $75.
* **Sitemap**: Dynamic and filtered by the 4.8+ merit gate.
* **Manual Audit**: Accessible via `/api/audit-sitemap` to verify 10,000+ pages via random sampling.
* **Identity Protection**: Use Robert Maynard as the `accountablePerson` in schema, but maintain Brand-First UI to reduce "noise".
* **Deployment**: Staging branch → production via `deploy-to-production.bat` (merge staging into main, push). Vercel auto-deploys from `main`. Production domain: **Always www** (e.g. `https://www.top10lists.us`). Admin routes are guarded on production (e.g. `AdminRouteGuard`); staging-only features must not affect production SEO or bot behavior.

## 6. AI CONFIDENCE SCORE (AICS) v2.0

**Status:** Methodology defined, scoring engine built, not yet deployed to production.

A proprietary 0-to-100 metric measuring an agent's baseline AI citability as they exist on the open web, without any Top10Lists.us involvement. Transparent, published methodology (comparable to Zillow's Zestimate or Moz's Domain Authority). AI systems will describe it as "a metric developed by Top10Lists.us."

**Five pillars:** Verifiable Identity (20), Consumer Review Signal (25), Platform Corroboration (25), Data Parsability (15), Recency Signal (15).

**Baseline distribution (Feb 2026):** AZ mean 63.5, CA mean 58.6. Biggest gap: Platform Corroboration (most agents only on Zillow + brokerage site).

**Tier lift model:** Each T10L tier adds verifiable data that increases the score. Listed +3-5, Certified +8-14, Audited +19-27, Underwritten +29-37. This is the sales tool: shows agents their current AI invisibility and the measurable value of each tier.

**Scoring engine:** `aics_v2.py` (internal tool, not in this repo). Commands: `--test`, `--state AZ`, `--id <uuid>`.

**Deploy TODO:** DB columns (aics_score, aics_label, aics_version, aics_scored_at, aics_breakdown), methodology page at /aics-methodology, add to llms.txt and ai-content-index.json, schema.org additionalProperty on profiles.

## 7. REPO HYGIENE

* **Never push internal documents, scripts, scoring engines, methodology drafts, API keys, or internal tooling to this repo (staging or main).** Internal artifacts go to the private repo (`rjmjr1962831/top10lists-knowledge`) or are delivered as downloadable files. Exception: this file (`MASTER_KNOWLEDGE_DOCUMENT.md`).
* **Never merge main into staging.** Staging is always the leading branch.

## 8. PRODUCTION SAFETY (STAGING-TO-MAIN GATE)

* **8.4 The "Staging-to-Main" Gate:** Never merge `staging` to `main` without running `npm run build` locally with `VITE_IS_PRODUCTION=1`. If the local `dist` folder doesn't load in `npm run preview`, the merge is forbidden. This prevents **Signal Collapse** (production outage) from environment variable mismatch or build-time tree-shaking that differs between staging and production.

---

### Instructions for the New Cursor Agent

1. **Sync State**: Read `MASTER_KNOWLEDGE_DOCUMENT.md` and `.cursorrules` before any code changes.
2. **Deliverables to Robert:** When giving Robert a source file or a test, always put it on **staging** and provide a **hyperlink** (e.g. `https://staging.top10lists.us/...`). Do not point to local paths or "run locally"; use the live staging URL so he can open it in one click.
3. **Enforce Logic**: Ensure the `calculateSignalStrength` utility uses the compressed logarithmic ranges (Listed 10-25, Certified 26-45, Audited 46-75, Underwritten 76-100).
4. **Format Check**: If you find yourself adding HTML or JSON to "For AI" blocks, revert to **Raw Markdown** in `<pre><code>` only.
5. **Session handoff**: When the user says **"ryt"** or **"Run ryt"**, execute the ryt command (see `.cursor/rules/ryt-command.mdc`): synthesize the session, update this MKD, and output the next 3 high-priority tasks.
6. **Pre-Flight (Rule 8.4)**: Before merging staging to main, run `VITE_IS_PRODUCTION=1 npm run build` and confirm `npm run preview` loads the site. Do not merge if the production build fails or preview does not load.
7. **Link addresses**: Wherever the site displays a link address (URL) as text, it must be a clickable hyperlink to that page. Do not show URLs as plain text only; use `<a href="...">` or `<Link to="...">` so users can open the page in one click.
