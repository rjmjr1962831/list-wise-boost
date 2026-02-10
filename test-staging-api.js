// Test Badge API on staging site
const TEST_AGENT_ID = '1b975c55-a33b-4d21-8998-dc2d9b2dd91d';

async function testEndpoint(url, name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(url);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    const text = await response.text();
    
    // Check if it's JSON or HTML
    if (text.startsWith('<!') || text.startsWith('<html')) {
      console.log('ERROR: Received HTML instead of JSON');
      console.log('First 200 chars:', text.substring(0, 200));
      return { success: false, error: 'HTML response' };
    }
    
    const data = JSON.parse(text);
    console.log(`Response (first 500 chars):`);
    console.log(JSON.stringify(data, null, 2).substring(0, 500));
    
    return { success: true, status: response.status, data };
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('Badge API Test - Staging Site');
  console.log(`Test Agent: ${TEST_AGENT_ID}\n`);

  // Try staging.top10lists.us
  const staging1 = await testEndpoint(
    `https://staging.top10lists.us/api/v1/badge/${TEST_AGENT_ID}`,
    'Staging Site - Badge Payload'
  );

  const staging2 = await testEndpoint(
    `https://staging.top10lists.us/api/v1/badge/${TEST_AGENT_ID}/verify`,
    'Staging Site - Verification'
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Staging Badge: ${staging1.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Staging Verify: ${staging2.success ? '✅ PASS' : '❌ FAIL'}`);
}

main().catch(console.error);
