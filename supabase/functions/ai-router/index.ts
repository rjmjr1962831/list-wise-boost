import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Model configuration
const MODELS = {
  // Lovable AI Gateway (Gemini/OpenAI)
  'gemini-flash': { provider: 'lovable', model: 'google/gemini-2.5-flash' },
  'gemini-pro': { provider: 'lovable', model: 'google/gemini-2.5-pro' },
  'gpt5': { provider: 'lovable', model: 'openai/gpt-5' },
  'gpt5-mini': { provider: 'lovable', model: 'openai/gpt-5-mini' },
  'gpt5-nano': { provider: 'lovable', model: 'openai/gpt-5-nano' },
  
  // Claude (Anthropic) - Best for complex reasoning, long docs, code
  'claude-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-5' },
  'claude-opus': { provider: 'anthropic', model: 'claude-opus-4-1-20250805' },
  
  // DeepSeek - Cost-effective for coding and structured tasks
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-reasoner' },
};

// Task routing configuration - which model to use for each task type
const TASK_ROUTING: Record<string, string> = {
  // Cost-sensitive, simple tasks → DeepSeek
  'bio-generation': 'deepseek-chat',
  'email-draft': 'deepseek-chat',
  'text-summarization': 'deepseek-chat',
  'data-extraction': 'deepseek-chat',
  'specialty-extraction': 'deepseek-chat',
  
  // Complex reasoning, document analysis → Claude
  'press-extraction': 'claude-sonnet',
  'document-analysis': 'claude-sonnet',
  'code-review': 'claude-sonnet',
  'complex-reasoning': 'claude-sonnet',
  'profile-synthesis': 'claude-sonnet',
  
  // Fast, general purpose → Gemini Flash (default)
  'general': 'gemini-flash',
  'quick-response': 'gpt5-nano',
  'chat': 'gemini-flash',
  
  // High accuracy required → GPT-5 or Gemini Pro
  'critical-analysis': 'gpt5',
  'multimodal': 'gemini-pro',
};

interface AIRequest {
  task: string;
  messages: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  model?: string; // Override automatic routing
  temperature?: number;
  maxTokens?: number;
}

async function callLovableAI(model: string, messages: any[], temperature?: number, maxTokens?: number) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Lovable AI error:', response.status, error);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  return response.json();
}

async function callClaude(model: string, messages: any[], systemPrompt?: string, temperature?: number, maxTokens?: number) {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  // Convert messages format for Claude
  const claudeMessages = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  // Extract system prompt from messages if not provided
  const system = systemPrompt || messages.find(m => m.role === 'system')?.content || '';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens ?? 4096,
      system,
      messages: claudeMessages,
      temperature: temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Claude error:', response.status, error);
    throw new Error(`Claude error: ${response.status}`);
  }

  const data = await response.json();
  
  // Normalize response to OpenAI format
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: data.content[0]?.text || '',
      },
    }],
    usage: data.usage,
    model: data.model,
    provider: 'anthropic',
  };
}

async function callDeepSeek(model: string, messages: any[], temperature?: number, maxTokens?: number) {
  const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY');
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not configured');

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('DeepSeek error:', response.status, error);
    throw new Error(`DeepSeek error: ${response.status}`);
  }

  const data = await response.json();
  return { ...data, provider: 'deepseek' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task, messages, systemPrompt, model: overrideModel, temperature, maxTokens }: AIRequest = await req.json();

    // Determine which model to use
    const selectedModelKey = overrideModel || TASK_ROUTING[task] || TASK_ROUTING['general'];
    const modelConfig = MODELS[selectedModelKey as keyof typeof MODELS];

    if (!modelConfig) {
      throw new Error(`Unknown model: ${selectedModelKey}`);
    }

    console.log(`[AI Router] Task: ${task}, Model: ${selectedModelKey} (${modelConfig.provider}/${modelConfig.model})`);

    // Prepare messages with system prompt
    const fullMessages = systemPrompt 
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    let result;
    
    switch (modelConfig.provider) {
      case 'lovable':
        result = await callLovableAI(modelConfig.model, fullMessages, temperature, maxTokens);
        result.provider = 'lovable';
        break;
      
      case 'anthropic':
        result = await callClaude(modelConfig.model, fullMessages, systemPrompt, temperature, maxTokens);
        break;
      
      case 'deepseek':
        result = await callDeepSeek(modelConfig.model, fullMessages, temperature, maxTokens);
        break;
      
      default:
        throw new Error(`Unknown provider: ${modelConfig.provider}`);
    }

    // Add routing metadata
    result.routing = {
      task,
      selectedModel: selectedModelKey,
      provider: modelConfig.provider,
      model: modelConfig.model,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[AI Router] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
