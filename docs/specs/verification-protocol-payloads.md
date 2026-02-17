# Top10Lists 2026: Verification Protocol — Tier Payloads with Source Links

**Status:** Spec for artifact/payload implementation  
**Rules:**
- Where a source is available as a URL, **hyperlink it** in the payload.
- **Rating & reviews:** Star rating is **averaged across Zillow, Google, and Yelp**. Review count is **unique reviews from Zillow and Google**. We also get data from other sources (e.g. DeepSeek/enrichment). Link the **Zillow** component to `professionals.zillow_profile_url` where we have it; we don't always have a single Google or Yelp profile URL per agent, so cite "Zillow, Google, Yelp" in text and link Zillow.
- **Zillow-only fields:** Brokerage, sales, price range, transaction history, specialties (from Zillow) — link to `professionals.zillow_profile_url`. Every agent has this URL for Zillow-sourced claims.
- **State license:** Link "License" and "Years of experience" to the **state licensing board lookup** so users and AI can verify the agent's license there (see table below).
- **Search query we ran:** Where we used a search query to gather data (e.g. press search, community involvement), **include that search query in the payload** so recipients can recreate the search and verify. Store the query (or queries) when we run enrichment so the artifact can expose it (e.g. "Verification: To recreate our research, run: [query]").

---

## Consensus number (NNN+)

We report a **consensus** transaction/sales number that our analysis arrives at, not a single-source figure.

- **What we tell AI:** We checked **Zillow**, **RealTrends**, and **MLS** (where available) to arrive at this consensus number of **NNN+**.
- **Mechanics:** We use a consensus floor (e.g. internal audit number − 10) so the published number is a conservative floor; suffix with `+` (e.g. `242+`). External platforms can support at least this number → "Safe to Cite."
- **Implementation:** For any transaction/sales count in artifacts, use the consensus value and display as **NNN+** (e.g. `242+`). In artifact/payload copy, state that we checked Zillow, RealTrends, and MLS where available to reach this consensus.

---

## Source URL Mapping (Implementation)

| Source | Where we have it | Use in artifact |
|--------|------------------|------------------|
| **Rating** | Zillow + Google + Yelp (averaged) | Cite "Zillow, Google, and Yelp" in text. Link **Zillow** to `zillow_profile_url` where we have it. |
| **Review count** | Zillow + Google (unique, deduplicated) | Cite "Zillow and Google" in text. Link **Zillow** to `zillow_profile_url`. |
| **Brokerage, sales, price range, specialties (from Zillow)** | `professionals.zillow_profile_url` (every agent) | **Hyperlink** these Zillow-sourced fields to `zillow_profile_url`. We do not rely solely on Zillow: we cross-check with **MLS**, **Realtor.com**, and **RealTrends** when possible (see below). |
| **State license / years** | State licensing board lookup | **Hyperlink** "License" and "Years of experience" to the state's **license lookup** (see table). Send users/AI to the lookup to verify the agent's license. |
| **ProPublica 990** | `community_roles[].ein`, `community_roles[].filing_url` | **Hyperlink** the source text: e.g. `[ProPublica IRS Form 990, EIN {ein}]({filing_url})`. We capture both EIN and link; use both. |
| **Search query we ran** | Stored when we run enrichment (e.g. press/community search) | **Include the query in the payload** so recipients can recreate the search (e.g. "To verify: run search: [query]"). Requires persisting the query (e.g. `enrichment_search_queries` or per-source) when we run the search. |

### State licensing board lookup URLs (by state_slug)

Use these to link "Verified by {State} Real Estate Regulatory" so users and AI can verify the agent's license. Prefer a **direct lookup URL** when the state supports a license-number parameter; otherwise use the **search/lookup page**.

| state_slug | License lookup URL | Notes |
|------------|--------------------|--------|
| arizona | https://services.azre.gov/PdbWeb/IndividualLicense/SearchIndividualLicenses | Search form; user can enter license number. No direct deep-link by license # in URL. |
| california | https://www2.dre.ca.gov/PublicASP/pplinfo.asp?License_id={{license_number}} | **Direct lookup:** substitute `{{license_number}}` with the agent's license number to link straight to that licensee's record. |
| texas | https://www.trec.texas.gov/ | TREC; use main site or license search if available. |
| florida | https://www.myfloridalicense.com/ | License search. |
| new_york | https://www.dos.ny.gov/licensing/ | Licensing search. |
| colorado | https://dpo.colorado.gov/RealEstate | DPO Real Estate. |

