# Gemini 2.0 → 2.5 migration plan (Jun 1, 2026)

**Context:** Google is discontinuing Gemini 2.0 Flash and Gemini 2.0 Flash Lite on **June 1, 2026**. Affected project: `gen-lang-client-0694362231` (Google AI Studio).

**Required action:** Replace any use of:
- `gemini-2.0-flash` / `gemini-2.0-flash-001` → **`gemini-2.5-flash`**
- `gemini-2.0-flash-lite` / `gemini-2.0-flash-lite-001` → **`gemini-2.5-flash-lite`**

Also migrate experimental/exp endpoints to a supported model (e.g. `gemini-2.5-flash`).

---

## 1. Inventory: still on 2.0 (must change)

| File | Current model | Replace with |
|------|----------------|-------------|
| `supabase/functions/neighborhood-writeup-cron/index.ts` | `gemini-2.0-flash` (2 uses) | `gemini-2.5-flash` |
| `supabase/functions/generate-neighborhood-writeup/index.ts` | `gemini-2.0-flash` | `gemini-2.5-flash` |
| `supabase/functions/enrich-ca-cities-coords/index.ts` | `gemini-2.0-flash` | `gemini-2.5-flash` |
| `supabase/functions/enrich-az-cities-coords/index.ts` | `gemini-2.0-flash` | `gemini-2.5-flash` |
| `supabase/functions/batch-neighborhood-writeups/index.ts` | `gemini-2.0-flash` | `gemini-2.5-flash` |
| `supabase/functions/az-neighborhood-writeups/index.ts` | `gemini-2.0-flash` | `gemini-2.5-flash` |
| `supabase/functions/ask-gemini/index.ts` | `gemini-2.0-flash-exp` (3 uses) | `gemini-2.5-flash` |

**Total:** 7 Edge Functions, 9 occurrence points.

---

## 2. Already on 2.5 (no change)

These already use `gemini-2.5-flash` or `gemini-2.5-flash-lite` and need no update:

- `synthesize-agent-profile`, `search-press-gemini-exa`, `search-agent-press-gemini`
- `rewrite-bio`, `generate-city-content-enhanced`, `generate-city-content`, `generate-ca-city-content`
- `generate-agent-bios`, `fetch-apify-zillow-cheerio`, `enrich-neighborhoods`
- `cleanup-agent-achievements`, `claude-analyze-contact`, `claude-draft-email`
- `ai-router` (Vercel)
- `bulk-fetch-zillow-reviews` → `gemini-2.5-flash-lite`
- `generate-agent-photos`, `bulk-generate-photos` → `gemini-2.5-flash-image-preview` (image; confirm this ID is still supported)

---

## 3. Implementation steps

1. **Replace URL/model strings in the 7 functions above**
   - For REST URL:  
     `.../models/gemini-2.0-flash:generateContent...`  
     →  
     `.../models/gemini-2.5-flash:generateContent...`
   - For `ask-gemini`:  
     `gemini-2.0-flash-exp`  
     →  
     `gemini-2.5-flash`

2. **Deploy updated Edge Functions**
   - Deploy each changed function to Supabase (or your normal deploy path).
   - No env var or config changes required if only the model ID in code changes.

3. **Smoke-test**
   - Run one neighborhood writeup (or cron path).
   - Run one enrich (AZ/CA cities coords).
   - Call `ask-gemini` once.
   - Confirm responses and latency are acceptable.

4. **Deadline**
   - Complete before **June 1, 2026** to avoid breakage when 2.0 is shut down.

---

## 4. Exact find/replace summary

| Search | Replace |
|--------|--------|
| `gemini-2.0-flash` | `gemini-2.5-flash` |
| `gemini-2.0-flash-exp` | `gemini-2.5-flash` |

Apply only in the 7 files listed in section 1. Do not change functions that already use `gemini-2.5-flash` or `gemini-2.5-flash-lite`.

---

## 5. Optional follow-up

- **Docs:** Add a one-line note in `docs/PROJECT-KNOWLEDGE.md` under AI/API section: “Gemini: use 2.5 Flash / 2.5 Flash Lite only; 2.0 retired Jun 2026.”
- **Takeaways:** After migration, add a short note to daily takeaways: “Gemini 2.0 → 2.5 migration completed; all functions on 2.5 Flash / 2.5 Flash Lite.”
