import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')!
const ENRICHMENT_KEY = Deno.env.get('ENRICHMENT_API_KEY')!

const PROMPT_TEMPLATE = `Based on this agent's complete profile, write a concise 2-3 sentence explanation of why they were selected for Top10Lists certification.

CRITICAL: Community involvement carries the highest weight in our ranking (25%). If the agent has ANY community roles, charitable work, board positions, or local engagement, you MUST highlight this first.

Focus on (in priority order):
1. Community involvement and leadership roles (REQUIRED if present - 25% weight)
2. Quantifiable performance metrics (rating, review count, transactions - 65% combined)
3. Professional credentials and what makes them stand out

Profile data:
{bio}

Write in third person, present tense. Start with "Selected for..."
Keep it factual and merit-based. Max 280 characters.`

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fetchAgentsNeedingRationale(batchSize: number = 50) {
  // Fetch from both states
  const agents = []
  
  for (const state of ['arizona', 'california']) {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, name, synthesized_bio, selection_rationale, state_slug')
      .eq('state_slug', state)
      .eq('active', true)
      .not('synthesized_bio', 'is', null)
      .is('selection_rationale', null)
      .limit(batchSize / 2)
    
    if (error) {
      console.error(`Error fetching ${state} agents:`, error)
      continue
    }
    
    agents.push(...(data || []))
  }
  
  return agents.slice(0, batchSize)
}

async function generateRationale(bio: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{
        role: 'user',
        content: PROMPT_TEMPLATE.replace('{bio}', bio)
      }],
      max_tokens: 150,
      temperature: 0.6
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepSeek API error: ${errorText}`)
  }
  
  const result = await response.json()
  let rationale = result.choices[0].message.content.trim()
  
  // Ensure under 280 chars
  if (rationale.length > 280) {
    rationale = rationale.substring(0, 277) + '...'
  }
  
  return rationale
}

async function updateAgentRationale(agentId: string, rationale: string) {
  const { error } = await supabase
    .from('professionals')
    .update({
      selection_rationale: rationale,
      selection_rationale_generated_at: new Date().toISOString()
    })
    .eq('id', agentId)
  
  if (error) {
    throw new Error(`Failed to update agent ${agentId}: ${error.message}`)
  }
}

async function selfChain() {
  // Call self to process next batch
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/enrich-selection-rationale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Enrichment-Key': ENRICHMENT_KEY
      },
      body: JSON.stringify({})
    })
  } catch (error) {
    console.error('Self-chain failed:', error)
  }
}

serve(async (req) => {
  try {
    // Auth check
    const authHeader = req.headers.get('X-Enrichment-Key')
    if (authHeader !== ENRICHMENT_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const startTime = Date.now()
    
    // Fetch agents needing rationale
    const agents = await fetchAgentsNeedingRationale(50)
    
    if (agents.length === 0) {
      return new Response(JSON.stringify({
        status: 'complete',
        message: 'All agents processed'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    console.log(`Processing ${agents.length} agents`)
    
    let processed = 0
    let errors = 0
    
    // Process each agent
    for (const agent of agents) {
      try {
        // Generate rationale
        const rationale = await generateRationale(agent.synthesized_bio)
        
        // Update database
        await updateAgentRationale(agent.id, rationale)
        
        processed++
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (error) {
        console.error(`Error processing ${agent.name}:`, error)
        errors++
      }
      
      // Check if approaching timeout (55 seconds)
      if (Date.now() - startTime > 55000) {
        console.log('Approaching timeout, self-chaining...')
        await selfChain()
        break
      }
    }
    
    // If we processed all without timeout, chain to next batch
    if (processed === agents.length && agents.length === 50) {
      await selfChain()
    }
    
    return new Response(JSON.stringify({
      status: 'processing',
      processed,
      errors,
      remaining: agents.length - processed,
      nextBatchQueued: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
