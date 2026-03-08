const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'supabase', 'functions', 'batch-memo23-ca-enrich', 'index.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`Original file: ${lines.length} lines\n`);

// Find key line numbers
const lineNumbers = {};
lines.forEach((line, i) => {
  const n = i + 1;
  const trimmed = line.replace(/\r$/, '');

  if (trimmed.includes('maxConcurrency: 5,') && n < 100) lineNumbers.enrichAgent_maxConc = n;
  if (trimmed.includes('maxRequestRetries: 5,') && n < 100) lineNumbers.enrichAgent_maxRetries = n;
  if (trimmed.includes('requestHandlerTimeoutSecs: 180,') && n < 100) lineNumbers.enrichAgent_timeout = n;
  if (trimmed.includes('proxyConfiguration:') && n < 100) lineNumbers.enrichAgent_proxyConfig = n;
  if (trimmed.includes('runs?token=') && n < 100) lineNumbers.enrichAgent_runsUrl = n;
  if (trimmed.includes('No data returned from Memo23') && n < 200) {
    if (!lineNumbers.enrichAgent_noData1) lineNumbers.enrichAgent_noData1 = n;
  }

  if (trimmed.includes('maxConcurrency: 5,') && n > 500) lineNumbers.reEnrich_maxConc = n;
  if (trimmed.includes('maxRequestRetries: 5,') && n > 500) lineNumbers.reEnrich_maxRetries = n;
  if (trimmed.includes('requestHandlerTimeoutSecs: 180,') && n > 500) lineNumbers.reEnrich_timeout = n;
  if (trimmed.includes('proxyConfiguration:') && n > 500) lineNumbers.reEnrich_proxyConfig = n;
  if (trimmed.includes('runs?token=') && n > 500) lineNumbers.reEnrich_runsUrl = n;
  if (trimmed.includes('No data returned from Apify') && n > 500) lineNumbers.reEnrich_noData = n;

  // enrichAgent listing count
  if (trimmed === '    if (agentData.forSaleCount !== undefined) {' && n < 400) lineNumbers.enrichAgent_forSale = n;
  if (trimmed === '    // Insert into professionals' && n < 400) lineNumbers.enrichAgent_insertComment = n;

  // enrichAgent sales stats
  if (trimmed.includes('agentSalesStats.priceRange)') && n < 400) lineNumbers.enrichAgent_priceRange = n;
  if (trimmed.includes('agentSalesStats.averageValue)') && n < 400) lineNumbers.enrichAgent_avgValue = n;
  if (trimmed.includes('agentSalesStats.includeTeam') && n < 400) lineNumbers.enrichAgent_includeTeam = n;

  // reEnrich sales stats
  if (trimmed.includes('agentSalesStats.priceRange)') && n > 500) lineNumbers.reEnrich_priceRange = n;
  if (trimmed.includes('agentSalesStats.averageValue)') && n > 500) lineNumbers.reEnrich_avgValue = n;
  if (trimmed.includes('agentSalesStats.includeTeam') && n > 500) lineNumbers.reEnrich_includeTeam = n;

  // reEnrich image_url line (before Business info)
  if (trimmed.includes('profilePhotoSrc) updateData.image_url') && n > 500) lineNumbers.reEnrich_imageUrl = n;

  // reEnrich listing count
  if (trimmed === '    if (agentData.forSaleCount !== undefined) {' && n > 500) lineNumbers.reEnrich_forSale = n;
  if (trimmed === '    // Update professionals record' && n > 500) lineNumbers.reEnrich_updateComment = n;

  // reEnrich phone (cell only, no business fallback)
  if (trimmed.includes('updateData.cell_phone = agentData.phoneNumbers.cell;') && n > 500) lineNumbers.reEnrich_cellPhone = n;
});

console.log('Key line numbers:', JSON.stringify(lineNumbers, null, 2));

// Verify we found what we need
const required = ['enrichAgent_maxConc', 'enrichAgent_proxyConfig', 'enrichAgent_runsUrl',
                   'reEnrich_maxConc', 'reEnrich_proxyConfig', 'reEnrich_runsUrl'];
for (const key of required) {
  if (!lineNumbers[key]) {
    console.error(`ERROR: Could not find line for ${key}`);
    process.exit(1);
  }
}

// Now do the replacements on the lines array
const eol = lines[0].endsWith('\r') ? '\r' : '';

// HELPER: replace line content
function setLine(n, text) {
  lines[n - 1] = text + eol;
}

