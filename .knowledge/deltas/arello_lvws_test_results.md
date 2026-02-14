# ARELLO LVWS API - Test Connection Results

## Connection Details
- **Endpoint:** https://www.arello.com/lvws/v2/
- **Method:** HTTP POST with URL-encoded form data
- **Response Format:** JSON
- **Test Credentials:** username=lvws_test, password=lvws_test
- **Status:** Connection successful

## Request Parameters

### Required:
- `username` - API username
- `password` - API password  
- `searchMode` - Must be "test" or "live"
- `jurisdiction` - State code (e.g., "AZ", "CA", "TX")

### Optional Search Fields:
- `licenseNumber` - License number to search
- `lastName` - Last name to search
- `firstName` - First name to search
- `maxResults` - Maximum results to return (default appears to be unlimited)
- `minScore` - Minimum match score (0-100)

## Response Structure

### Top-Level Keys:
- `results` - Array of licensee records
- `warnings` - Array of warning messages
- `errors` - Array of error objects
- `request` - Echo of request parameters (password masked)
- `searchesThisMonth` - Usage counter
- `searchTier` - Monthly allotment (-1 for test account)
- `expirationDate` - Account expiration date

## Available Fields Per Record

Based on test searches against Arizona jurisdiction:

```json
{
  "firstName": "string",
  "middleName": "string",  
  "lastName": "string",
  "suffix": "string",
  "jurisdiction": "string (state code)",
  "city": "string",
  "licenseNumber": "string",
  "licenseType": "string (e.g., 'Salesperson', 'Broker')",
  "licenseStatus": "string (e.g., 'Active', 'Expired', 'Terminated')",
  "licenseIssueDate": "datetime",
  "licenseExpirationDate": "datetime",
  "officeName": "string",
  "addrLine1": "string",
  "addrLine2": "string",
  "stateProv": "string",
  "postalCode": "string",
  "country": "string",
  "telephone": "string",
  "fax": "string",
  "email": "string",
  "score": "string (match confidence 0-100)"
}
```

## Fields NOT Available (vs Zillow)
- **No performance data:** No ratings, reviews, transaction counts
- **No sales stats:** No price ranges, average sale price, sales volume
- **No specializations:** No market segment data
- **No team info:** No team lead relationships
- **No photos:** No profile images or property photos
- **No bio/description:** No agent biography or marketing content

## Test Data Observations
- Test environment appears to contain only inactive/expired licenses
- Contact fields (email, phone, address) return empty in test data
- Office name field returns empty in test data
- Score field indicates match confidence (higher = better match)

## Use Case for Top10Lists.us

### What ARELLO Provides:
✅ License verification (confirm agent is licensed)
✅ License status (Active, Expired, Terminated)
✅ License type (Salesperson vs Broker)
✅ Issue and expiration dates
✅ Multi-state search capability (all participating jurisdictions)

### What ARELLO Does NOT Provide:
❌ Agent performance metrics (ratings, reviews)
❌ Transaction history
❌ Contact information in production (may be available, test data incomplete)
❌ Brokerage affiliation details
❌ Marketing content or bios

## Recommended Integration Strategy

**Current State:**
- State license databases provide basic licensing data (what ARELLO also provides)
- Zillow provides performance data, ratings, reviews (what ARELLO lacks)

**ARELLO Value Proposition:**
- **Cross-state verification:** Single API for multi-state license checks vs scraping 50+ state sites
- **Real-time status:** License status updates vs monthly batch imports
- **Standardized format:** Consistent JSON schema across all states

**Recommendation:**
1. **Replace state license scraping** with ARELLO for license verification
2. **Keep Zillow scraping** for performance data (ratings, reviews, sales stats)
3. **Hybrid approach:** ARELLO for "licensed/not licensed", Zillow for "top 0.5% qualification"

**Implementation Priority:**
- **Phase 1:** Continue current approach (state scraping + Zillow)
- **Phase 2:** Purchase ARELLO subscription after $2K+ monthly revenue
- **Use case:** Replace brittle state scraping with API for license verification only

## Pricing & Subscription
- Test account: Unlimited searches (searchTier: -1)
- Production: Monthly subscription required
- Pricing tiers based on searches/month
- Contact: Visit https://www.arello.com/pricing/ for production pricing

## Rate Limits (From Documentation)
- Throttling begins when exceeding monthly tier
- For every 5% over tier, throttling rate doubles
- Recommendation: Monitor searchesThisMonth vs searchTier

## Next Steps

1. ✅ Test connection successful
2. ✅ Document available fields
3. ⬜ Test all 6 target states (AZ, CA, TX, FL, NY, CO)
4. ⬜ Compare field completeness across states
5. ⬜ Evaluate production pricing
6. ⬜ Decision: Worth $X/month to replace state scraping?

---

*Test completed: 2026-02-13*
*Recommendation: Valuable for license verification, but does not replace Zillow for performance data*
