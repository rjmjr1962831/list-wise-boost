import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin key
    const adminKey = req.headers.get("x-admin-key");
    const expectedKey = Deno.env.get("CLAUDE_ADMIN_KEY");
    
    if (!expectedKey) {
      console.error("CLAUDE_ADMIN_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (adminKey !== expectedKey) {
      console.warn("Invalid admin key attempt");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { op, table, columns, data, filters, order, limit, offset, function: rpcFunction, params, query } = body;

    console.log(`Claude Admin API - Operation: ${op}, Table: ${table || rpcFunction || 'raw'}`);

    let result: any;

    switch (op) {
      case "select": {
        if (!table) throw new Error("table is required for select");
        
        let queryBuilder = supabase.from(table).select(columns || "*", { count: 'exact' });
        
        // Apply filters
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            if (value === null) {
              queryBuilder = queryBuilder.is(key, null);
            } else if (typeof value === 'object' && value !== null) {
              // Handle operators like { gt: 10 }, { in: [1,2,3] }, { ilike: '%text%' }
              const ops = value as Record<string, any>;
              for (const [operator, val] of Object.entries(ops)) {
                switch (operator) {
                  case 'eq': queryBuilder = queryBuilder.eq(key, val); break;
                  case 'neq': queryBuilder = queryBuilder.neq(key, val); break;
                  case 'gt': queryBuilder = queryBuilder.gt(key, val); break;
                  case 'gte': queryBuilder = queryBuilder.gte(key, val); break;
                  case 'lt': queryBuilder = queryBuilder.lt(key, val); break;
                  case 'lte': queryBuilder = queryBuilder.lte(key, val); break;
                  case 'like': queryBuilder = queryBuilder.like(key, val); break;
                  case 'ilike': queryBuilder = queryBuilder.ilike(key, val); break;
                  case 'in': queryBuilder = queryBuilder.in(key, val); break;
                  case 'is': queryBuilder = queryBuilder.is(key, val); break;
                  case 'contains': queryBuilder = queryBuilder.contains(key, val); break;
                  case 'containedBy': queryBuilder = queryBuilder.containedBy(key, val); break;
                  case 'not': queryBuilder = queryBuilder.not(key, 'eq', val); break;
                }
              }
            } else {
              queryBuilder = queryBuilder.eq(key, value);
            }
          }
        }
        
        // Apply ordering
        if (order) {
          for (const [column, direction] of Object.entries(order)) {
            queryBuilder = queryBuilder.order(column, { ascending: direction === 'asc' });
          }
        }
        
        // Apply limit and offset
        if (limit) queryBuilder = queryBuilder.limit(limit);
        if (offset) queryBuilder = queryBuilder.range(offset, offset + (limit || 10) - 1);
        
        const { data: selectData, error, count } = await queryBuilder;
        if (error) throw error;
        
        result = { success: true, data: selectData, count, operation: "select", table };
        break;
      }

      case "insert": {
        if (!table) throw new Error("table is required for insert");
        if (!data) throw new Error("data is required for insert");
        
        const { data: insertData, error } = await supabase
          .from(table)
          .insert(data)
          .select();
        
        if (error) throw error;
        result = { success: true, data: insertData, count: insertData?.length || 0, operation: "insert", table };
        break;
      }

      case "update": {
        if (!table) throw new Error("table is required for update");
        if (!data) throw new Error("data is required for update");
        if (!filters || Object.keys(filters).length === 0) {
          throw new Error("filters are required for update (safety check)");
        }
        
        let updateQuery = supabase.from(table).update(data);
        
        for (const [key, value] of Object.entries(filters)) {
          if (value === null) {
            updateQuery = updateQuery.is(key, null);
          } else {
            updateQuery = updateQuery.eq(key, value);
          }
        }
        
        const { data: updateData, error } = await updateQuery.select();
        if (error) throw error;
        
        result = { success: true, data: updateData, count: updateData?.length || 0, operation: "update", table };
        break;
      }

      case "delete": {
        if (!table) throw new Error("table is required for delete");
        if (!filters || Object.keys(filters).length === 0) {
          throw new Error("filters are required for delete (safety check)");
        }
        
        let deleteQuery = supabase.from(table).delete();
        
        for (const [key, value] of Object.entries(filters)) {
          if (value === null) {
            deleteQuery = deleteQuery.is(key, null);
          } else {
            deleteQuery = deleteQuery.eq(key, value);
          }
        }
        
        const { data: deleteData, error } = await deleteQuery.select();
        if (error) throw error;
        
        result = { success: true, data: deleteData, count: deleteData?.length || 0, operation: "delete", table };
        break;
      }

      case "upsert": {
        if (!table) throw new Error("table is required for upsert");
        if (!data) throw new Error("data is required for upsert");
        
        const { data: upsertData, error } = await supabase
          .from(table)
          .upsert(data, { onConflict: body.onConflict || 'id' })
          .select();
        
        if (error) throw error;
        result = { success: true, data: upsertData, count: upsertData?.length || 0, operation: "upsert", table };
        break;
      }

      case "rpc": {
        if (!rpcFunction) throw new Error("function is required for rpc");
        
        const { data: rpcData, error } = await supabase.rpc(rpcFunction, params || {});
        if (error) throw error;
        
        result = { success: true, data: rpcData, operation: "rpc", function: rpcFunction };
        break;
      }

      case "raw": {
        if (!query) throw new Error("query is required for raw");
        
        // Only allow SELECT statements for safety
        const trimmedQuery = query.trim().toLowerCase();
        if (!trimmedQuery.startsWith('select')) {
          throw new Error("raw queries must be SELECT only (read-only)");
        }
        
        const { data: rawData, error } = await supabase.rpc('exec_sql', { sql: query });
        
        // If exec_sql doesn't exist, try using the REST API directly
        if (error?.message?.includes('function') || error?.message?.includes('does not exist')) {
          // Fallback: use postgrest for simple queries
          console.log("exec_sql not available, raw queries limited");
          throw new Error("Raw SQL not supported - use structured operations instead");
        }
        
        if (error) throw error;
        result = { success: true, data: rawData, operation: "raw" };
        break;
      }

      case "count": {
        if (!table) throw new Error("table is required for count");
        
        let countQuery = supabase.from(table).select("*", { count: 'exact', head: true });
        
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            if (value === null) {
              countQuery = countQuery.is(key, null);
            } else {
              countQuery = countQuery.eq(key, value);
            }
          }
        }
        
        const { count, error } = await countQuery;
        if (error) throw error;
        
        result = { success: true, count, operation: "count", table };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${op}. Supported: select, insert, update, delete, upsert, rpc, raw, count`);
    }

    console.log(`Claude Admin API - Success: ${op} on ${table || rpcFunction || 'raw'}`);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Claude Admin API Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.details || null
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