function removeLine(n) {
  lines[n - 1] = null; // mark for removal
}

function insertAfter(n, textLines) {
  const insertions = textLines.map(t => t + eol);
  lines.splice(n, 0, ...insertions); // insert after line n (0-indexed n = after line n)
}

// ===================================================================
// FIX enrichAgent: Replace maxConcurrency/maxRetries/timeout/proxyConfiguration with maxItems/proxy
// ===================================================================
setLine(lineNumbers.enrichAgent_maxConc, '      maxItems: 1,');
removeLine(lineNumbers.enrichAgent_maxRetries);
removeLine(lineNumbers.enrichAgent_timeout);
setLine(lineNumbers.enrichAgent_proxyConfig, '      proxy: proxyUrl ? {');

console.log('✅ enrichAgent: fixed actor input fields');

// We need to handle this differently since removing lines shifts indices.
// Let's collect all changes and apply them at the end.
// Actually let's just work with the content string directly using unique markers.

// ABORT line approach - too fragile with line shifts. Use string replacement on content instead.
console.log('\nSwitching to content-based replacement...');

// Start fresh
let c = content;

// ===== FIX 1: enrichAgent input fields =====
c = c.replace(
  'startUrls: [{ url: agent.zillow_url }],\r\n      maxConcurrency: 5,\r\n      maxRequestRetries: 5,\r\n      requestHandlerTimeoutSecs: 180,\r\n      proxyConfiguration: proxyUrl',
  'startUrls: [{ url: agent.zillow_url }],\r\n      maxItems: 1,\r\n      proxy: proxyUrl'
);
console.log('✅ Fix 1: enrichAgent input fields');

// ===== FIX 2: enrichAgent Apify endpoint (replace entire polling block) =====
// Find the block from "const runResponse" to "No data returned from Memo23" return block
const enrichPollStart = '    const runResponse = await fetch(\r\n      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,';
const enrichPollEndMarker = "        message: 'No data returned from Memo23'\r\n      };\r\n    }";
const idx1 = c.indexOf(enrichPollStart);
const idx2 = c.indexOf(enrichPollEndMarker, idx1);
if (idx1 === -1 || idx2 === -1) {
  console.error('ERROR: Could not find enrichAgent polling block');
  console.error('  idx1:', idx1, 'idx2:', idx2);
  process.exit(1);
}
const enrichPollEnd = idx2 + enrichPollEndMarker.length;
const enrichPollBlock = c.substring(idx1, enrichPollEnd);

const newEnrichBlock = `    const apifyResponse = await fetch(\r
      \`https://api.apify.com/v2/acts/\${actorId}/run-sync-get-dataset-items\`,\r
      {\r
        method: 'POST',\r
        headers: {\r
          'Content-Type': 'application/json',\r
          'Authorization': \`Bearer \${apifyToken}\`\r
        },\r
        body: JSON.stringify(actorInput)\r
      }\r
    );\r
\r
    if (!apifyResponse.ok) {\r
      const errorText = await apifyResponse.text();\r
      throw new Error(\`Apify run failed: \${apifyResponse.status} \${errorText.slice(0, 200)}\`);\r
    }\r
\r
    const apifyResults = await apifyResponse.json();\r
    const agentData = apifyResults[0] || null;\r
\r
    if (!agentData) {\r
      await supabase.from('state_licenses').update({\r
        zillow_scraped_at: new Date().toISOString(),\r
        memo23_status: 'no_data',\r
        memo23_error: 'No data returned from Memo23'\r
      }).eq('id', agent.id);\r
\r
      return {\r
        id: agent.id,\r
        name: agent.name,\r
        license_number: agent.license_number,\r
        status: 'failed',\r
        message: 'No data returned from Memo23'\r
      };\r
    }`;

c = c.replace(enrichPollBlock, newEnrichBlock);
console.log('✅ Fix 2: enrichAgent sync endpoint');

