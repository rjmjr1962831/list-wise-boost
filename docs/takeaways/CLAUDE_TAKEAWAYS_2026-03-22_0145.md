# Claude Takeaways — 2026-03-22 01:45 UTC

## Key Outcomes

- **Email campaign launched**: "Listed 7d crawl" — 2,986 agents queued, 148 sent Day 0, 90 opens (61%), 5 clicks, 9 bounces
- **Email infrastructure fixed (multiple bugs)**:
  - Base64 body parts now RFC 2045 compliant (76-char line wrapping) — Proton Mail was silently rejecting
  - HTML document wrapper added (`<!DOCTYPE html><html><body>`) — Gmail was rendering raw tags
  - Click tracking now covers all links including our own domain (funnel links were untracked)
  - Campaign counters fixed (run_sql is SELECT-only, was silently failing)
  - Bounce detection: sequencer sweeps Gmail inboxes for mailer-daemon messages, marks queue rows as failed, creates CRM tasks
  - HTML detection in gmail-send: skips textToHtml() when input is already HTML
  - Mark Garland display name in From header for mark@ accounts
- **Magic link fixed**: `/dashboard/{token}` → `/funnel/{token}` in list-maker-export and sample data
- **Funnel Step1**: shows 7-day AI surfaces (from agent_ai_surfaces) instead of monthly estimate
- **TierPricingCalculator**: new shared component for funnel pricing + dashboard upgrade
- **California support**: 11 regional city bundles, neighborhood nearby resolution handles both AZ JSON and CA semicolon formats
- **Funnel instrumentation**: all 8 steps tracked via crm_contact_activity + crm_tasks for high-signal events
- **Email alerts**: click and tier selection alerts sent to rjmjr1@proton.me
- **Campaign monitor**: live activity feed, progress bar, ETA with compound ramp, bounce/unsub counts
- **Mark's phone updated**: (602) 999-3745 → (480) 204-6636
- **CLAUDE.md created** at repo root for Claude Web access
- **COMPREHENSIVE restored** on staging (was being deleted by merge-to-main exclusion step)

## Config / Infrastructure

- **Sender accounts**: 4 active for campaigns (mark excluded). All 5 available for task emails.
- **Send limits**: 40/day start, +10% compound, campaign start 2026-03-21
- **Send window**: 5am-8pm MST, Mon-Sat
- **3-minute minimum** between sends per account (cooldown check in sequencer)
- **Edge functions deployed**: sequencer-v2-tick, gmail-send, email-track, unsubscribe, create-agent-checkout, list-maker-export
- **Post-deploy hook**: auto-sends test email to robert@aryah.ai after email function deploys

## New Rules

- **TEST BEFORE DONE**: ALL CAPS rule at top of CLAUDE.md. Never say "done" without verifying end-to-end with real data. Show receipts.
- **run_sql is SELECT-only**: Use .update()/.insert() for writes. This caused campaign counter failures.
- **All links tracked**: Including our own domain. Only the tracker URL itself is excluded.
- **HTML must be wrapped**: Every email body needs `<!DOCTYPE html><html><body>` wrapper.
- **Base64 must be line-wrapped**: 76 chars per line per RFC 2045.
- **Bounce detection is post-delivery**: Gmail accepts the message (200), bounce comes later from mailer-daemon. Sequencer sweeps inboxes to detect.

## Deprecated / Removed

- Complete button removed from campaign monitor (manual instruction only)
- Old daily limit formula (per-domain tiers) replaced with universal 40 × 1.10^days
- OUR_DOMAIN link exclusion in tracking removed (was preventing funnel click tracking)
