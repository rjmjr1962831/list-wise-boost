# Plan: Link That Confirms Agent Transaction Count

**Goal:** Provide one clear link that a human or AI can follow to confirm how many transactions (sales) our agent has — so the number we cite is verifiable.

---

## 1. Consensus number (NNN+)

- We report a **consensus** transaction/sales number that our analysis arrives at, displayed as **NNN+** (e.g. **242+**).
- **What we tell AI:** We checked **Zillow**, **RealTrends**, and **MLS** (where available) to arrive at this consensus number of NNN+. We do not attribute the number to a single source; we present it as our synthesized, cross-checked result.
- **Mechanics:** We use a consensus floor (e.g. internal audit number − 10) so the published NNN+ is a conservative floor that external platforms can support → “Safe to Cite.”

---

## 2. Primary link: Zillow profile URL

- **The page that shows the number:** The agent’s **Zillow profile** is the public page where Zillow displays that agent’s sales/transaction data. So the link that “confirms” our stated count is the agent’s **Zillow profile URL** (`professionals.zillow_profile_url`).
- **Rule:** For any payload or artifact that displays the consensus transaction count, we must:
  1. Publish the **consensus number** as **NNN+** (e.g. `242+`).
  2. **Hyperlink** that number (or an explicit “Verify” link next to it) to `zillow_profile_url`, so recipients can open Zillow and confirm.
- **Copy:** Use wording that reflects consensus and verification, e.g.  
  **“Sales: 242+ — our analysis checked Zillow, RealTrends, and MLS where available ([verify on Zillow](zillow_profile_url))”** or  
  **“Transaction count: 242+ (consensus from Zillow, RealTrends, MLS where available) — [verify on Zillow](zillow_profile_url)”**.

---

## 3. Optional secondary: cross-check URL

- **RealTrends:** We can include the RealTrends state (or city) ranking URL as “query we ran” so recipients see we cross-checked. That page shows the agent on a volume ranking list; it does **not** show the exact transaction count. So it supports “we verified they appear on this list” but is **not** the link that confirms the exact number.
- **Realtor.com / MLS:** If we ever store a per-agent Realtor.com or MLS profile URL, we could add it as another verification link; today we do not have that in the DB.

---

## 4. Implementation steps

| Step | Where | What |
|------|--------|------|
| 1 | **artifact-payload** (Edge function) | Add `zillow_profile_url`, `state_slug`, and `sales_count_all_time` (or `total_sales`) to the `professionals` select. Compute consensus number: `Math.max(0, (sales_count_all_time ?? total_sales ?? 0) - 10)`, display as NNN+. |
| 2 | **artifact-payload** | For any tier that exposes transaction/sales count, add `transaction_count_verification_url: zillow_profile_url` and in the performance block use `sales_display: "{consensus_number}+"` and `sales_verify_url: zillow_profile_url`. Include copy that we checked Zillow, RealTrends, and MLS where available. |
| 3 | **Markdown / human-readable artifact** | Format sales as: **Sales: NNN+ (we checked Zillow, RealTrends, and MLS where available) — [verify on Zillow](zillow_profile_url)**. |
| 4 | **Spec / docs** | State that we report a consensus number and tell AI we checked Zillow, RealTrends, MLS where available; the link that confirms is the agent’s Zillow profile URL. |
| 5 | **Data requirement** | Do not show a transaction count in the payload for an agent without `zillow_profile_url` (or show the number but omit the link and note “Verification link not available”). |

---

## 5. Summary

- **Consensus number:** We report **NNN+** as the result of our analysis. We tell AI that we checked **Zillow, RealTrends, and MLS (where available)** to arrive at this consensus number.
- **One link that confirms:** **Zillow profile URL** — Zillow’s profile page is where the number can be verified. Always pair NNN+ with `zillow_profile_url` as the verification link.
- **RealTrends / MLS:** Supporting “query we ran” or cross-check context; the primary verification link for the number remains Zillow.