// ===== FIX 3: enrichAgent sales stats field names =====
c = c.replace(
  'if (agentData.agentSalesStats.priceRange) {\r\n        professionalData.price_range_3yr_min = agentData.agentSalesStats.priceRange.min || null;\r\n        professionalData.price_range_3yr_max = agentData.agentSalesStats.priceRange.max || null;\r\n      }\r\n      if (agentData.agentSalesStats.averageValue) {\r\n        professionalData.average_value_3yr = agentData.agentSalesStats.averageValue || null;\r\n      }\r\n      professionalData.stats_include_team = agentData.agentSalesStats.includeTeam || false;',

  'if (agentData.agentSalesStats.priceRangeThreeYearMin !== undefined) {\r\n        professionalData.price_range_3yr_min = agentData.agentSalesStats.priceRangeThreeYearMin;\r\n      }\r\n      if (agentData.agentSalesStats.priceRangeThreeYearMax !== undefined) {\r\n        professionalData.price_range_3yr_max = agentData.agentSalesStats.priceRangeThreeYearMax;\r\n      }\r\n      if (agentData.agentSalesStats.averageValueThreeYear !== undefined) {\r\n        professionalData.average_value_3yr = agentData.agentSalesStats.averageValueThreeYear;\r\n      }\r\n      professionalData.stats_include_team = agentData.agentSalesStats.stats_include_team || false;'
);
console.log('✅ Fix 3: enrichAgent sales stats fields');

// ===== FIX 4: enrichAgent add missing memo23 fields =====
c = c.replace(
  '// Active listings count\r\n    if (agentData.forSaleCount !== undefined) {\r\n      professionalData.active_for_sale_count = agentData.forSaleCount;\r\n    }\r\n    if (agentData.forRentCount !== undefined) {\r\n      professionalData.active_for_rent_count = agentData.forRentCount;\r\n    }\r\n\r\n    // Insert into professionals',

  `// Email (critical for contact data)\r
    if (agentData.email) professionalData.email = agentData.email;\r
\r
    // Website & languages from professionalInformation\r
    if (agentData.professionalInformation) {\r
      professionalData.professional_information = agentData.professionalInformation;\r
      if (Array.isArray(agentData.professionalInformation)) {\r
        for (const info of agentData.professionalInformation) {\r
          if (info.websites?.length > 0) {\r
            professionalData.website = info.websites[0].url || info.websites[0];\r
          }\r
          if (info.languages?.length > 0) {\r
            professionalData.languages = info.languages;\r
          }\r
        }\r
      }\r
    }\r
\r
    // Get To Know Me (bio/about text)\r
    if (agentData.getToKnowMe) professionalData.get_to_know_me = agentData.getToKnowMe;\r
\r
    // Top Agent / Premier Agent status\r
    if (agentData.isTopAgent !== undefined) professionalData.is_top_agent = agentData.isTopAgent;\r
    if (agentData.isPremierAgent !== undefined) professionalData.is_premier_agent = agentData.isPremierAgent;\r
    if (agentData.inCanada !== undefined) professionalData.in_canada = agentData.inCanada;\r
\r
    // Video URL\r
    if (agentData.sidebarVideoUrl) professionalData.sidebar_video_url = agentData.sidebarVideoUrl;\r
\r
    // Profile metadata\r
    if (agentData.flag) professionalData.zillow_flag = agentData.flag;\r
    if (agentData.profileImageId) professionalData.profile_image_id = agentData.profileImageId;\r
    if (agentData.profileTypeIds) professionalData.profile_type_ids = agentData.profileTypeIds;\r
    if (agentData.profileTypes) professionalData.profile_types = agentData.profileTypes;\r
    if (agentData.cpdUserPronouns) professionalData.cpd_user_pronouns = agentData.cpdUserPronouns;\r
\r
    // Reviews data blob\r
    if (agentData.reviewsData) professionalData.reviews_data = agentData.reviewsData;\r
\r
    // Preferred lenders\r
    if (agentData.preferredLenders) professionalData.professional_data = { preferredLenders: agentData.preferredLenders };\r
\r
    // Active listings count\r
    if (agentData.forSaleListings?.listing_count !== undefined) {\r
      professionalData.active_for_sale_count = agentData.forSaleListings.listing_count;\r
    } else if (agentData.forSaleCount !== undefined) {\r
      professionalData.active_for_sale_count = agentData.forSaleCount;\r
    }\r
    if (agentData.forRentListings?.listing_count !== undefined) {\r
      professionalData.active_for_rent_count = agentData.forRentListings.listing_count;\r
    } else if (agentData.forRentCount !== undefined) {\r
      professionalData.active_for_rent_count = agentData.forRentCount;\r
    }\r
\r
    // Past sales total\r
    if (agentData.pastSales?.total !== undefined) {\r
      professionalData.total_sales = agentData.pastSales.total;\r
    }\r
\r
    // Insert into professionals`
);
console.log('✅ Fix 4: enrichAgent add memo23 fields');

