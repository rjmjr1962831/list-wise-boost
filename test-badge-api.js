// Test script for badge API endpoints
const TEST_AGENT_ID = '1b975c55-a33b-4d21-8998-dc2d9b2dd91d'; // Allison Cahill from seed data

async function testEndpoint(url, name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(url);
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log(`\nResponse:`);
    console.log(JSON.stringify(data, null, 2));
    
    return { success: true, status: response.status, data };
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('Badge API Test Suite');
  console.log('Test Agent: Allison Cahill');
  console.log(`Agent ID: ${TEST_AGENT_ID}\n`);

  // Test 1: Direct Edge Function (artifact-payload) - Already deployed
  const test1 = await testEndpoint(
    `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-payload/${TEST_AGENT_ID}`,
    'Test 1: Direct Edge Function - artifact-payload'
  );

  // Test 2: Direct Edge Function (artifact-verify) - Needs deployment
  console.log('\n\nℹ️  Note: Tests 2-4 require deployment. Run after pushing to main.\n');
  
  const test2 = await testEndpoint(
    `https://wiotrvoirdgzfacuuiem.supabase.co/functions/v1/artifact-verify/${TEST_AGENT_ID}`,
    'Test 2: Direct Edge Function - artifact-verify'
  );

  // Test 3: Vercel API Route (badge payload) - Needs Vercel deployment
  const test3 = await testEndpoint(
    `https://www.top10lists.us/api/v1/badge/${TEST_AGENT_ID}`,
    'Test 3: Vercel API Route - Badge Payload'
  );

  // Test 4: Vercel API Route (verification) - Needs Vercel deployment
  const test4 = await testEndpoint(
    `https://www.top10lists.us/api/v1/badge/${TEST_AGENT_ID}/verify`,
    'Test 4: Vercel API Route - Verification'
  );

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Test 1 (artifact-payload): ${test1.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (artifact-verify): ${test2.success ? '✅ PASS' : '❌ FAIL (deploy first)'}`);
  console.log(`Test 3 (Vercel badge): ${test3.success ? '✅ PASS' : '❌ FAIL (deploy first)'}`);
  console.log(`Test 4 (Vercel verify): ${test4.success ? '✅ PASS' : '❌ FAIL (deploy first)'}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYMENT COMMANDS');
  console.log('='.repeat(60));
  console.log('1. Deploy Edge Function:');
  console.log('   supabase functions deploy artifact-verify --project-ref wiotrvoirdgzfacuuiem --no-verify-jwt');
  console.log('\n2. Push to GitHub:');
  console.log('   git add . && git commit -m "Add Badge API v1" && git push');
  console.log('\n3. See full guide: docs/badge-api-deployment.md');
  console.log('='.repeat(60));
}

main().catch(console.error);
