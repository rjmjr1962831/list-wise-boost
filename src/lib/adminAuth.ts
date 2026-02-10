import { supabase } from '@/integrations/supabase/client'

// Re-export supabase for convenience
export { supabase }

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  role: 'superadmin' | 'admin' | 'viewer'
  active: boolean
  last_login_at: string | null
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  
  // Update last login
  if (data.user) {
    await supabase
      .from('admin_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.user.id)
  }
  
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null
  
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', user.id)
    .eq('active', true)
    .single()
  
  return adminUser
}

export async function logAudit(
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, any>
) {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return
  
  await supabase.from('audit_log').insert({
    user_id: user.id,
    user_email: user.email,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
  })
}

export function hasPermission(user: AdminUser | null, requiredRole: 'viewer' | 'admin' | 'superadmin'): boolean {
  if (!user || !user.active) return false
  
  const roleHierarchy = {
    viewer: 1,
    admin: 2,
    superadmin: 3,
  }
  
  return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
}
