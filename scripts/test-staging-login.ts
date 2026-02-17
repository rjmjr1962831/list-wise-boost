import { createClient } from '@supabase/supabase-js';

// Staging Supabase instance (from Vercel)
const supabaseUrl = 'https://wiotrvoirdgzfacuuiem.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpb3Rydm9pcmRnemZhY3V1aWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTcwNzcsImV4cCI6MjA4NTM5MzA3N30.BZAli-r81llqnq9xStghKNqK8MnrSNQMOIqkkE09mwI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testStagingLogin() {
  console.log('\n=== Testing Staging Instance Login ===');
  console.log('Instance:', supabaseUrl);
  console.log('Email: robert@aryah.ai\n');
  
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
      console.error('   Error code:', signInError.status);
      
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('\n⚠️  ISSUE: Account does not exist on staging instance');
        console.log('   This account exists on the LOCAL instance but not STAGING');
        console.log('\n📝 To fix: Run this SQL in Supabase SQL Editor for wiotrvoirdgzfacuuiem:');
        console.log('   You need to either:');
        console.log('   1. Create the account via Supabase Dashboard → Authentication → Users → "Add user"');
        console.log('   2. Or sign up through the app if you have a signup page');
        console.log('   Then run this SQL to grant admin role:');
        console.log(`
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'admin'
   FROM auth.users
   WHERE email = 'robert@aryah.ai'
   ON CONFLICT (user_id, role) DO NOTHING;
        `);
      }
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
      console.log('   Account exists but has no assigned roles');
      console.log('\n📝 To fix: Run this SQL in Supabase SQL Editor:');
      console.log(`
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('${authData.user.id}', 'admin')
   ON CONFLICT (user_id, role) DO NOTHING;
      `);
      
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
      console.log('\n✅ SUCCESS: Account has admin access on STAGING!');
      console.log('   The admin login should work now.');
    } else {
      console.log('\n⚠️  ISSUE: Account exists but does NOT have admin role');
      console.log('   Current roles:', roles.map(r => r.role).join(', '));
      console.log('\n📝 To fix: Run this SQL in Supabase SQL Editor:');
      console.log(`
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('${authData.user.id}', 'admin')
   ON CONFLICT (user_id, role) DO NOTHING;
      `);
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
testStagingLogin();
