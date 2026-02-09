import { useState, useEffect } from 'react'
import { supabase } from '@/lib/adminAuth'

interface Stats {
  totalAgents: number
  activeSubscriptions: number
  totalMRR: number
  newThisMonth: number
  funnelBreakdown: Record<string, number>
}

export default function CRMDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalAgents: 0,
    activeSubscriptions: 0,
    totalMRR: 0,
    newThisMonth: 0,
    funnelBreakdown: {},
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      // Get total agents count
      const { count: totalAgents } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })

      // Get active subscriptions
      const { count: activeSubscriptions } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'active')

      // Get MRR
      const { data: mrrData } = await supabase
        .from('professionals')
        .select('monthly_revenue_cents')
        .eq('subscription_status', 'active')

      const totalMRR = mrrData?.reduce((sum, agent) => sum + (agent.monthly_revenue_cents || 0), 0) || 0

      // Get new agents this month
      const firstOfMonth = new Date()
      firstOfMonth.setDate(1)
      firstOfMonth.setHours(0, 0, 0, 0)

      const { count: newThisMonth } = await supabase
        .from('professionals')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth.toISOString())

      // Get funnel breakdown
      const { data: funnelData } = await supabase
        .from('professionals')
        .select('funnel_status')

      const funnelBreakdown = funnelData?.reduce((acc, agent) => {
        const status = agent.funnel_status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      setStats({
        totalAgents: totalAgents || 0,
        activeSubscriptions: activeSubscriptions || 0,
        totalMRR,
        newThisMonth: newThisMonth || 0,
        funnelBreakdown,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatMRR(cents: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(cents / 100)
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Total Agents</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">
            {stats.totalAgents.toLocaleString()}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Active Subscriptions</div>
          <div className="mt-2 text-3xl font-semibold text-green-600">
            {stats.activeSubscriptions.toLocaleString()}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">Monthly Recurring Revenue</div>
          <div className="mt-2 text-3xl font-semibold text-blue-600">
            {formatMRR(stats.totalMRR)}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-sm font-medium text-gray-500">New This Month</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">
            +{stats.newThisMonth.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Funnel Breakdown */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Funnel Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.funnelBreakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div key={status} className="border border-gray-200 rounded-lg p-4">
                <div className="text-sm text-gray-500 capitalize">{status}</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">{count}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="space-y-2">
          <a
            href="/admin/crm/agents"
            className="block px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
          >
            View All Agents →
          </a>
          <a
            href="/admin/crm/pipeline"
            className="block px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
          >
            View Pipeline →
          </a>
          <a
            href="/admin/crm/revenue"
            className="block px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
          >
            Revenue Analytics →
          </a>
        </div>
      </div>
    </div>
  )
}
