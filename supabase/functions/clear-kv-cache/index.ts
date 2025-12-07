import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const CLOUDFLARE_KV_NAMESPACE_ID = Deno.env.get('CLOUDFLARE_KV_NAMESPACE_ID');
const CLOUDFLARE_API_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN');

interface ClearRequest {
  prefix?: string; // Optional prefix to filter keys (e.g., "https://top10lists.us/arizona/phoenix")
  clear_all?: boolean; // Clear entire namespace
}

async function listKeys(prefix?: string, cursor?: string): Promise<{ keys: { name: string }[], cursor?: string, list_complete: boolean }> {
  const params = new URLSearchParams();
  if (prefix) params.set('prefix', prefix);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', '1000');

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/keys?${params}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to list keys: ${JSON.stringify(data.errors)}`);
  }

  return {
    keys: data.result || [],
    cursor: data.result_info?.cursor,
    list_complete: data.result_info?.count < 1000,
  };
}

async function deleteKeys(keys: string[]): Promise<{ success: boolean, deleted: number }> {
  if (keys.length === 0) {
    return { success: true, deleted: 0 };
  }

  // Cloudflare bulk delete accepts up to 10,000 keys per request
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/bulk`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(keys),
  });

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`Failed to delete keys: ${JSON.stringify(data.errors)}`);
  }

  return { success: true, deleted: keys.length };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate credentials
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID || !CLOUDFLARE_API_TOKEN) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing Cloudflare credentials. Required: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_API_TOKEN' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prefix, clear_all } = await req.json() as ClearRequest;

    console.log(`🗑️ KV Cache Clear Request - prefix: ${prefix || 'none'}, clear_all: ${clear_all}`);

    // Collect all keys to delete
    const allKeys: string[] = [];
    let cursor: string | undefined;
    let iterations = 0;
    const maxIterations = 100; // Safety limit

    do {
      const result = await listKeys(clear_all ? undefined : prefix, cursor);
      allKeys.push(...result.keys.map(k => k.name));
      cursor = result.list_complete ? undefined : result.cursor;
      iterations++;
      
      console.log(`📋 Listed ${result.keys.length} keys (total: ${allKeys.length})`);
      
      if (iterations >= maxIterations) {
        console.warn('⚠️ Reached maximum iterations, stopping key collection');
        break;
      }
    } while (cursor);

    if (allKeys.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No keys found to delete',
          deleted: 0,
          prefix: prefix || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete in batches of 10,000 (Cloudflare limit)
    let totalDeleted = 0;
    const batchSize = 10000;
    
    for (let i = 0; i < allKeys.length; i += batchSize) {
      const batch = allKeys.slice(i, i + batchSize);
      const result = await deleteKeys(batch);
      totalDeleted += result.deleted;
      console.log(`🗑️ Deleted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} keys`);
    }

    console.log(`✅ KV Cache cleared: ${totalDeleted} keys deleted`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Deleted ${totalDeleted} keys from KV cache`,
        deleted: totalDeleted,
        prefix: prefix || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ KV Cache Clear Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
