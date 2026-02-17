import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, logAudit } from '@/lib/adminAuth'

interface Agent {
  id: string
  name: string
  email: string | null
  phone: string | null
  website: string | null
  state_slug: string | null
  city_slug: string | null
  funnel_status: string
  subscription_status: string
  monthly_revenue_cents: number
  last_payment_at: string | null
  cities_subscribed: string[] | null
  synthesized_bio: string | null
  selection_rationale: string | null
  review_stars_rating: number | null
  num_total_reviews: number | null
  years_experience: number | null
  specialties: string[] | null
  credentials: string[] | null
  license_number: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AgentDetail() {
  const { agentId } = useParams()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAgent()
    logAudit('view_agent_detail', { agent_id: agentId })
  }, [agentId])

  async function loadAgent() {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', agentId)
      .single()

    if (error) {
      console.error('Error loading agent:', error)
    } else {
      setAgent(data)
    }
    
    setLoading(false)
  }

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

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading...</div>
    )
  }

  if (!agent) {
    return (
      <div className="p-8 text-center text-gray-500">Agent not found</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Link to="/admin/crm/agents" className="text-sm text-blue-600 hover:text-blue-900 mb-2 inline-block">
            ← Back to Agents
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {agent.state_slug} • {agent.city_slug || 'No city'}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${
            agent.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {agent.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact & Status */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact & Status</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="text-sm text-gray-900">{agent.email || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="text-sm text-gray-900">{agent.phone || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Website</dt>
              <dd className="text-sm text-gray-900">
                {agent.website ? (
                  <a href={agent.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900">
                    {agent.website}
                  </a>
                ) : (
                  'Not provided'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">License Number</dt>
              <dd className="text-sm text-gray-900">{agent.license_number || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Funnel Status</dt>
              <dd>
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                  {agent.funnel_status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Subscription Status</dt>
              <dd>
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  agent.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                  agent.subscription_status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {agent.subscription_status}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Performance & Revenue */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance & Revenue</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Monthly Revenue (MRR)</dt>
              <dd className="text-2xl font-bold text-gray-900">{formatMRR(agent.monthly_revenue_cents || 0)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Payment</dt>
              <dd className="text-sm text-gray-900">{formatDate(agent.last_payment_at)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Rating</dt>
              <dd className="text-sm text-gray-900">
                {agent.review_stars_rating ? `${agent.review_stars_rating} ⭐` : 'Not rated'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Total Reviews</dt>
              <dd className="text-sm text-gray-900">{agent.num_total_reviews || 0}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Years Experience</dt>
              <dd className="text-sm text-gray-900">{agent.years_experience || 'Not specified'}</dd>
            </div>
            {agent.cities_subscribed && agent.cities_subscribed.length > 0 && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Subscribed Cities</dt>
                <dd className="text-sm text-gray-900">{agent.cities_subscribed.join(', ')}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Selection Rationale - NEW */}
      {agent.selection_rationale && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Why We Selected This Agent</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {agent.selection_rationale}
          </p>
        </div>
      )}

      {/* Bio */}
      {agent.synthesized_bio && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Bio</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {agent.synthesized_bio}
          </p>
        </div>
      )}

      {/* Specialties & Credentials */}
      {(agent.specialties && agent.specialties.length > 0) || (agent.credentials && agent.credentials.length > 0) ? (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Specialties & Credentials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {agent.specialties && agent.specialties.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Specialties</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {agent.specialties.map((specialty, idx) => (
                    <li key={idx}>{specialty}</li>
                  ))}
                </ul>
              </div>
            )}
            {agent.credentials && agent.credentials.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Credentials</h3>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {agent.credentials.map((credential, idx) => (
                    <li key={idx}>{credential}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Metadata */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Info</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Agent ID</dt>
            <dd className="text-sm text-gray-900 font-mono">{agent.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="text-sm text-gray-900">{formatDate(agent.created_at)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
            <dd className="text-sm text-gray-900">{formatDate(agent.updated_at)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
