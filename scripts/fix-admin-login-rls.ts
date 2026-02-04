/**
 * Fix admin login by adding RLS policy for users to read their own roles
 * Run with: npx tsx scripts/fix-admin-login-rls.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bgdtekbhelormzbymkhh.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHRla2JoZWxvcm16Ynlta2hoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjMxOTEsImV4cCI6MjA3ODA5OTE5MX0.pCRa4kAOE2tKzs7JNkoPtfT24sq-50KG7Eopz1-8oCk';

// We need the service role key for this - check if it's set
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  console.log('\nPlease run this SQL directly in Supabase SQL Editor:');
  console.log('='.repeat(60));
  console.log(`
-- Fix admin login by allowing users to read their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'user_roles';
  `);
  console.log('='.repeat(60));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  console.log('='.repeat(60));
  console.log('FIXING ADMIN LOGIN RLS POLICY');
  console.log('='.repeat(60));
  console.log();

  try {
    const sql = `
      -- Add policy for users to read their own roles
      CREATE POLICY IF NOT EXISTS "Users can view their own roles"
      ON public.user_roles
      FOR SELECT
      USING (user_id = auth.uid());
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error executing SQL:', error);
      console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:');
      console.log('='.repeat(60));
      console.log(sql);
      console.log('='.repeat(60));
      return;
    }

    console.log('✅ RLS policy added successfully!');
    console.log();
    console.log('Policy created: "Users can view their own roles"');
    console.log('Effect: Users can now check their own role during login');
    console.log();
    console.log('Admin login should now work! Try logging in at:');
    console.log('  https://staging.top10lists.us/admin/login');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Please run this SQL manually in Supabase SQL Editor:');
    console.log('='.repeat(60));
    console.log(`
CREATE POLICY IF NOT EXISTS "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());
    `);
    console.log('='.repeat(60));
  }
}

main();
