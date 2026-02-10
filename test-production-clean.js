// Test production endpoints without cache busting
const TEST_AGENT_ID = '1b975c55-a33b-4d21-8998-dc2d9b2dd91d';

async function test(url, name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`X-Vercel-Cache: ${response.headers.get('x-vercel-cache') || 'none'}`);
    console.log(`Cache-Control: ${response.headers.get('cache-control')}`);
    
    if (text.startsWith('<!') || text.startsWith('<html')) {
      console.log('❌ HTML Response (first 200 chars):');
      console.log(text.substring(0, 200));
      return false;
    }
    
    const data = JSON.parse(text);
    console.log('\n✅ JSON Response!');
    console.log(`Agent: ${data.agent_name || 'N/A'}`);
    console.log(`Valid: ${data.valid !== undefined ? data.valid : 'N/A'}`);
    console.log(`Keys: ${Object.keys(data).slice(0, 5).join(', ')}...`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Testing Production Badge API (Clean URLs)\n');
  
  const r1 = await test(
    `https://www.top10lists.us/api/v1/badge/${TEST_AGENT_ID}`,
    'Badge Payload'
  );
  
  const r2 = await test(
    `https://www.top10lists.us/api/v1/badge/${TEST_AGENT_ID}/verify`,
    'Badge Verification'
  );
  
  console.log('\n' + '='.repeat(60));
  console.log(r1 && r2 ? '🎉 ALL TESTS PASSED!' : '❌ Tests failed - cache may still be propagating');
  console.log('='.repeat(60));
}

main().catch(console.error);
