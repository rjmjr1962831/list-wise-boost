import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bgdtekbhelormzbymkhh.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHRla2JoZWxvcm16Ynlta2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjMxOTEsImV4cCI6MjA3ODA5OTE5MX0.pCRa4kAOE2tKzs7JNkoPtfT24sq-50KG7Eopz1-8oCk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminLogin() {
  console.log('\n=== Testing Admin Login for robert@aryah.ai ===\n');
  
  const email = 'robert@aryah.ai';
  const password = '!!@@##2Please##@@!!';
  
  try {
    // Attempt to sign in
    console.log('Step 1: Attempting to sign in...');
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });
    
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }
    
    if (!authData?.user) {
      console.error('❌ No user data returned');
      return;
    }
    
    console.log('✅ Sign in successful!');
    console.log('   User ID:', authData.user.id);
    console.log('   Email:', authData.user.email);
    console.log('   Email confirmed:', authData.user.email_confirmed_at ? 'Yes' : 'No');
    
    // Check user roles
    console.log('\nStep 2: Checking user roles...');
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role, created_at')
      .eq('user_id', authData.user.id);
    
    if (rolesError) {
      console.error('❌ Error fetching roles:', rolesError.message);
      console.error('   Code:', rolesError.code);
      console.error('   Details:', rolesError.details);
      console.error('   Hint:', rolesError.hint);
      
      // Sign out
      await supabase.auth.signOut();
      return;
    }
    
    if (!roles || roles.length === 0) {
      console.log('⚠️  No roles found for this user');
      console.log('   This account exists but has no assigned roles');
      console.log('   You need to run the SQL script to grant admin access');
      
      // Sign out
      await supabase.auth.signOut();
      return;
    }
    
    console.log('✅ Roles found:');
    roles.forEach(role => {
      console.log(`   - ${role.role} (added: ${new Date(role.created_at).toLocaleString()})`);
    });
    
    const hasAdminRole = roles.some(r => r.role === 'admin');
    
    if (hasAdminRole) {
      console.log('\n✅ SUCCESS: Account has admin access!');
      console.log('   You should be able to log in to /admin');
    } else {
      console.log('\n⚠️  ISSUE: Account exists but does NOT have admin role');
      console.log('   Current roles:', roles.map(r => r.role).join(', '));
      console.log('   You need to run the SQL script to grant admin access');
    }
    
    // Sign out
    console.log('\nStep 3: Signing out...');
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');
    
  } catch (error: any) {
    console.error('\n❌ Unexpected error:', error.message);
    console.error(error);
  }
}

// Run the test
testAdminLogin();