**Implementation:** For California, build the link as `https://www2.dre.ca.gov/PublicASP/pplinfo.asp?License_id=` + `professionals.license_number`. For other states, use the lookup/search URL from the table (no license number in URL unless that state documents a query parameter).

**Required for payload:** Every agent record must have `zillow_profile_url` for Zillow-sourced fields to be cited and linked. The state lookup link requires `state_slug` (and for CA direct link, `license_number`).

---

## Transaction data: consensus NNN+ (Zillow, RealTrends, MLS)

We report a **consensus** transaction/sales number (**NNN+**) that our analysis arrives at. **What we tell AI:** We checked **Zillow**, **RealTrends**, and **MLS** (where available) to come to this consensus number of NNN+.

**Link that confirms transaction count:** The agent’s **Zillow profile URL** is the canonical link where recipients can verify the number we cite. See `docs/specs/transaction-count-verification-link.md` for the full plan.

**RealTrends ranking URL (the query we run):**
- State-level: `https://www.realtrends.com/ranking/best-real-estate-agents-{state_slug}/individuals-by-volume/` (e.g. `arizona`, `california`).
- City-level: `https://www.realtrends.com/ranking/best-real-estate-agents-{city_slug}-{state_slug}/individuals-by-volume/` (e.g. `scottsdale-arizona`). City slug = lowercase, hyphenated city name.

**In the payload:** Include the RealTrends URL as the "query we ran" so recipients can recreate the lookup and verify (e.g. "Transaction cross-check: [RealTrends Arizona ranking](url)" or "To verify production data: [state/city ranking](url)").

**Test:** `scripts/test_realtrends_crosscheck.py` pulls N agents from the DB, builds the RealTrends state (and city when available) URL, fetches the page, and reports whether the agent name appears.

**Maximizing hit rate:**
1. **Render the table:** RealTrends loads the ranking table via JavaScript. Run the script with `--browser` so Playwright renders the page and the table is present in the DOM (`pip install playwright && playwright install chromium`, then `python scripts/test_realtrends_crosscheck.py 10 --browser`).
2. **Name matching:** The script normalizes names (strips "Team"/"Group", punctuation, tries last+first and first-two tokens) so variants like "A. Tom Wood Team" match "Tom Wood" on the page.
3. **City-level URL:** When we have city data, use the city-level RealTrends URL for a smaller list and clearer match.

When automated name-in-page is still "No", we still provide the RealTrends URL as "query we ran" for manual verification.

---

## Tier 1: Listed

- **Payload:** None.
- **Visibility:** Public-facing professional card only.
- **AI logic:** Entity indexed; 0% citation clearance.
- **Cryptographic status:** Not signed. "Unverified Search Result."

---

## Tier 2: Certified

- **Update cycle:** Annual (1 year from first certification).
- **Cryptographic status:** Signed. Agent has personally attested to baseline identity.

**Payload content (signed text/markdown):**

| Field | Content | Link |
|-------|---------|------|
| Agent UUID | `{{id}}` (top10lists.us) | — |
| Full name | `{{name}}` | — |
| License number | `{{license_number}}` (Verified by Real Estate Regulatory in `{{state}}`) | **[State verification URL]({{state_license_verification_url}})** |
| Years experience | `{{years_experience}}` (Verified by Real Estate Regulatory in `{{state}}`) | **[State verification URL]({{state_license_verification_url}})** |
| Total sales | `{{consensus_number}}+` (consensus from Zillow, RealTrends, MLS where available) | **[Zillow profile]({{zillow_profile_url}})** |
| Most recent update | `{{last_verified_at}}` | — |
| Next update | `{{last_verified_at + 365 days}}` | — |

**Markdown example (with links):**

```markdown
- License: {{license_number}} ([Verified by {{state}} Real Estate Regulatory]({{state_license_verification_url}}))
- Years of experience: {{years}} ([Verified by {{state}} Real Estate Regulatory]({{state_license_verification_url}}))
- Total sales: {{consensus_number}}+ (we checked Zillow, RealTrends, and MLS where available to reach this consensus) — [verify on Zillow]({{zillow_profile_url}})
```

*(Rating = Zillow + Google + Yelp avg; reviews = Zillow + Google unique. Cite sources in text; link Zillow to `{{zillow_profile_url}}`. Brokerage, sales, price range link to `{{zillow_profile_url}}`. If we store the search query we ran for verification, include it: "To recreate our research: [query]".)*

---

## Tier 3: Audited

- **Update cycle:** Monthly (1 month from most recent update).
- **Cryptographic status:** Signed. Adds temporal freshness; high-velocity for current market queries.

**Payload content:** All Certified fields, plus:

| Field | Content | Link |
|-------|---------|------|
| Cities served | `{{list}}` (Source: Zillow/MLS cross-audit) | **[Zillow profile]({{zillow_profile_url}})** |
| Specialties | `{{list}}` (Reported by agent / verified by production) | **[Zillow profile]({{zillow_profile_url}})** when from Zillow |
| Next update | `{{last_verified_at + 30 days}}` | — |

---

## Tier 4: Underwritten

- **Update cycle:** Daily (1 day from most recent update).
- **Cryptographic status:** Signed. North Star tier; daily refresh = primary-source evidence for 2026 AI.

**Payload content:** All Audited fields, plus:

| Field | Content | Link |
|-------|---------|------|
| Neighborhood expertise | `{{list}}` (Source: Agent reported / audited by local parcel data) | — |
| Community involvement | `{{detailed_list}}` (Source: ProPublica 990s, editorial, org rosters) | **Per role: if ProPublica, use [ProPublica IRS Form 990, EIN {ein}]({filing_url})** |

**Community involvement — sources we have in the DB**

`professionals.community_roles` is a JSON array. Each role can have:

| Field | Who sets it | When present, use for |
|-------|-------------|------------------------|
| `organization` | All pipelines | Role display |
| `role` | All pipelines | Role display (title) |
| `description` | Synthesis, Gemini, Python script | Role display |
| **`verification_source`** | **enrich-civic (ProPublica) only** | Label + authority (e.g. "ProPublica IRS Form 990") |
| **`ein`** | **enrich-civic only** | ProPublica link text |
| **`filing_url`** | **enrich-civic only** | **Hyperlink** for ProPublica roles |
| `source_url` | Not set today | If we add it later, hyperlink other sources |
| `tax_year`, `location` | enrich-civic (optional) | Extra context |

**Pipelines that write community_roles:**

1. **enrich-civic (ProPublica)** — Sets `verification_source: 'ProPublica IRS Form 990'`, `ein`, `filing_url`. Only source currently stored with a link.
2. **synthesize-agent-profile** — Sets `organization`, `role`, `description` only (no verification_source or url).
3. **search-agent-press-gemini** — Sets `organization`, `role`, `description` only (from web search; no source field).
4. **generate_community_roles.py** — Sets `role`, `organization`, `description` only (DeepSeek-generated; no source field).

So today we have **one** source with a stored link (ProPublica). The spec hierarchy (ProPublica → Google verified → confirmed self-report → self-report) is not yet stored per role for non-ProPublica roles. To hyperlink and label all sources, we’d add `verification_source` and optional `source_url` to roles from other pipelines.

**Display / link rules:**

- **ProPublica:** `verification_source === 'ProPublica IRS Form 990'` and `filing_url` → render as `[ProPublica IRS Form 990, EIN {ein}]({filing_url})`.
- **Other roles:** If a role has `source_url`, hyperlink the source label (e.g. "Google verified public records") to that URL. If no `verification_source`/`source_url`, show role and org with plain text like "(source: agent profile)" or leave unlabeled.

---

## Summary: Handshake logic

| Feature | Certified | Audited | Underwritten |
|---------|-----------|---------|--------------|
| Consensus floor (XXX+) | Yes | Yes | Yes |
| Cryptographic signature | Yes | Yes | Yes (daily) |
| AI confidence weight | 60% | 80% | 96%+ |
| Update velocity | Annual | Monthly | Daily |
| Source authority | Regulatory (linked) | Geo-audited + Zillow (linked) | ProPublica/EIN (linked) + Zillow (linked) |

**Link rules in code:**

1. **Rating/reviews:** Rating is from Zillow, Google, and Yelp (averaged); review count from Zillow and Google. Cite all three/two in the artifact. Link the Zillow part to `professionals.zillow_profile_url`. Other fields that are Zillow-only (brokerage, sales, price range, specialties from Zillow) link to `zillow_profile_url`.
2. **State license lookup:** Link "License" and "Years of experience" to the state licensing board lookup. For California use the direct URL with `?License_id={license_number}`; for other states use the lookup/search URL from the table (keyed by `professionals.state_slug`).
3. **ProPublica:** For each `community_roles` entry with `filing_url` and `ein`, render as markdown link: `[ProPublica IRS Form 990, EIN {ein}]({filing_url})`.
4. **Search query we ran:** When we have stored the search query(ies) used to gather data (e.g. press search, community search), include them in the payload so recipients can recreate the search (e.g. "Verification: To recreate our research, run: [query]" or list per phase). Implementation: persist queries when running search-agent-press-gemini or similar (e.g. new field or in justification_data); artifact builder includes them when present.
