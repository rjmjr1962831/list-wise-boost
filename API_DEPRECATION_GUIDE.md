# API Deprecation Guide

## Active APIs (As of 2025-11-17)

This project now uses **ONLY** two Apify actors for all real estate agent data:

### 1. **agenscrape~zillow-agents-finder**
- **Used by:** `fetch-getdataforme-agent-stats` edge function
- **Purpose:** Fetches detailed agent statistics from Zillow
- **Returns:** Agent stats including current listings, total sales, years of experience

### 2. **getdataforme~zillow-real-state-agents-scraper**
- **Used by:** 
  - `fetch-zillow-agents` edge function
  - `fetch-apify-zillow-reviews` edge function
  - `update-agent-zillow-stats` edge function (via fetch-zillow-agents)
- **Purpose:** Discovers agents in a market and fetches their reviews
- **Returns:** List of agents with profile URLs, stats, and reviews

## Deprecated APIs

The following APIs and edge functions have been **DEPRECATED** and should no longer be used:

### Deprecated Edge Functions
1. **fetch-zillow-profile-stats** - Replaced by `fetch-getdataforme-agent-stats`
2. **fetch-apify-agent-stats** - Replaced by `fetch-getdataforme-agent-stats`
3. **fetch-external-reviews** - External reviews (Outscraper) no longer supported
4. **fetch-zillow-agents-bulk** - Replaced by `fetch-zillow-agents`

### Deprecated Third-Party Services
- **Outscraper API** - Google Business reviews no longer fetched
- **Other Apify Actors** - All actors except the two listed above

## Migration Guide

### Code Changes Made

1. **src/hooks/useZillowStats.ts**
   - Removed `fetch-zillow-profile-stats` calls
   - Now uses `fetch-getdataforme-agent-stats` directly

2. **src/hooks/useExternalReviews.ts**
   - Disabled external reviews fetching
   - Returns empty array (function kept for backward compatibility)

3. **src/components/ProfessionalCard.tsx**
   - Removed direct `fetch-zillow-profile-stats` calls
   - Uses `update-agent-zillow-stats` which internally uses getdataforme

4. **Edge Functions**
   - `fetch-apify-zillow-reviews` - Updated to use only getdataforme actor
   - `fetch-getdataforme-agent-stats` - Now hardcoded to use agenscrape actor only

### Environment Variables Still Required
- `APIFY_API_TOKEN` or `APIFY_API_KEY` - For accessing Apify platform
- All other API keys (Outscraper, etc.) are no longer needed

## Benefits of This Change

1. **Simplified Architecture** - Two actors instead of 5+
2. **Reduced API Costs** - Single source for Zillow data
3. **Better Reliability** - Focused on proven actors
4. **Easier Maintenance** - Fewer integrations to manage

## Active Edge Functions

These functions are still active and maintained:

- ✅ `fetch-getdataforme-agent-stats` - Fetch agent statistics
- ✅ `fetch-zillow-agents` - Discover agents in a market
- ✅ `fetch-apify-zillow-reviews` - Fetch Zillow reviews
- ✅ `update-agent-zillow-stats` - Update agent stats in database
- ✅ `create-agent-checkout` - Stripe payment processing
- ✅ `generate-agent-bios` - AI bio generation
- ✅ `lookup-agent-license` - License verification
- ✅ `send-*` - Email/SMS functions
- ✅ `generate-zoom-meeting` - Zoom integration

## Rollback Instructions

If you need to rollback these changes:

1. Restore the edge functions from the previous version
2. Revert the hook changes in `src/hooks/useZillowStats.ts` and `src/hooks/useExternalReviews.ts`
3. Restore ProfessionalCard.tsx to use `fetch-zillow-profile-stats`
4. Re-enable the deprecated API secrets if needed

## Support

For questions about this migration, refer to:
- DEPRECATED.md files in deprecated edge function directories
- This guide
- Project documentation
