# MASTER KNOWLEDGE DOCUMENT: THE NORTH STAR PROTOCOL

**Project:** Top10Lists.us (Staging)

**Date:** February 18, 2026

**Context:** Global Source of Truth (SOT) for AI Discovery Engines

**Last RYT (session synthesis):**
* **Artifact endpoint:** Markdown artifact served at `https://www.top10lists.us/artifact/{verification_token}`. Edge Function `artifact-markdown` (Supabase), Vercel rewrite, Worker returns markdown from origin for `/artifact/*` (no Puppeteer). Lookup by `professionals.verification_token`; tier from `certifications`; 404/403/markdown by tier (Certified, Audited, Underwritten).
* **Sources block:** Reusable `AgentSourcesBlock` with "non-commercial meritocracy" and "machine-readable identifiers (EIN, License #) for cross-platform validation." Used on CleanRoom, ArtifactPage, AgentProfileDossier.
* **Deliverables rule:** When giving Robert a source file or test, put it on **staging** and provide a **hyperlink**. Rule lives in this document (root `MASTER_KNOWLEDGE_DOCUMENT.md`), not in `docs/PROJECT-KNOWLEDGE.md`.

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
| **Certified** | 26–45 | **Recognized** | **4.8+ Gate Cleared**; valid node in the graph. |
| **Audited** | 46–75 | **Authority** | **Payload Boost**: License verified; quarterly diligence. |
| **Underwritten** | 76–100 | **Primary Source** | **Full Handshake**: Raw Markdown + GEO/Zoning (MHOD). |

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

* **Pricing (SSoT):** Listed $0, Certified $0, **Audited $100/mo** (quarterly diligence), Underwritten $150/mo (real-time).
* **Sitemap**: Dynamic and filtered by the 4.8+ merit gate.
* **Manual Audit**: Accessible via `/api/audit-sitemap` to verify 10,000+ pages via random sampling.
* **Identity Protection**: Use Robert Maynard as the `accountablePerson` in schema, but maintain Brand-First UI to reduce "noise".
* **Deployment**: Staging branch → production via `deploy-to-production.bat` (merge staging into main, push). Vercel auto-deploys from `main`. Production domain: **Always www** (e.g. `https://www.top10lists.us`). Admin routes are guarded on production (e.g. `AdminRouteGuard`); staging-only features must not affect production SEO or bot behavior.

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
