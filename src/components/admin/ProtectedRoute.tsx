import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getCurrentUser, AdminUser } from '@/lib/adminAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'viewer' | 'admin' | 'superadmin'
}

export default function ProtectedRoute({ children, requiredRole = 'viewer' }: ProtectedRouteProps) {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/crm/login" replace />
  }

  const roleHierarchy = {
    viewer: 1,
    admin: 2,
    superadmin: 3,
  }

  if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to view this page.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