// ===== FIX 5: reEnrichProfessional input fields =====
c = c.replace(
  'startUrls: [{ url: professional.zillow_profile_url }],\r\n      maxConcurrency: 5,\r\n      maxRequestRetries: 5,\r\n      requestHandlerTimeoutSecs: 180,\r\n      proxyConfiguration: proxyUrl',
  'startUrls: [{ url: professional.zillow_profile_url }],\r\n      maxItems: 1,\r\n      proxy: proxyUrl'
);
console.log('✅ Fix 5: reEnrichProfessional input fields');

// ===== FIX 6: reEnrichProfessional Apify endpoint =====
const reEnrichPollStart = c.indexOf('    const runResponse = await fetch(\r\n      `https://api.apify.com/v2/acts/${actorId}/runs?token=${apifyToken}`,');
if (reEnrichPollStart === -1) {
  console.error('ERROR: Could not find reEnrichProfessional polling block');
  process.exit(1);
}
const reEnrichEndMarker = "        message: 'No data returned from Memo23'\r\n      };\r\n    }";
const reEnrichEndIdx = c.indexOf(reEnrichEndMarker, reEnrichPollStart);
if (reEnrichEndIdx === -1) {
  console.error('ERROR: Could not find reEnrichProfessional end marker');
  process.exit(1);
}
const reEnrichPollEnd = reEnrichEndIdx + reEnrichEndMarker.length;
const reEnrichPollBlock = c.substring(reEnrichPollStart, reEnrichPollEnd);

const newReEnrichBlock = `    const apifyResponse = await fetch(\r
      \`https://api.apify.com/v2/acts/\${actorId}/run-sync-get-dataset-items\`,\r
      {\r
        method: 'POST',\r
        headers: {\r
          'Content-Type': 'application/json',\r
          'Authorization': \`Bearer \${apifyToken}\`\r
        },\r
        body: JSON.stringify(actorInput)\r
      }\r
    );\r
\r
    if (!apifyResponse.ok) {\r
      const errorText = await apifyResponse.text();\r
      throw new Error(\`Apify run failed: \${apifyResponse.status} \${errorText.slice(0, 200)}\`);\r
    }\r
\r
    const apifyResults = await apifyResponse.json();\r
    const agentData = apifyResults[0] || null;\r
\r
    if (!agentData) {\r
      return {\r
        id: professional.id,\r
        name: professional.name,\r
        license_number: '',\r
        status: 'failed',\r
        message: 'No data returned from Memo23'\r
      };\r
    }`;

c = c.replace(reEnrichPollBlock, newReEnrichBlock);
console.log('✅ Fix 6: reEnrichProfessional sync endpoint');

// ===== FIX 7: reEnrichProfessional add missing fields =====
c = c.replace(
  'if (agentData.profilePhotoSrc) updateData.image_url = agentData.profilePhotoSrc;\r\n\r\n    // Business info',
  `if (agentData.profilePhotoSrc) updateData.image_url = agentData.profilePhotoSrc;\r
\r
    // Email (critical for contact data)\r
    if (agentData.email) updateData.email = agentData.email;\r
\r
    // Website & languages from professionalInformation\r
    if (agentData.professionalInformation) {\r
      updateData.professional_information = agentData.professionalInformation;\r
      if (Array.isArray(agentData.professionalInformation)) {\r
        for (const info of agentData.professionalInformation) {\r
          if (info.websites?.length > 0) {\r
            updateData.website = info.websites[0].url || info.websites[0];\r
          }\r
          if (info.languages?.length > 0) {\r
            updateData.languages = info.languages;\r
          }\r
        }\r
      }\r
    }\r
\r
    // Get To Know Me (bio/about text)\r
    if (agentData.getToKnowMe) updateData.get_to_know_me = agentData.getToKnowMe;\r
\r
    // Top Agent / Premier Agent status\r
    if (agentData.isTopAgent !== undefined) updateData.is_top_agent = agentData.isTopAgent;\r
    if (agentData.isPremierAgent !== undefined) updateData.is_premier_agent = agentData.isPremierAgent;\r
    if (agentData.inCanada !== undefined) updateData.in_canada = agentData.inCanada;\r
\r
    // Video URL\r
    if (agentData.sidebarVideoUrl) updateData.sidebar_video_url = agentData.sidebarVideoUrl;\r
\r
    // Profile metadata\r
    if (agentData.flag) updateData.zillow_flag = agentData.flag;\r
    if (agentData.profileImageId) updateData.profile_image_id = agentData.profileImageId;\r
    if (agentData.profileTypeIds) updateData.profile_type_ids = agentData.profileTypeIds;\r
    if (agentData.profileTypes) updateData.profile_types = agentData.profileTypes;\r
    if (agentData.cpdUserPronouns) updateData.cpd_user_pronouns = agentData.cpdUserPronouns;\r
\r
    // Reviews data blob\r
    if (agentData.reviewsData) updateData.reviews_data = agentData.reviewsData;\r
\r
    // Preferred lenders\r
    if (agentData.preferredLenders) updateData.professional_data = { preferredLenders: agentData.preferredLenders };\r
\r
    // Business info`
);
console.log('✅ Fix 7: reEnrichProfessional add memo23 fields');

