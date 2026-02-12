import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, logAudit } from '@/lib/adminAuth'

interface Agent {
  id: string
  name: string
  email: string | null
  phone: string | null
  state_slug: string | null
  funnel_status: string
  subscription_status: string
  monthly_revenue_cents: number
  last_payment_at: string | null
  cities_subscribed: string[] | null
  selection_rationale: string | null
  updated_at: string
}

export default function AgentList() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [funnelFilter, setFunnelFilter] = useState('')

  useEffect(() => {
    loadAgents()
    logAudit('view_agent_list')
  }, [])

  async function loadAgents() {
    setLoading(true)
    
    let query = supabase
      .from('professionals')
      .select('id, name, email, phone, state_slug, funnel_status, subscription_status, monthly_revenue_cents, last_payment_at, cities_subscribed, selection_rationale, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100)

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (stateFilter) {
      query = query.eq('state_slug', stateFilter)
    }

    if (statusFilter) {
      query = query.eq('subscription_status', statusFilter)
    }

    if (funnelFilter) {
      query = query.eq('funnel_status', funnelFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error loading agents:', error)
    } else {
      setAgents(data || [])
    }
    
    setLoading(false)
  }

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadAgents()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search, stateFilter, statusFilter, funnelFilter])

  function formatMRR(cents: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100)
  }

  function formatDate(date: string | null) {
    if (!date) return 'Never'
    return new Date(date).toLocaleDateString()
  }

  const totalMRR = agents.reduce((sum, agent) => sum + (agent.monthly_revenue_cents || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="mt-1 text-sm text-gray-500">
            {agents.length} agents • Total MRR: {formatMRR(totalMRR)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All States</option>
            <option value="arizona">Arizona</option>
            <option value="california">California</option>
            <option value="texas">Texas</option>
            <option value="florida">Florida</option>
            <option value="new-york">New York</option>
            <option value="colorado">Colorado</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Subscription Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
            <option value="none">None</option>
          </select>

          <select
            value={funnelFilter}
            onChange={(e) => setFunnelFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Funnel Stages</option>
            <option value="welcome">Welcome</option>
            <option value="contacted">Contacted</option>
            <option value="replied">Replied</option>
            <option value="interested">Interested</option>
            <option value="trial">Trial</option>
            <option value="paying">Paying</option>
            <option value="churned">Churned</option>
          </select>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : agents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No agents found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  State
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Funnel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  MRR
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{agent.name}</div>
                    <div className="text-sm text-gray-500">{agent.email || 'No email'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {agent.state_slug || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {agent.funnel_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      agent.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                      agent.subscription_status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {agent.subscription_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatMRR(agent.monthly_revenue_cents || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(agent.last_payment_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      to={`/admin/crm/agents/${agent.id}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
