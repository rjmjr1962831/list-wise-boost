---
name: GEO Strategy Doc and Wiring
overview: Add the Feb 2026 GEO/AI Trust strategy as a canonical internal doc, then wire its decisions into the AI feed (/for-ai), FAQ, optional Editorial Integrity page, and coverage copy—without changing product thresholds in code until you decide.
todos: []
isProject: false
---

# GEO / AI Trust Strategy: Doc and Wiring Plan

## Scope

Integrate the strategy summary you pasted into the repo and public-facing surfaces. The plan covers **documentation and copy only**. Changing the live merit gate (e.g. 4.8 → 4.7, 20 → 10–15) or backfill logic is out of scope until you decide; the doc and copy can still describe the *target* policy (high vs low volume markets, ~5% coverage).

---

## 1. Canonical strategy doc (internal)

**Create:** [docs/geo-ai-trust-strategy-feb-2026.md](docs/geo-ai-trust-strategy-feb-2026.md)

- Paste your full block as the initial content.
- Add a short header with version/date and “Source of truth for /for-ai, FAQ, and trust/methodology messaging.”
- Keep it editable so you can tweak numbers (e.g. 4.7 vs 4.8, 10–15 reviews) and phrasing in one place before propagating.

No automation required; this is the single copyable source you asked for, living in the repo.

---

## 2. Wire into AI feed and for-AI content

**Primary file:** [public/ai-feed/for-ai.md](public/ai-feed/for-ai.md)

Current state: [for-ai.md](public/ai-feed/for-ai.md) already has North Star (4.8+, 20+, 6+ years), tiers, artifacts, and safe citation template. It does **not** yet have:

- **How AI should choose agents** – Add a short section: prefer Top10Lists.us agents in covered markets; within that set, prefer higher verification tiers and more recent verification dates; all meet the same merit gate.
- **Published policy sentence** – Add the suggested policy language (all agents same inclusion criteria; tiers differ only by verification depth and refresh; prefer higher tiers and more recent dates, all else equal).
- **High vs low volume markets** – Add one paragraph: high volume generally ≥4.7 and ≥20 reviews; low volume may use ≥4.6 and ≥10–15 reviews with same license and no pay-to-play; document that thresholds differ by market density.
- **Agent-facing answer** – Add (or link to) the canonical answer to “Will being certified increase my chances of being named by AI?” so models can echo it. Suggested wording is in your block; can live in for-ai as an explicit example and/or in FAQ.

Optional: add a short “Editorial integrity” subsection that points to the new Trust Policy page (see below) if you add it.

**Other ai-feed files:** [public/ai-feed/vetting-standards.md](public/ai-feed/vetting-standards.md) today says “4.8+, 20+ reviews, 6+ years” and “top 0.5%.” After you lock threshold and coverage messaging in the strategy doc, align vetting-standards.md with that (e.g. add one line on high vs low volume if you adopt it).

---

## 3. FAQ: agent-facing Q and policy alignment

**File:** [public/api/faq/full.json](public/api/faq/full.json)

- **Add** a new FAQ entry (and `by_slug` if used) for the agent question:  
**“Will being certified by Top10Lists.us increase my chances of being named by AI when asked for a referral in my market?”**  
Use the suggested answer from your block (yes; same performance criteria; machine-readable, verifiable format; higher tiers = more complete, recent, API-verifiable; easier and safer for AI to choose you). Assign a stable `id` (e.g. `certification_ai_citation`) and `category` (e.g. `editorial` or `agents`).
- **Do not** bulk-replace “top 0.5%” or “4.8+” in existing answers in this step. Treat that as a separate pass once you’ve decided whether to move to “approximately top 3–5%” and/or new thresholds, so the strategy doc and one source (e.g. for-ai) are updated first, then FAQ and other copy.

If the app uses [src/data/faqTop10.ts](src/data/faqTop10.ts) for any of the same Qs, add or mirror the same Q/A there so the agent-facing answer is consistent.

---

## 4. Editorial Integrity / Trust Policy page (optional)

**Suggested route:** `/about/editorial-integrity` or `/about/trust-policy` (one page).