// ===== FIX 8: reEnrichProfessional sales stats =====
c = c.replace(
  'if (agentData.agentSalesStats.priceRange) {\r\n        updateData.price_range_3yr_min = agentData.agentSalesStats.priceRange.min || null;\r\n        updateData.price_range_3yr_max = agentData.agentSalesStats.priceRange.max || null;\r\n      }\r\n      if (agentData.agentSalesStats.averageValue) {\r\n        updateData.average_value_3yr = agentData.agentSalesStats.averageValue || null;\r\n      }\r\n      updateData.stats_include_team = agentData.agentSalesStats.includeTeam || false;',

  `if (agentData.agentSalesStats.priceRangeThreeYearMin !== undefined) {\r
        updateData.price_range_3yr_min = agentData.agentSalesStats.priceRangeThreeYearMin;\r
      }\r
      if (agentData.agentSalesStats.priceRangeThreeYearMax !== undefined) {\r
        updateData.price_range_3yr_max = agentData.agentSalesStats.priceRangeThreeYearMax;\r
      }\r
      if (agentData.agentSalesStats.averageValueThreeYear !== undefined) {\r
        updateData.average_value_3yr = agentData.agentSalesStats.averageValueThreeYear;\r
      }\r
      updateData.stats_include_team = agentData.agentSalesStats.stats_include_team || false;`
);
console.log('✅ Fix 8: reEnrichProfessional sales stats fields');

// ===== FIX 9: reEnrichProfessional listing count + past sales =====
c = c.replace(
  'if (agentData.forSaleCount !== undefined) {\r\n      updateData.active_for_sale_count = agentData.forSaleCount;\r\n    }\r\n    if (agentData.forRentCount !== undefined) {\r\n      updateData.active_for_rent_count = agentData.forRentCount;\r\n    }\r\n\r\n    // Update professionals record',

  `if (agentData.forSaleListings?.listing_count !== undefined) {\r
      updateData.active_for_sale_count = agentData.forSaleListings.listing_count;\r
    } else if (agentData.forSaleCount !== undefined) {\r
      updateData.active_for_sale_count = agentData.forSaleCount;\r
    }\r
    if (agentData.forRentListings?.listing_count !== undefined) {\r
      updateData.active_for_rent_count = agentData.forRentListings.listing_count;\r
    } else if (agentData.forRentCount !== undefined) {\r
      updateData.active_for_rent_count = agentData.forRentCount;\r
    }\r
\r
    // Past sales total\r
    if (agentData.pastSales?.total !== undefined) {\r
      updateData.total_sales = agentData.pastSales.total;\r
    }\r
\r
    // Update professionals record`
);
console.log('✅ Fix 9: reEnrichProfessional listing count + past sales');

// ===== FIX 10: reEnrichProfessional phone business fallback =====
c = c.replace(
  'if (agentData.phoneNumbers.cell) {\r\n        updateData.phone = agentData.phoneNumbers.cell;\r\n        updateData.cell_phone = agentData.phoneNumbers.cell;\r\n      }\r\n    }\r\n\r\n    // Ratings',

  'if (agentData.phoneNumbers.cell) {\r\n        updateData.phone = agentData.phoneNumbers.cell;\r\n        updateData.cell_phone = agentData.phoneNumbers.cell;\r\n      } else if (agentData.phoneNumbers.business) {\r\n        updateData.phone = agentData.phoneNumbers.business;\r\n      }\r\n    }\r\n\r\n    // Ratings'
);
console.log('✅ Fix 10: reEnrichProfessional phone business fallback');

fs.writeFileSync(filePath, c);
console.log(`\n✅ All fixes applied! File saved.`);
