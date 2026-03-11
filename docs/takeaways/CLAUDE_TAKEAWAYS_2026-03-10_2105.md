# Claude Code Takeaways — 2026-03-10

## Key Outcomes
- Attempted to build `find-linkedin-url` edge function for enriching professional records with LinkedIn profile URLs
- Exa.ai search rejected by Robert as unreliable/hallucinating LinkedIn URLs
- Switched to Google Custom Search (CSE) API — deployed but hitting persistent 403 "project does not have access to Custom Search JSON API" despite API showing enabled in console
- Google CSE approach currently blocked; function deployed but non-functional
- LinkedIn URL enrichment is needed for CRM/campaign builder list maker exports, not as a standalone search feature

## Config / Infrastructure
- `GOOGLE_CSE_API_KEY` — added as Supabase secret (AIzaSyBTN1iR5Sk-fKBNfdqvSsPRSMdj7qAqgqA)
- `GOOGLE_CSE_CX` — added as Supabase secret (935b179d3ad4c4951)
- Google CSE API returns 403 despite being "enabled" in Google Cloud Console — likely a project-level API activation issue on Google's side

## New Rules or Docs
- (none this session)

## New Functions / Scripts
- `supabase/functions/find-linkedin-url/index.ts` — Google CSE-based LinkedIn URL lookup (single + batch mode, optional save to professionals.social_linkedin). Deployed but blocked by Google API 403.

## Deprecated or Removed
- Exa.ai approach for LinkedIn URL lookup — rejected as unreliable
