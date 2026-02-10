// Test with cache bypass
const TEST_AGENT_ID = '1b975c55-a33b-4d21-8998-dc2d9b2dd91d';

async function testWithCacheBust(url, name) {
  const timestamp = Date.now();
  const urlWithBust = `${url}?nocache=${timestamp}`;
  
  console.log(`\nTesting: ${name}`);
  console.log(`URL: ${urlWithBust}\n`);
  
  try {
    const response = await fetch(urlWithBust, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`X-Vercel-Cache: ${response.headers.get('x-vercel-cache')}`);
    console.log(`X-Powered-By: ${response.headers.get('x-powered-by')}`);
    
    const text = await response.text();
    
    if (text.startsWith('<!') || text.startsWith('<html')) {
      console.log('❌ ERROR: Still returning HTML');
      console.log('First 300 chars:', text.substring(0, 300));
      return false;
    }
    
    const data = JSON.parse(text);
    console.log('✅ SUCCESS: Got JSON response');
    console.log('Keys:', Object.keys(data).join(', '));
    
    if (data.agent_id) {
      console.log(`Agent: ${data.agent_name}`);
      console.log(`Tier: ${data.certification?.tier || data.certification_tier || 'N/A'}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Testing Badge API with Cache Bypass');
  console.log('='.repeat(60));
  
  const test1 = await testWithCacheBust(
    `https://www.top10lists.us/api/v1/badge/${TEST_AGENT_ID}`,
    'Badge Payload'
  );
  
  const test2 = await testWithCacheBust(
    `https://www.top10lists.us/api/v1/badge/${TEST_AGENT_ID}/verify`,
    'Verification'
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log(`Badge Payload: ${test1 ? '✅ WORKING' : '❌ FAILED'}`);
  console.log(`Verification: ${test2 ? '✅ WORKING' : '❌ FAILED'}`);
  
  if (test1 && test2) {
    console.log('\n🎉 ALL TESTS PASSED! Badge API is live on production!');
  } else {
    console.log('\n⏳ Deployment may still be processing. Wait 2 minutes and try again.');
  }
}

main().catch(console.error);
