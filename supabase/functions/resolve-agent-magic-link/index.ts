// supabase/functions/resolve-agent-magic-link/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ResolveRequest = {
  citySlug?: string
  agentSlug?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('resolve-agent-magic-link: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response(JSON.stringify({ success: false, error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body: ResolveRequest = await req.json().catch(() => ({}))
    const citySlug = body.citySlug?.trim()
    const agentSlug = body.agentSlug?.trim()

    if (!citySlug || !agentSlug) {
      return new Response(JSON.stringify({ success: false, error: 'citySlug and agentSlug are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const phoneDigits = agentSlug.slice(-4)
    if (!/^\d{4}$/.test(phoneDigits)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid agent slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    console.log('resolve-agent-magic-link: resolving', { citySlug, phoneDigits })

    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id')
      .eq('slug', citySlug)
      .maybeSingle()

    if (cityError || !city) {
      console.error('resolve-agent-magic-link: city not found', { citySlug, cityError })
      return new Response(JSON.stringify({ success: false, error: 'City not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: professionals, error: profError } = await supabase
      .from('professionals')
      .select('id, phone')
      .eq('city_id', city.id)
      .eq('active', true)

    if (profError || !professionals) {
      console.error('resolve-agent-magic-link: professionals query failed', { profError })
      return new Response(JSON.stringify({ success: false, error: 'Lookup failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const match = professionals.find((p) => {
      if (!p.phone) return false
      const digits = String(p.phone).replace(/\D/g, '')
      return digits.slice(-4) === phoneDigits
    })

    if (!match) {
      console.warn('resolve-agent-magic-link: no match', { citySlug, phoneDigits })
      return new Response(JSON.stringify({ success: false, error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, professionalId: match.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('resolve-agent-magic-link: Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
