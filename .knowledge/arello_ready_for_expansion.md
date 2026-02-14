# ARELLO LVWS - Ready for TX/FL Expansion

## Quick Facts
- **Endpoint:** https://www.arello.com/lvws/v2/
- **Test credentials:** lvws_test/lvws_test (working)
- **Coverage:** 5 of 6 target states (all except NY)

## State Coverage

| State | ARELLO? | ZIP Codes? | Notes |
|-------|---------|------------|-------|
| AZ | ✅ Yes | ❌ No | Basic license data only |
| CA | ✅ Yes | ✅ Yes | Full address + ZIP |
| TX | ✅ Yes | ✅ Yes | Full address + ZIP |
| FL | ✅ Yes | ✅ Yes | Full address + ZIP |
| NY | ❌ **NO** | N/A | Non-participant, must use state files |
| CO | ✅ Yes | ✅ Yes | Full address + ZIP + phone |

## Why Use ARELLO

1. **Single API** instead of maintaining 5 different state file parsers
2. **Real-time** license verification vs monthly batch downloads
3. **ZIP codes included** for automatic neighborhood assignment (CA, TX, FL, CO)
4. **Standardized JSON** format across all states

## Implementation Plan

**When expanding to TX or FL:**
1. Purchase ARELLO subscription
2. Replace state file download with ARELLO API for that state
3. Use ZIP codes from ARELLO to auto-assign neighborhoods
4. Keep state file download for NY only

**Cost:** Pricing tiers at https://www.arello.com/pricing/

## What ARELLO Doesn't Provide
- Performance data (ratings, reviews, sales stats) - still need Zillow
- All 50 states - NY and potentially others don't participate

---

*Status: Tested and ready. Turn on when expanding to TX/FL.*
*Date: 2026-02-13*