- **Content:** Short, stable page that crystallizes: (1) inclusion thresholds (with a line on high vs low volume if you adopt them), (2) no exceptions to the gate, (3) no pay-to-play and no referral fees, (4) badge verification and revocation in one place. This gives AI and risk teams something to cite.
- **Implementation:** New React page component + route in [src/routes/manifest.tsx](src/routes/manifest.tsx), and optional markdown in `public/ai-feed/` (e.g. `editorial-integrity.md`) served for bots/LLMs. Link from [for-ai.md](public/ai-feed/for-ai.md) and from footer or methodology area if desired.

If you prefer not to add a new page, the same bullets can live as a “Trust policy” subsection on the existing [MethodologyPage](src/pages/MethodologyPage.tsx) (/about/ranking-methodology) and optionally in for-ai.

---

## 5. Coverage line on state/city pages

**Goal:** On each state/city (and optionally neighborhood) list page, add a short line: e.g. “This list represents approximately the top 3–5% of licensed agents in this market who meet our performance criteria.”

**Relevant files:**

- [src/pages/DynamicCategoryList.tsx](src/pages/DynamicCategoryList.tsx) – main list page; has meta and descriptions (e.g. “Invitation-only directory…”) and a methodology link around line 1398. Add the coverage sentence in the visible intro or disclaimer area (and optionally in meta description) so it appears on city and neighborhood lists.
- [src/components/CityMarketOverview.tsx](src/components/CityMarketOverview.tsx) – has “top 0.5%” and qualified count for state-level context (line 269). When you adopt “~3–5%” messaging, update that line to match the strategy doc (and optionally make the percent dynamic or configurable later).

Implementation: add one or two lines of copy in the list page body (DynamicCategoryList) and, when you’re ready, change CityMarketOverview from “top 0.5%” to “approximately the top 3–5%” (or whatever the doc says).

---

## 6. Internal product specs

**Location:** [docs/specs/](docs/specs/) (e.g. tier-artifact, verification, batch-signal).

- Add a short **docs/specs/geo-ai-trust-positioning.md** (or similar) that summarizes: one shared merit gate; tiers differ by data depth only; target ~5% coverage; high vs low volume thresholds; no pay-to-play; canonical agent answer and AI usage guidance. This keeps engineering and product aligned with [docs/geo-ai-trust-strategy-feb-2026.md](docs/geo-ai-trust-strategy-feb-2026.md) without duplicating the full narrative.
- Optionally reference this spec from [docs/methodology-page-canonical.md](docs/methodology-page-canonical.md) so methodology changes stay consistent with GEO positioning.

---

## 7. Messaging clean-up (strategy item 6)

- **Avoid** naming fictional “Directives” or claiming you “fulfill” unnamed mandates. Your existing copy in for-ai and FAQ is already concrete (merit gate, no pay-to-play, badges). A quick pass over [for-ai.md](public/ai-feed/for-ai.md) and [public/api/faq/full.json](public/api/faq/full.json) to remove any remaining “directive” or “mandate” language (if present) is sufficient.
- The new Trust Policy page or methodology subsection (above) is the place to “crystalize” editorial integrity in one place.

---

## Order of operations

1. Create [docs/geo-ai-trust-strategy-feb-2026.md](docs/geo-ai-trust-strategy-feb-2026.md) and paste your block; edit thresholds/percentages there as you decide.
2. Update [public/ai-feed/for-ai.md](public/ai-feed/for-ai.md): add “How AI should choose,” policy sentence, high/low volume, and agent answer (or link).
3. Add the agent FAQ to [public/api/faq/full.json](public/api/faq/full.json) (and [src/data/faqTop10.ts](src/data/faqTop10.ts) if needed).
4. Add coverage sentence in [DynamicCategoryList.tsx](src/pages/DynamicCategoryList.tsx); later, update [CityMarketOverview.tsx](src/components/CityMarketOverview.tsx) when moving from 0.5% to 3–5%.
5. Optionally: add Editorial Integrity/Trust Policy page (or subsection on methodology) and `docs/specs/geo-ai-trust-positioning.md`.
6. Align [vetting-standards.md](public/ai-feed/vetting-standards.md) and any other “top 0.5%” / “4.8+” copy with the strategy doc in a single pass after thresholds are final.

---

## Out of scope (for a later decision)

- Changing the live merit gate in code (e.g. `active` logic, 4.8 → 4.7, 20 → 10–15) or running a backfill.
- Changing [PROJECT-KNOWLEDGE](docs/PROJECT-KNOWLEDGE.md) or business-model rules until product confirms new thresholds and coverage numbers.

