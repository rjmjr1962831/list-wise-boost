import { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { getCurrentUser, signOut, AdminUser } from '@/lib/adminAuth'

export default function AdminLayout() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadUser() {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    }
    loadUser()
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/admin/crm/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Top10Lists Admin</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/admin/crm/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  to="/admin/crm/agents"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Agents
                </Link>
                <Link
                  to="/admin/crm/hot-leads"
                  className="border-transparent text-red-500 hover:border-red-300 hover:text-red-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Hot Leads
                </Link>
                <Link
                  to="/admin/crm/pipeline"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Pipeline
                </Link>
                <Link
                  to="/admin/crm/revenue"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Revenue
                </Link>
                {user?.role === 'superadmin' && (
                  <Link
                    to="/admin/crm/audit"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Audit Log
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {user?.email}
                  <span className="ml-2 text-xs text-gray-500">({user?.role})</span>
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-700 hover:text-gray-900"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  )
}
