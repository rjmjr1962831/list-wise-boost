import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const agentId = pathParts[pathParts.length - 1]

    if (!agentId) {
      return new Response(
        JSON.stringify({ error: 'Missing agent ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Query professional by id or short_code
    const { data: professional, error } = await supabase
      .from('professionals')
      .select('id, short_code, current_tier, badge_tier, badge_status')
      .or(`id.eq.${agentId},short_code.eq.${agentId}`)
      .single()

    // Use current_tier so badge updates automatically when tier changes (up or down). Fallback to badge_tier for legacy.
    let badgeTier = (professional?.current_tier || professional?.badge_tier || 'certified').toLowerCase().replace(/\s+/g, '_')
    if (badgeTier === 'accredited') badgeTier = 'audited'

    // Map to PNG filename: listed, certified, audited, underwritten (repo uses these)
    const tierFile = ['listed', 'certified', 'audited', 'underwritten'].includes(badgeTier) ? badgeTier : 'certified'

    // Fetch badge image from GitHub raw content (same URL always; tier in path so badge updates when tier changes)
    const badgeUrl = `https://raw.githubusercontent.com/rjmjr1962831/list-wise-boost/main/public/badges/${tierFile}.png`
    const badgeResponse = await fetch(badgeUrl)
    
    if (!badgeResponse.ok) {
      throw new Error(`Failed to fetch badge: ${badgeResponse.status}`)
    }

    const badgeBlob = await badgeResponse.blob()
    const badgeBuffer = await badgeBlob.arrayBuffer()

    return new Response(badgeBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Badge serving error:', error)
    
    // Fallback to certified badge
    try {
      const fallbackUrl = 'https://raw.githubusercontent.com/rjmjr1962831/list-wise-boost/main/public/badges/certified.png'
      const fallbackResponse = await fetch(fallbackUrl)
      const fallbackBlob = await fallbackResponse.blob()
      const fallbackBuffer = await fallbackBlob.arrayBuffer()
      
      return new Response(fallbackBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
        },
      })
    } catch (fallbackError) {
      return new Response(
        JSON.stringify({ error: 'Failed to load badge' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }
})
