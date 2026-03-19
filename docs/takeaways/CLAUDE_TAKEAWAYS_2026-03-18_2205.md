# Claude Code Takeaways -- 2026-03-18 22:05 UTC

## Key Outcomes

### Funnel Pricing Page (Step7Pricing) -- ROI & Copy Polish
- Tier card ROI numbers now sync dynamically with calculator inputs (deal size, commission rate). Previously hardcoded at $800K/2.5%.
- Default deal size changed to $500,000, commission to 3%, AIFS input removed (locked to agent's actual tier score)
- InfoTip component: CSS hover tooltips on desktop, tap-to-toggle on mobile with click-outside dismiss and `max-w-[90vw]` viewport safety. Project's Tooltip component is a non-functional shim (renders inline), so built from scratch.
- Two tooltips added: "Closed deals (30%)" with NAR source copy, "Compound multiplier" with machine-trust moat + macro-shift copy
- Zillow banner updated: added speed-to-lead penalty language and "not a second full-time job" closer
- Tier name/price text changed from `text-foreground` (dark on dark) to `text-white` for contrast on slate-950 gradient
- Card backgrounds added (`bg-slate-900/80`, `border-slate-700`) for visibility
- Green banner spacing tightened (`mb-0`), card padding reduced (`py-3`)
- "Most Popular" badge no longer overlaps billing toggle (`mt-4` on grid)
- "View full data and sources" moved to center below CTA
- Subtitle updated: "Select a tier below to strengthen your AI citation probability and confidence when someone asks if they should do business with you."

### Agent Dashboard -- Command Center Rebuild (OverviewSection)
- Completely rebuilt from pricing-page-style layout to SaaS command center
- **Removed:** "How We Help AI Systems Cite You" marketing card, "Ask any AI" challenge box, three large pricing cards with billing toggles, "Our Tiered Product Structure" framing
- **Row 1 -- Three metric cards:**
  - AI Surfaces/Month (hero, dark gradient): uses `ai_surfaces_monthly_est` from professionals table (extrapolated from bot crawl data, includes all city/neighborhood list appearances). Falls back to raw `bot_crawl_logs` count. Shows AI bot pills.
  - AIFS Score: pulls from `geo_audit_results` based on actual tier. Progress bar, tier label. Scale 0-100.
  - Web of Truth status: red/green indicator, "Enable Artifact" link when disabled
- **Row 2 -- Upgrade Gap** (hidden for Underwritten agents): side-by-side current vs potential score with progress bars, copy about 85+ agents being authoritative sources, "View Upgrade Options" CTA to funnel pricing
- **Row 3 -- Crawl Explainer:** "What these crawls mean for you" with machine-trust moat copy (Option 1 -- cutthroat close). Uses same `ai_surfaces_monthly_est` as hero card. Framed around all bot types (search engines, AI assistants, training crawlers), not just consumer bots.

### Dynamic Badge Endpoint -- HAL 9000 Orb
- `/api/badge/[agentId].svg` -- renders text-free glowing orb SVG (80x80)
- Tier colors: Certified=blue, Audited=bronze/gold, Underwritten=gold
- Radial gradients with specular highlight, ambient glow, inner lens depth
- Returns gray fallback orb for listed/inactive/not-found agents
- 5-minute cache, CORS-enabled for cross-origin embedding

### Badge Instructions Page -- AI-Loud Metadata Snippets
- Two snippet modes: Visible Orb (80x80) and Invisible (1px, AI-only)
- Metadata-rich HTML: `alt="Top10Lists [Tier] AI Entity - Cryptographically Verified Data Payload"`, `rel="author"`, `title="Top10Lists.us - Verified AI Artifact"`
- Link destination: `/artifact/{token}` (public payload page -- to be built next)
- Mode toggle UI with preview for visible, dashed placeholder for invisible
- Explainer box: how alt, rel="author", and artifact link work for AI signal

### Auth / Login Fixes
- `get-agent-profile` edge function was never deployed to Supabase -- deployed it. This was the root cause of the dashboard login loop (login succeeded, profile load failed, Navigate back to login).
- `create-session-from-token` edge function: added `owner` role to admin bypass, `confirmed` to valid funnel_status values
- AdminLogin: auto-pass on existing valid session (checks `admin_users` on mount, skips form if found). Added `owner` to role check.
- AgentDashboard: role check accepts `owner` in addition to admin/superadmin
- Dev mode (localhost): AdminLogin auto-signs in via `VITE_ADMIN_EMAIL`/`VITE_ADMIN_PASSWORD` env vars. AgentDashboard loads professional directly from DB (no edge functions, no session tokens). AdminDashboard and CRM skip auth entirely on localhost.

## Config / Infrastructure
- `get-agent-profile` edge function deployed to Supabase (wiotrvoirdgzfacuuiem) -- was missing
- `create-session-from-token` edge function redeployed with owner role + confirmed status fixes
- `.env`: added `VITE_ADMIN_EMAIL` and `VITE_ADMIN_PASSWORD` for dev auto-login
- New Vercel API route: `api/badge/[agentId].svg.js`

## New Rules or Docs
- Tooltip component (`src/components/ui/tooltip.tsx`) is a non-functional shim -- renders TooltipContent as inline div. Do not use for hover tooltips. Use custom CSS hover or the InfoTip pattern from CitationROICalculator.
- AIFS scale is 0-100 (not 0-95). We just never reach 100.
- AI Surfaces/Month is the extrapolated bot crawl count including CDN cache hits. Raw `bot_crawl_logs` count is a subset.

## New Functions / Scripts
- `api/badge/[agentId].svg.js` -- Dynamic HAL 9000 orb badge. Queries Supabase for tier, renders tier-colored SVG orb. Supports UUID, short_code, and canonical_slug lookups.

## Deprecated or Removed
- Old text-based rectangular SVG badge design (replaced by orb)
- "How We Help AI Systems Cite You" marketing card from dashboard
- "Ask any AI" challenge text box from dashboard
- Three-column pricing cards from dashboard overview
- Hardcoded $800K deal size and 2.5% commission in tier card ROI calculations
- AIFS user input field in ROI calculator (locked to current score)

## Next Steps (for next session)
- **Public Artifact Page** (`/artifact/{token}`): The destination when someone clicks the orb badge. Should serve clean room HTML with the agent's full cryptographically signed data payload. This is the "Web of Truth" page -- the public-facing proof of verification.
- Badge endpoint needs testing on staging (Vercel API route)
- Consider: artifact page should have JSON-LD, Ed25519 signature verification display, tier details, evidence sources
