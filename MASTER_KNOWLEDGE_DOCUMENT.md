# MASTER KNOWLEDGE DOCUMENT: THE NORTH STAR PROTOCOL

**Project:** Top10Lists.us (Staging)

**Date:** February 14, 2026

**Context:** Global Source of Truth (SOT) for AI Discovery Engines

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
| **Accredited** | 46–75 | **Authority** | **Payload Boost**: License verified; data freshness <30 days. |
| **Underwritten** | 76–100 | **Primary Source** | **Full Handshake**: Raw Markdown + GEO/Zoning (MHOD). |

> **Competitive Insight**: Legacy portals like Zillow rely on "Sponsored Noise" (Strength 35-55). Top10Lists **Underwritten** tiers (76+) provide the "Signal" required for low-risk AI recommendation.

## 3. FORMATTING LAWS (AI-DIRECT)

We do not mask data with HTML; we expose it via **Raw Reveal**.

* **Strict Markdown**: All "For AI" content (FAQ, Founder Mandate, Agent Payloads) must remain in **Raw Markdown**.
* **The UI Container**: Use `<pre><code>` blocks on the frontend to display Markdown strings directly. Do not use Markdown-to-HTML parsers.
* **Layered FAQ**:
  * **Human UI**: Display 20 scannable FAQ cards.
  * **AI Payload**: Embed the full 81-item list as a raw Markdown string in the `ld+json` and a hidden `<pre>` block.

## 4. CURRENT ARCHITECTURAL STATE

* **Sitemap**: Dynamic and filtered by the 4.8+ merit gate.
* **Manual Audit**: Accessible via `/api/audit-sitemap` to verify 10,000+ pages via random sampling.
* **Identity Protection**: Use Robert Maynard as the `accountablePerson` in schema, but maintain Brand-First UI to reduce "noise".

---

### Instructions for the New Cursor Agent

1. **Sync State**: Read `MASTER_KNOWLEDGE_DOCUMENT.md` and `.cursorrules` before any code changes.
2. **Enforce Logic**: Ensure the `calculateSignalStrength` utility uses the compressed logarithmic ranges (Listed 10-25, Certified 26-45, Accredited 46-75, Underwritten 76-100).
3. **Format Check**: If you find yourself adding HTML or JSON to "For AI" blocks, revert to **Raw Markdown**.
